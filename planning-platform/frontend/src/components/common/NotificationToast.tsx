import React from 'react';
import { NotificationMessage } from '../../contexts/WelnoDataContext';
import './NotificationToast.scss';

interface NotificationToastProps {
  notification: NotificationMessage;
  onClose: (id: string) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
  const { id, type, title, message, action } = notification;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className={`notification-toast notification-toast--${type}`}>
      <div className="notification-toast__icon">
        {getIcon()}
      </div>
      
      <div className="notification-toast__content">
        <div className="notification-toast__title">
          {title}
        </div>
        <div className="notification-toast__message">
          {message}
        </div>
        
        {action && (
          <div className="notification-toast__actions">
            <button 
              className="notification-toast__action-button"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          </div>
        )}
      </div>
      
      <button 
        className="notification-toast__close"
        onClick={() => onClose(id)}
        aria-label="알림 닫기"
      >
        ×
      </button>
    </div>
  );
};

export default NotificationToast;
