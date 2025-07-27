import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import NotificationService from '../services/NotificationService';
import { useAuth } from "../auth/AuthContext";

export const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isAuthenticated, user } = useAuth();

  // Fetch notifications
  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await NotificationService.getNotifications(unreadOnly);
      
      if (response.success) {
        setNotifications(response.data || []);
        // Count unread notifications
        const unreadItems = response.data.filter(item => item.is_read === 0);
        setUnreadCount(unreadItems.length);
      } else {
        setError(response.error || 'Failed to fetch notifications');
      }
    } catch (err) {
      setError('Error fetching notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Mark a notification as read
  const markAsRead = async (notificationId) => {
    try {
      const response = await NotificationService.markAsRead(notificationId);
      if (response.success) {
        // Update local state
        setNotifications(prevNotifications => 
          prevNotifications.map(notification => 
            notification.id === notificationId 
              ? { ...notification, is_read: 1 } 
              : notification
          )
        );
        // Decrement unread count
        setUnreadCount(prevCount => Math.max(0, prevCount - 1));
      }
      return response;
    } catch (err) {
      console.error('Error marking notification as read:', err);
      throw err;
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const response = await NotificationService.markAllAsRead();
      if (response.success) {
        // Update local state
        setNotifications(prevNotifications => 
          prevNotifications.map(notification => ({ ...notification, is_read: 1 }))
        );
        // Reset unread count
        setUnreadCount(0);
      }
      return response;
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      throw err;
    }
  };

  // Poll for new notifications every minute when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Initial fetch
    fetchNotifications();
    
    // Set up polling
    const pollingInterval = setInterval(() => {
      fetchNotifications();
    }, 60000); // 1 minute
    
    return () => {
      clearInterval(pollingInterval);
    };
  }, [isAuthenticated, fetchNotifications]);

  return (
    <NotificationContext.Provider 
      value={{ 
        notifications, 
        unreadCount, 
        loading, 
        error,
        fetchNotifications,
        markAsRead,
        markAllAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
