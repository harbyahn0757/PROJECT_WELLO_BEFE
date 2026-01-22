import { useState, useEffect, useRef, useCallback } from 'react';

interface PollingOptions {
  mktUuid: string;
  onSuccess: (data: any) => void;
  onTimeout?: () => void;
  startDelay?: number; // 시작 지연 시간 (ms)
  interval?: number; // 폴링 간격 (ms)
  maxDuration?: number; // 최대 폴링 시간 (ms)
}

export const useAIMSReportPolling = ({
  mktUuid,
  onSuccess,
  onTimeout,
  startDelay = 8000, // 8초 후 시작
  interval = 2000, // 2초 간격
  maxDuration = 30000, // 최대 30초
}: PollingOptions) => {
  const [isPolling, setIsPolling] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkReport = useCallback(async (): Promise<boolean> => {
    try {
      console.log(`[폴링] 리포트 조회 시작 - mkt_uuid: ${mktUuid}`);
      const response = await fetch(`/api/partner-marketing/aims-report?mkt_uuid=${encodeURIComponent(mktUuid)}`);
      const data = await response.json();

      console.log(`[폴링] API 응답:`, {
        success: data.success,
        has_report: data.has_report,
        hasData: !!data.data,
        hasAimsResponse: !!(data.data && data.data.aims_response)
      });

      // has_report 플래그 우선 확인
      if (data.success && data.has_report === true && data.data && data.data.aims_response) {
        console.log(`[폴링] 리포트 데이터 발견! 폴링 중지`);
        setHasData(true);
        onSuccess(data.data);
        return true;
      }
      console.log(`[폴링] 리포트 데이터 없음 - 계속 폴링`);
      return false;
    } catch (err) {
      console.error('[폴링] 리포트 조회 오류:', err);
      setError('리포트 조회 중 오류가 발생했습니다.');
      return false;
    }
  }, [mktUuid, onSuccess]);

  const stopPolling = useCallback(() => {
    console.log(`[폴링] 폴링 중지`);
    setIsPolling(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startTimeRef.current = null;
  }, []);

  const startPolling = useCallback(() => {
    if (!mktUuid) {
      setError('mkt_uuid가 없습니다.');
      return;
    }

    console.log(`[폴링] 폴링 시작 - mkt_uuid: ${mktUuid}, startDelay: ${startDelay}ms, interval: ${interval}ms, maxDuration: ${maxDuration}ms`);
    setIsPolling(true);
    setError(null);
    startTimeRef.current = Date.now();

    // 시작 지연 후 첫 조회
    timeoutRef.current = setTimeout(async () => {
      console.log(`[폴링] 첫 조회 시작 (${startDelay}ms 지연 후)`);
      const hasReport = await checkReport();
      
      if (hasReport) {
        console.log(`[폴링] 첫 조회에서 데이터 발견 - 폴링 중지`);
        stopPolling();
        return;
      }

      console.log(`[폴링] 첫 조회에서 데이터 없음 - 폴링 시작 (${interval}ms 간격)`);
      // 데이터가 없으면 폴링 시작
      intervalRef.current = setInterval(async () => {
        const elapsed = Date.now() - (startTimeRef.current || 0);
        
        console.log(`[폴링] 폴링 중... 경과 시간: ${elapsed}ms / ${maxDuration}ms`);
        
        // 최대 시간 초과
        if (elapsed >= maxDuration) {
          console.log(`[폴링] 최대 시간 초과 (${maxDuration}ms) - 폴링 중지`);
          stopPolling();
          if (onTimeout) {
            onTimeout();
          }
          return;
        }

        const hasReport = await checkReport();
        if (hasReport) {
          console.log(`[폴링] 폴링 중 데이터 발견 - 폴링 중지`);
          stopPolling();
        }
      }, interval);
    }, startDelay);
  }, [mktUuid, startDelay, interval, maxDuration, onTimeout, checkReport, stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    isPolling,
    hasData,
    error,
    startPolling,
    stopPolling,
  };
};

