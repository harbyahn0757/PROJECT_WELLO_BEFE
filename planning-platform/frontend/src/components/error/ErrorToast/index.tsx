/**
 * ErrorToast - 에러 토스트 알림 컴포넌트
 * 사용자 친화적인 에러 메시지를 토스트로 표시
 */
import React, { useState, useEffect } from 'react';
import { AppError, errorHandlingService } from '../../../services/ErrorHandlingService';
import './styles.scss';

interface ErrorToastProps {
  maxVisible?: number;
  autoHideDuration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  className?: string;
}

const ErrorToast: React.FC<ErrorToastProps> = ({
  maxVisible = 3,
  autoHideDuration = 5000,
  position = 'top-right',
  className = ''
}) => {
  const [errors, setErrors] = useState<AppError[]>([]);
  const [hidingErrors, setHidingErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    // 에러 서비스 구독
    const unsubscribe = errorHandlingService.subscribe((allErrors) => {
      // 사용자에게 보여줄 에러만 필터링 (최근 것부터)
      const visibleErrors = allErrors
        .filter(error => 
          error.type !== 'client' || // 클라이언트 에러는 일부만 표시
          error.code === 'NETWORK_OFFLINE' ||
          error.code === 'NETWORK_RESTORED'
        )
        .slice(0, maxVisible);
      
      setErrors(visibleErrors);
    });

    return unsubscribe;
  }, [maxVisible]);

  // 자동 숨김 처리
  useEffect(() => {
    errors.forEach(error => {
      if (hidingErrors.has(error.id)) return;

      const timer = setTimeout(() => {
        handleHideError(error.id);
      }, autoHideDuration);

      return () => clearTimeout(timer);
    });
  }, [errors, hidingErrors, autoHideDuration]);

  // 에러 숨김 처리
  const handleHideError = (errorId: string) => {
    setHidingErrors(prev => new Set(prev).add(errorId));
    
    setTimeout(() => {
      errorHandlingService.dismissError(errorId);
      setHidingErrors(prev => {
        const newSet = new Set(prev);
        newSet.delete(errorId);
        return newSet;
      });
    }, 300); // 애니메이션 시간
  };

  // 에러 액션 실행
  const handleErrorAction = (error: AppError, actionIndex: number) => {
    const actions = errorHandlingService.getRecoveryActions(error);
    if (actions[actionIndex]) {
      actions[actionIndex].action();
      handleHideError(error.id);
    }
  };

  // 에러 타입별 아이콘
  const getErrorIcon = (error: AppError) => {
    switch (error.type) {
      case 'network':
        return '🌐';
      case 'auth':
        return '🔐';
      case 'validation':
        return '⚠️';
      case 'server':
        return '🔧';
      case 'offline':
        return '📡';
      default:
        return '❌';
    }
  };

  // 에러 타입별 색상
  const getErrorColor = (error: AppError) => {
    switch (error.type) {
      case 'network':
        return 'var(--color-warning)';
      case 'auth':
        return 'var(--color-danger)';
      case 'validation':
        return 'var(--color-warning)';
      case 'server':
        return 'var(--color-danger)';
      case 'offline':
        return 'var(--color-gray-500)';
      default:
        return 'var(--color-danger)';
    }
  };

  if (errors.length === 0) return null;

  return (
    <div className={`error-toast-container error-toast-container--${position} ${className}`}>
      {errors.map((error) => {
        const isHiding = hidingErrors.has(error.id);
        const actions = errorHandlingService.getRecoveryActions(error);
        const userMessage = errorHandlingService.getUserFriendlyMessage(error);

        return (
          <div
            key={error.id}
            className={`error-toast ${isHiding ? 'error-toast--hiding' : ''}`}
            style={{ borderLeftColor: getErrorColor(error) }}
            role="alert"
            aria-live="polite"
          >
            {/* 아이콘 */}
            <div className="error-toast__icon">
              {getErrorIcon(error)}
            </div>

            {/* 내용 */}
            <div className="error-toast__content">
              <div className="error-toast__message">
                {userMessage}
              </div>
              
              {error.retryable && error.retryCount! < error.maxRetries! && (
                <div className="error-toast__retry-info">
                  재시도 {error.retryCount! + 1}/{error.maxRetries}
                </div>
              )}

              {/* 액션 버튼들 */}
              {actions.length > 0 && (
                <div className="error-toast__actions">
                  {actions.slice(0, 2).map((action, index) => (
                    <button
                      key={index}
                      className="error-toast__action-button"
                      onClick={() => handleErrorAction(error, index)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 닫기 버튼 */}
            <button
              className="error-toast__close"
              onClick={() => handleHideError(error.id)}
              aria-label="알림 닫기"
            >
              ✕
            </button>

            {/* 진행 바 */}
            <div 
              className="error-toast__progress"
              style={{ 
                animationDuration: `${autoHideDuration}ms`,
                backgroundColor: getErrorColor(error)
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default ErrorToast;
