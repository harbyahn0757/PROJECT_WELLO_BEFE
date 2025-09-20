/**
 * 로딩 스피너 컴포넌트
 */
import React from 'react';
import './styles.scss';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = '데이터를 불러오는 중...',
  size = 'medium'
}) => {
  return (
    <div className={`loading-spinner loading-spinner--${size}`}>
      <div className="loading-spinner__icon">
        <div className="spinner"></div>
      </div>
      {message && (
        <div className="loading-spinner__message">
          {message}
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;
