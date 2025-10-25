/**
 * 세션 상태 모달 컴포넌트
 * 세션 유효성 확인 중 표시되는 로딩 화면
 */
import React, { useState, useEffect } from 'react';
import './styles.scss';

interface SessionStatusModalProps {
  isOpen: boolean;
  sessionExpiresAt?: string; // ISO 문자열
  onComplete: () => void;
}

const SessionStatusModal: React.FC<SessionStatusModalProps> = ({
  isOpen,
  sessionExpiresAt,
  onComplete
}) => {
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [progress, setProgress] = useState(0);

  // 남은 시간 계산 및 업데이트
  useEffect(() => {
    if (!isOpen || !sessionExpiresAt) return;

    const updateRemainingTime = () => {
      const now = new Date();
      const expiresAt = new Date(sessionExpiresAt);
      const diffMs = expiresAt.getTime() - now.getTime();

      if (diffMs <= 0) {
        setRemainingTime('만료됨');
        setProgress(0);
        return;
      }

      const minutes = Math.floor(diffMs / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      
      setRemainingTime(`${minutes}분 ${seconds}초`);
      
      // 5분 기준으로 진행률 계산 (5분 = 300초)
      const totalSeconds = 5 * 60;
      const remainingSeconds = Math.floor(diffMs / 1000);
      const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / totalSeconds) * 100));
      setProgress(progressPercent);
    };

    // 즉시 실행
    updateRemainingTime();

    // 1초마다 업데이트
    const interval = setInterval(updateRemainingTime, 1000);

    return () => clearInterval(interval);
  }, [isOpen, sessionExpiresAt]);

  // 2초 후 자동 완료
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      onComplete();
    }, 2000);

    return () => clearTimeout(timer);
  }, [isOpen, onComplete]);

  if (!isOpen) return null;

  return (
    <div className="session-status-overlay">
      <div className="session-status-modal">
        {/* 웰로 아이콘 (깜박이는 효과) */}
        <div className="session-status-icon">
          <img 
            src="/wello/wello-icon.png" 
            alt="웰로 아이콘" 
            className="wello-icon-blink"
          />
        </div>

        {/* 상태 메시지 */}
        <div className="session-status-content">
          <h3 className="session-status-title">인증 확인 중</h3>
          <p className="session-status-subtitle">
            기존 세션을 확인하고 있습니다
          </p>
          
          {remainingTime && (
            <div className="session-status-time">
              <p className="time-label">세션 유효시간</p>
              <p className="time-value">{remainingTime}</p>
            </div>
          )}

          {/* 진행률 바 */}
          <div className="session-progress-container">
            <div className="session-progress-bar">
              <div 
                className="session-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="session-progress-text">{Math.round(progress)}%</p>
          </div>
        </div>

        {/* 로딩 스피너 */}
        <div className="session-status-spinner">
          <div className="spinner-ring"></div>
        </div>
      </div>
    </div>
  );
};

export default SessionStatusModal;
