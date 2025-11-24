/**
 * NotificationCenter - 알림 센터 컴포넌트
 * 모바일 친화적인 알림 목록 및 관리 UI
 */
import React, { useState, useEffect } from 'react';
import { HealthNotification, notificationService } from '../../../services/NotificationService';
import './styles.scss';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  className = ''
}) => {
  const [notifications, setNotifications] = useState<HealthNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    // 알림 서비스 구독
    const unsubscribe = notificationService.subscribe(setNotifications);
    
    // 초기 알림 로드
    setNotifications(notificationService.getNotifications());

    return unsubscribe;
  }, []);

  // 필터링된 알림
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') {
      return !notification.readAt;
    }
    return true;
  });

  // 알림 클릭 핸들러
  const handleNotificationClick = (notification: HealthNotification) => {
    // 읽음 처리
    if (!notification.readAt) {
      notificationService.markAsRead(notification.id);
    }

    // 액션 URL이 있으면 이동
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
      onClose();
    }
  };

  // 알림 삭제 핸들러
  const handleDeleteNotification = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    notificationService.deleteNotification(notificationId);
  };

  // 모든 알림 읽음 처리
  const handleMarkAllAsRead = () => {
    notificationService.markAllAsRead();
  };

  // 모든 알림 삭제
  const handleClearAll = () => {
    if (window.confirm('모든 알림을 삭제하시겠어요?')) {
      notificationService.clearAllNotifications();
    }
  };

  // 우선순위별 아이콘
  const getPriorityIcon = (priority: HealthNotification['priority']) => {
    switch (priority) {
      case 'urgent':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return '📢';
      case 'low':
        return '💡';
      default:
        return '📋';
    }
  };

  // 타입별 색상
  const getTypeColor = (type: HealthNotification['type']) => {
    switch (type) {
      case 'checkup_reminder':
        return 'var(--color-primary)';
      case 'abnormal_value':
        return 'var(--color-danger)';
      case 'medication_reminder':
        return 'var(--color-warning)';
      case 'health_tip':
        return 'var(--color-success)';
      case 'system':
        return 'var(--color-gray-500)';
      default:
        return 'var(--color-gray-500)';
    }
  };

  // 시간 포맷팅
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 오버레이 */}
      <div 
        className="notification-center-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 알림 센터 */}
      <div className={`notification-center ${className}`}>
        {/* 헤더 */}
        <div className="notification-center__header">
          <div className="header-title">
            <h2>알림</h2>
            <span className="notification-count">
              {notifications.length}개
            </span>
          </div>
          
          <div className="header-actions">
            {/* 필터 버튼 */}
            <div className="filter-buttons">
              <button
                className={`filter-button ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                전체
              </button>
              <button
                className={`filter-button ${filter === 'unread' ? 'active' : ''}`}
                onClick={() => setFilter('unread')}
              >
                읽지 않음 ({notifications.filter(n => !n.readAt).length})
              </button>
            </div>

            <button
              className="close-button"
              onClick={onClose}
              aria-label="알림 센터 닫기"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 액션 버튼들 */}
        {notifications.length > 0 && (
          <div className="notification-center__actions">
            <button
              className="action-button"
              onClick={handleMarkAllAsRead}
              disabled={notifications.every(n => n.readAt)}
            >
              모두 읽음
            </button>
            <button
              className="action-button action-button--danger"
              onClick={handleClearAll}
            >
              모두 삭제
            </button>
          </div>
        )}

        {/* 알림 목록 */}
        <div className="notification-center__content">
          {filteredNotifications.length === 0 ? (
            <div className="empty-notifications">
              <div className="empty-icon">🔔</div>
              <h3>
                {filter === 'unread' ? '읽지 않은 알림이 없습니다' : '알림이 없습니다'}
              </h3>
              <p>
                {filter === 'unread' 
                  ? '모든 알림을 확인했습니다.' 
                  : '새로운 알림이 있으면 여기에 표시됩니다.'
                }
              </p>
            </div>
          ) : (
            <div className="notification-list">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.readAt ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNotificationClick(notification);
                    }
                  }}
                >
                  {/* 우선순위 표시 */}
                  <div 
                    className="notification-priority"
                    style={{ color: getTypeColor(notification.type) }}
                  >
                    {getPriorityIcon(notification.priority)}
                  </div>

                  {/* 알림 내용 */}
                  <div className="notification-content">
                    <div className="notification-header">
                      <h4 className="notification-title">
                        {notification.title}
                      </h4>
                      <span className="notification-time">
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    
                    <p className="notification-message">
                      {notification.message}
                    </p>

                    {notification.actionLabel && (
                      <div className="notification-action">
                        <span className="action-label">
                          {notification.actionLabel} →
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 삭제 버튼 */}
                  <button
                    className="notification-delete"
                    onClick={(e) => handleDeleteNotification(e, notification.id)}
                    aria-label="알림 삭제"
                  >
                    ✕
                  </button>

                  {/* 읽지 않음 표시 */}
                  {!notification.readAt && (
                    <div className="unread-indicator" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationCenter;
