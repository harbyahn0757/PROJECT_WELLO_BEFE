import React, { useEffect, useRef, useState } from 'react';
import { useDemoMode } from '../hooks/useDemoMode';
import './DemoBanner.scss';

const DemoBanner: React.FC = () => {
  const isEmbed = new URLSearchParams(window.location.search).has('api_key');
  const { formattedRemaining, isExpired, remainingSeconds } = useDemoMode(10);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toastVisible, setToastVisible] = useState(true);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // 초기 토스트 자동 숨김 (4초)
  useEffect(() => {
    if (!isEmbed) return;
    const timer = setTimeout(() => setToastVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [isEmbed]);

  // 만료 시 카운트다운 + 리디렉트
  useEffect(() => {
    if (!isExpired || !isEmbed) return;
    setToastVisible(true);
    setRedirectCountdown(5);

    const countdownInterval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    redirectTimerRef.current = setTimeout(() => {
      try {
        // iframe 내부에서 top 접근 시 cross-origin 에러 방지
        window.top?.location.assign('/backoffice/login');
      } catch {
        window.location.assign('/backoffice/login');
      }
    }, 5000);

    return () => {
      clearInterval(countdownInterval);
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, [isExpired, isEmbed]);

  if (!isEmbed) return null;

  return (
    <>
      {/* 토스트 알림 (초기 안내 / 만료 안내) */}
      {toastVisible && (
        <div className={`demo-toast ${isExpired ? 'demo-toast--expired' : ''}`}>
          {isExpired ? (
            <>
              <span className="demo-toast__text">
                세션이 만료되었습니다 — {redirectCountdown}초 후 로그인 페이지로 이동
              </span>
            </>
          ) : (
            <>
              <span className="demo-toast__text">
                데모 모드 — <strong>10분간</strong> 체험 가능합니다
              </span>
              <button
                className="demo-toast__close"
                onClick={() => setToastVisible(false)}
              >
                &times;
              </button>
            </>
          )}
        </div>
      )}

      {/* 남은 시간 뱃지 (항상 표시) */}
      {!isExpired && (
        <div className={`demo-badge ${remainingSeconds <= 60 ? 'demo-badge--urgent' : ''}`}>
          데모 · {formattedRemaining}
        </div>
      )}
    </>
  );
};

export default DemoBanner;
