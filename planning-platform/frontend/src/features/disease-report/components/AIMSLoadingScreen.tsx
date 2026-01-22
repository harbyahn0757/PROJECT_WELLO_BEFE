import React, { useState, useEffect } from 'react';
import welnoLogo from '../assets/images/welno_logo 2.png';
import '../styles/aims-loading.scss';

interface AIMSLoadingScreenProps {
  customerName: string | null;
  onComplete?: () => void;
  hasError?: boolean; // 에러 상태 추가
}

const LOADING_MESSAGES = [
  '누구님의 데이터를 암호화 중입니다.',
  '암호화 서버에 전송중입니다.',
  '코호트 데이터와 누구님을 비교하여 건강나이를 계산중입니다.',
  '등수를 추출 중입니다.',
  '발병확률 계산중입니다.',
];

export const AIMSLoadingScreen: React.FC<AIMSLoadingScreenProps> = ({
  customerName,
  onComplete,
  hasError = false,
}) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);

  useEffect(() => {
    // 에러 상태면 메시지 표시 안 함
    if (hasError) {
      return;
    }
    
    // 각 메시지 1.2초씩 표시 (총 6초)
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => {
        if (prev < LOADING_MESSAGES.length - 1) {
          return prev + 1;
        } else {
          // 마지막 메시지 후 카운트다운 시작
          clearInterval(messageInterval);
          setShowCountdown(true);
          setCountdown(5);
          return prev;
        }
      });
    }, 1200); // 1.2초

    return () => clearInterval(messageInterval);
  }, [hasError]);

  // 카운트다운 처리
  useEffect(() => {
    if (!showCountdown || countdown === null) {
      return;
    }

    if (countdown <= 0) {
      // 카운트다운 완료 후 콜백 호출
      if (onComplete) {
        onComplete();
      }
      return;
    }

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000); // 1초 간격

    return () => clearInterval(countdownInterval);
  }, [showCountdown, countdown, onComplete]);

  // 에러 상태일 때 자동으로 랜딩 화면으로 이동 (3초 후)
  useEffect(() => {
    if (hasError && onComplete) {
      const errorTimer = setTimeout(() => {
        onComplete();
      }, 3000); // 3초 후 랜딩 화면으로 이동
      
      return () => clearTimeout(errorTimer);
    }
  }, [hasError, onComplete]);

  const currentMessage = LOADING_MESSAGES[currentMessageIndex]?.replace(
    '누구님',
    customerName ? `${customerName}님` : '고객'
  ) || '';

  return (
    <div className={`aims-loading-screen ${hasError ? 'error-mode' : ''}`}>
      <div className="aims-loading-content">
        <div className="aims-loading-spinner">
          {hasError ? (
            <img src={welnoLogo} alt="웰노 로고" className="blinking-icon" />
          ) : showCountdown && countdown !== null ? (
            <div key={countdown} className="countdown-number">{countdown}</div>
          ) : (
            <img src={welnoLogo} alt="웰노 로고" className="blinking-icon" />
          )}
        </div>
        {hasError ? (
          <div className="aims-loading-message error-message">
            <p className="error-message-primary">
              리포트 생성 중 일시적인 오류가 발생했습니다.
            </p>
            <p className="error-message-secondary">
              잠시 후 다시 시도 해주세요
            </p>
          </div>
        ) : (
        <p className="aims-loading-message">
          {showCountdown && countdown !== null 
            ? '리포트 페이지로 이동합니다...' 
            : currentMessage}
        </p>
        )}
        {!hasError && (
        <div className="aims-loading-progress">
          <div 
            className="aims-loading-progress-bar"
            style={{ 
              width: showCountdown 
                ? '100%' 
                : `${((currentMessageIndex + 1) / LOADING_MESSAGES.length) * 100}%` 
            }}
          ></div>
        </div>
        )}
      </div>
    </div>
  );
};


