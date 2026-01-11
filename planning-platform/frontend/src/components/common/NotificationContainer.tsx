import React from 'react';
import { useWelnoData } from '../../contexts/WelnoDataContext';
import NotificationToast from './NotificationToast';

const NotificationContainer: React.FC = () => {
  const { state, actions } = useWelnoData();
  const { notifications } = state;
  const { removeNotification } = actions;

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onClose={removeNotification}
        />
      ))}
    </div>
  );
};

export default NotificationContainer;
