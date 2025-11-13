import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import NotificationService from '../services/NotificationService';
import { useAuth } from "../auth/AuthContext";

// TypeScript interfaces
interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  fetchNotifications: (unreadOnly?: boolean) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<any>;
  markAllAsRead: () => Promise<any>;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { isLoggedIn, user } = useAuth();

  // Fetch notifications
  const fetchNotifications = useCallback(async (unreadOnly: boolean = false): Promise<void> => {
    if (!isLoggedIn) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await NotificationService.getNotifications(unreadOnly);
      
      if (response.success) {
        setNotifications(response.notifications || []);
        // Count unread notifications
        const unreadItems = response.notifications.filter((item: Notification) => item.is_read === 0);
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
  }, [isLoggedIn]);

  // Mark a notification as read
  const markAsRead = async (notificationId: string): Promise<any> => {
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
  const markAllAsRead = async (): Promise<any> => {
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

  // Poll for new notifications - DISABLED to reduce Workers cost
  useEffect(() => {
    if (!isLoggedIn) return;
    
    // Initial fetch only, no polling
    fetchNotifications();
    
    // Polling disabled - users can manually refresh via NotificationBell
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]); // Only depend on isLoggedIn, not fetchNotifications to avoid loop

  const value: NotificationContextType = {
    notifications, 
    unreadCount, 
    loading, 
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
