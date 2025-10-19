/**
 * NotificationBell - 알림 벨 아이콘 컴포넌트
 * 헤더나 네비게이션에서 사용할 알림 버튼
 */
import React, { useState, useEffect } from 'react';
import { notificationService } from '../../../services/NotificationService';
import NotificationCenter from '../NotificationCenter';
import './styles.scss';

interface NotificationBellProps {
  className?: string;
  showBadge?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  className = '',
  showBadge = true,
  size = 'medium'
}) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);

  useEffect(() => {
    // 알림 서비스 구독
    const unsubscribe = notificationService.subscribe((notifications) => {
      const newUnreadCount = notifications.filter(n => !n.readAt).length;
      
      // 새 알림이 있으면 애니메이션 트리거
      if (newUnreadCount > unreadCount) {
        setHasNewNotification(true);
        setTimeout(() => setHasNewNotification(false), 1000);
      }
      
      setUnreadCount(newUnreadCount);
    });

    // 초기 읽지 않은 알림 수 설정
    setUnreadCount(notificationService.getUnreadCount());

    return unsubscribe;
  }, [unreadCount]);

  // 알림 센터 토글
  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  // 알림 센터 닫기
  const handleClose = () => {
    setIsOpen(false);
  };

  // 키보드 이벤트 핸들러
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <>
      <button
        className={`notification-bell notification-bell--${size} ${hasNewNotification ? 'notification-bell--animate' : ''} ${className}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-label={`알림 ${unreadCount > 0 ? `(${unreadCount}개의 읽지 않은 알림)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {/* 벨 아이콘 */}
        <div className="bell-icon">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M12 2C13.1 2 14 2.9 14 4C14 4.1 14 4.2 14 4.3C16.3 5.2 18 7.4 18 10V16L20 18V19H4V18L6 16V10C6 7.4 7.7 5.2 10 4.3C10 4.2 10 4.1 10 4C10 2.9 10.9 2 12 2ZM10 21C10 22.1 10.9 23 12 23C13.1 23 14 22.1 14 21H10Z"
              fill="currentColor"
            />
          </svg>
        </div>

        {/* 배지 */}
        {showBadge && unreadCount > 0 && (
          <div className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}

        {/* 새 알림 표시 점 */}
        {hasNewNotification && (
          <div className="new-notification-dot" />
        )}
      </button>

      {/* 알림 센터 */}
      <NotificationCenter
        isOpen={isOpen}
        onClose={handleClose}
      />
    </>
  );
};

export default NotificationBell;
