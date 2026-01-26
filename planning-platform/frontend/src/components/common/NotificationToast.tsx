import React, { useState, useEffect } from 'react';
import { NotificationMessage } from '../../contexts/WelnoDataContext';
import './NotificationToast.scss';

interface NotificationToastProps {
  notification: NotificationMessage;
  onClose: (id: string) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
  const { id, type, title, message, action } = notification;
  const [isClosing, setIsClosing] = useState(false);

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

  const handleClose = () => {
    setIsClosing(true);
    // 애니메이션 완료 후 실제 제거
    setTimeout(() => {
      onClose(id);
    }, 600); // fade-out 애니메이션 시간과 동일
  };

  // autoClose가 true이고 duration이 있으면 자동으로 닫기
  useEffect(() => {
    if (notification.autoClose && notification.duration) {
      const timer = setTimeout(() => {
        setIsClosing(true);
        setTimeout(() => {
          onClose(id);
        }, 600);
      }, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [notification.autoClose, notification.duration, id, onClose]);

  return (
    <div className={`notification-toast notification-toast--${type} ${isClosing ? 'notification-toast--closing' : ''}`}>
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
        onClick={handleClose}
        aria-label="알림 닫기"
      >
        ×
      </button>
    </div>
  );
};

export default NotificationToast;
