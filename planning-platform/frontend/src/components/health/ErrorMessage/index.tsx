/**
 * 에러 메시지 컴포넌트
 */
import React from 'react';
import './styles.scss';

interface ErrorMessageProps {
  message: string;
  details?: string;
  onRetry?: () => void;
  onBack?: () => void;
  type?: 'error' | 'warning' | 'info';
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  details,
  onRetry,
  onBack,
  type = 'error'
}) => {
  return (
    <div className={`error-message error-message--${type}`}>
      <div className="error-message__icon">
        {type === 'error' && '⚠️'}
        {type === 'warning' && '⚡'}
        {type === 'info' && 'ℹ️'}
      </div>
      
      <div className="error-message__content">
        <h3 className="error-message__title">
          {type === 'error' && '오류가 발생했습니다'}
          {type === 'warning' && '주의가 필요합니다'}
          {type === 'info' && '안내'}
        </h3>
        
        <p className="error-message__text">
          {message}
        </p>
        
        {details && (
          <details className="error-message__details">
            <summary>자세한 정보</summary>
            <pre>{details}</pre>
          </details>
        )}
      </div>
      
      <div className="error-message__actions">
        {onRetry && (
          <button 
            className="error-message__button error-message__button--primary"
            onClick={onRetry}
          >
            다시 시도
          </button>
        )}
        
        {onBack && (
          <button 
            className="error-message__button error-message__button--secondary"
            onClick={onBack}
          >
            이전으로
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
