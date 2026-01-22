import React, { useEffect, useState, useCallback } from 'react';
import { useCampaignSkin } from '../hooks/useCampaignSkin';
import { trackLoading } from '../utils/gtm';
import { getMktUuidFromUrl } from '../utils/legacyCompat';
import welnoLogo from '../assets/images/welno_logo 2.png';
import '../styles/report-generation-waiting-modal.scss';

interface ReportGenerationWaitingModalProps {
  isOpen: boolean;
  requestTime: string | null; // 리포트 생성 요청 시간 (ISO 형식)
  onClose?: () => void;
}

export const ReportGenerationWaitingModal: React.FC<ReportGenerationWaitingModalProps> = ({
  isOpen,
  requestTime,
  onClose,
}) => {
  const { skinType, skinConfig } = useCampaignSkin();
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // 카운트다운 계산 및 업데이트
  const updateCountdown = useCallback(() => {
    if (!requestTime) {
      setRemainingMinutes(null);
      setRemainingSeconds(0);
      return;
    }

    const requestTimeDate = new Date(requestTime);
    const now = new Date();
    const elapsedMs = now.getTime() - requestTimeDate.getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);
    const remainingMs = 10 * 60 * 1000 - elapsedMs; // 10분 = 600,000ms

    if (remainingMs <= 0) {
      // 10분 지남: 모달 닫기 (문진 패널 표시를 위해)
      setRemainingMinutes(0);
      setRemainingSeconds(0);
      
      // 로딩 타임아웃 추적
      trackLoading('loading_timeout', {
        mkt_uuid: getMktUuidFromUrl() || null,
        elapsed_minutes: 10
      });
      
      if (onClose) {
        console.log('⏰ 10분 경과 - 모달 닫기 (문진 패널 표시)');
        onClose();
      }
      return;
    }

    const minutes = Math.floor(remainingMs / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

    setRemainingMinutes(minutes);
    setRemainingSeconds(seconds);
  }, [requestTime, onClose]);

  // 카운트다운 업데이트 (1초마다)
  useEffect(() => {
    if (!isOpen || !requestTime) {
      return;
    }

    // 로딩 시작 추적
    trackLoading('loading_start', {
      mkt_uuid: getMktUuidFromUrl() || null,
      request_time: requestTime
    });

    // 즉시 한 번 실행
    updateCountdown();

    // 1초마다 업데이트
    const interval = setInterval(() => {
      updateCountdown();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isOpen, requestTime, updateCountdown]);

  if (!isOpen) return null;

  // 요청 시간 포맷팅
  const formatRequestTime = (timeString: string | null): string => {
    if (!timeString) return '알 수 없음';
    
    try {
      const date = new Date(timeString);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
    } catch (e) {
      console.warn('시간 포맷팅 실패:', e);
      return timeString;
    }
  };

  return (
    <div className="report-generation-waiting-modal-overlay">
      <div className={`report-generation-waiting-modal skin-${skinType.toLowerCase()}`}>
        <div className="modal-header">
          <h2 className="modal-title">레포트 생성 대기중입니다</h2>
          {onClose && (
            <button className="modal-close-button" onClick={onClose} type="button">
              ×
            </button>
          )}
        </div>
        
        <div className="modal-content">
          <div className="waiting-icon">
            <img src={welnoLogo} alt="웰노 로고" className="blinking-icon" />
          </div>
          
          <p className="modal-description">
            레포트가 곧 고객님의<br />
            알림톡으로 발송될 예정이 오니<br />
            잠시만 기다려주시가 바랍니다.
          </p>
          
          {/* 카운트다운 표시 */}
          {remainingMinutes !== null && (
            <div className="countdown-display">
              <div className="countdown-label">남은 시간</div>
              <div className="countdown-value">
                {remainingMinutes > 0 ? (
                  <span className="countdown-time">
                    {remainingMinutes}분 {remainingSeconds}초
                  </span>
                ) : remainingSeconds > 0 ? (
                  <span className="countdown-time">
                    {remainingSeconds}초
                  </span>
                ) : (
                  <span className="countdown-time expired">시간 초과</span>
                )}
              </div>
            </div>
          )}
          
          {requestTime && (
            <div className="request-time-info">
              <span className="request-time-label">생성 요청 시간:</span>
              <span className="request-time-value">{formatRequestTime(requestTime)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

