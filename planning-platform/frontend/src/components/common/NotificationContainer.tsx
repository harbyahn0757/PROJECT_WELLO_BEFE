import React from 'react';
import { useWelloData } from '../../contexts/WelloDataContext';
import NotificationToast from './NotificationToast';

const NotificationContainer: React.FC = () => {
  const { state, actions } = useWelloData();
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
