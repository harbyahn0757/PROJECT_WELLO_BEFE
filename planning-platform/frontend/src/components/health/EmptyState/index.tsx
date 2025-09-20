/**
 * 빈 상태 컴포넌트
 */
import React from 'react';
import './styles.scss';

interface EmptyStateProps {
  message: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  description,
  actionText,
  onAction,
  icon = '📋'
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        {icon}
      </div>
      
      <div className="empty-state__content">
        <h3 className="empty-state__message">
          {message}
        </h3>
        
        {description && (
          <p className="empty-state__description">
            {description}
          </p>
        )}
      </div>
      
      {actionText && onAction && (
        <div className="empty-state__action">
          <button 
            className="empty-state__button"
            onClick={onAction}
          >
            {actionText}
          </button>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
