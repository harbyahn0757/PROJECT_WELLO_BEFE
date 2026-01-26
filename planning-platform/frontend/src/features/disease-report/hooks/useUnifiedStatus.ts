/**
 * useUnifiedStatus Hook
 * 
 * 백엔드의 통합 상태 API를 호출하여 사용자의 전체 상태를 관리
 * - 약관 동의 여부
 * - 데이터 수집 상태
 * - 리포트 생성 상태
 * - 결제 상태
 * - 데이터 출처 정보
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// 데이터 출처 개별 타입
export interface UnifiedStatusDataSource {
  count: number;
  last_synced_at: string | null;
}

export interface UnifiedStatus {
  status: string;
  action?: string;
  
  // 데이터 출처
  data_sources: {
    tilko: UnifiedStatusDataSource;
    indexeddb: UnifiedStatusDataSource;
    partner: UnifiedStatusDataSource;
  };
  primary_source: string | null;
  
  // 데이터 상태
  has_checkup_data: boolean;
  has_prescription_data: boolean;
  has_report: boolean;
  has_payment: boolean;
  requires_payment: boolean;
  metric_count: number;
  is_sufficient: boolean;
  total_checkup_count: number;
  prescription_count: number;
  
  // 약관 상태
  terms_agreed: boolean;
  terms_agreed_at: string | null;
  terms_details: Record<string, boolean>;
  missing_terms: string[];
  
  // 기타
  case_id?: string;
  redirect_url?: string;
}

interface UseUnifiedStatusOptions {
  autoFetch?: boolean;
  pollInterval?: number; // 0이면 폴링 안함
  onStatusChange?: (status: UnifiedStatus) => void;
}

interface UseUnifiedStatusReturn {
  status: UnifiedStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUnifiedStatus(
  uuid: string | null,
  hospitalId: string,
  partnerId?: string | null,
  options: UseUnifiedStatusOptions = {}
): UseUnifiedStatusReturn {
  const {
    autoFetch = true,
    pollInterval = 0,
    onStatusChange
  } = options;

  const [status, setStatus] = useState<UnifiedStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!uuid) {
      console.warn('[useUnifiedStatus] UUID 없음, 조회 건너뜀');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        uuid,
        hospital_id: hospitalId,
      });
      
      if (partnerId) {
        params.append('partner_id', partnerId);
      }

      console.log(`[useUnifiedStatus] 상태 조회 중: uuid=${uuid}, hospital=${hospitalId}, partner=${partnerId || 'none'}`);

      const response = await fetch(`/api/v1/welno/user-status?${params}`);
      const data = await response.json();

      if (data.success !== false && data.status) {
        console.log(`[useUnifiedStatus] ✅ 상태 조회 성공:`, {
          status: data.status,
          terms: data.terms_agreed,
          data: data.has_checkup_data,
          report: data.has_report
        });

        setStatus(data);

        // 전역 이벤트 발생 (FloatingButton, 다른 컴포넌트용)
        window.dispatchEvent(new CustomEvent('unified-status-change', {
          detail: data
        }));

        // 콜백 실행
        if (onStatusChange) {
          onStatusChange(data);
        }
      } else {
        const errMsg = data.message || '상태 조회 실패';
        console.error(`[useUnifiedStatus] ❌ 상태 조회 실패:`, errMsg);
        setError(errMsg);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error(`[useUnifiedStatus] ❌ 네트워크 오류:`, err);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [uuid, hospitalId, partnerId, onStatusChange]);

  // 초기 로드
  useEffect(() => {
    if (autoFetch && uuid) {
      fetchStatus();
    }
  }, [autoFetch, uuid, fetchStatus]);

  // 폴링 설정
  useEffect(() => {
    // 기존 폴링 정리
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // 폴링 시작 (REPORT_PENDING 상태일 때만 유용)
    if (pollInterval > 0 && uuid && status?.status === 'REPORT_PENDING') {
      console.log(`[useUnifiedStatus] 폴링 시작: ${pollInterval}ms`);
      pollIntervalRef.current = setInterval(fetchStatus, pollInterval);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [pollInterval, uuid, status?.status, fetchStatus]);

  return {
    status,
    loading,
    error,
    refetch: fetchStatus
  };
}
