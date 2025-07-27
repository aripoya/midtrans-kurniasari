import api from '../api/api';

// TypeScript interfaces for notification service
export interface Notification {
  id: string;
  message: string;
  type: string;
  user_id: string;
  is_read: boolean;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, any>;
}

export interface NotificationResponse {
  success: boolean;
  notifications: Notification[];
  total?: number;
  page?: number;
  limit?: number;
  error?: string;
}

export interface SingleNotificationResponse {
  success: boolean;
  notification?: Notification;
  message?: string;
  error?: string;
}

export interface NotificationGetOptions {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

class NotificationService {
  /**
   * Get all notifications for the current user
   * @param unreadOnly - Only return unread notifications
   * @param page - Page number for pagination
   * @param limit - Number of notifications per page
   * @returns Promise with notification response
   */
  async getNotifications(
    unreadOnly: boolean = false, 
    page: number = 1, 
    limit: number = 50
  ): Promise<NotificationResponse> {
    try {
      const params = new URLSearchParams();
      if (unreadOnly) {
        params.append('unread', 'true');
      }
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      
      const response = await api.get(`/api/notifications?${params.toString()}`);
      return response.data as NotificationResponse;
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Get notifications with options object
   * @param options - Options object with pagination and filters
   * @returns Promise with notification response
   */
  async getNotificationsWithOptions(options: NotificationGetOptions = {}): Promise<NotificationResponse> {
    const { unreadOnly = false, page = 1, limit = 50 } = options;
    return this.getNotifications(unreadOnly, page, limit);
  }

  /**
   * Mark a single notification as read
   * @param notificationId - The ID of the notification to mark as read
   * @returns Promise with operation result
   */
  async markAsRead(notificationId: string): Promise<SingleNotificationResponse> {
    try {
      if (!notificationId) {
        throw new Error('Notification ID is required');
      }

      const response = await api.put(`/api/notifications/${notificationId}/read`);
      return response.data as SingleNotificationResponse;
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for the current user
   * @returns Promise with operation result
   */
  async markAllAsRead(): Promise<SingleNotificationResponse> {
    try {
      const response = await api.put('/api/notifications/read-all');
      return response.data as SingleNotificationResponse;
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get count of unread notifications
   * @returns Promise with unread count
   */
  async getUnreadCount(): Promise<{ count: number; success: boolean; error?: string }> {
    try {
      const response = await api.get('/api/notifications/unread-count');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching unread count:', error);
      return { count: 0, success: false, error: error.message };
    }
  }

  /**
   * Delete a notification
   * @param notificationId - The ID of the notification to delete
   * @returns Promise with operation result
   */
  async deleteNotification(notificationId: string): Promise<SingleNotificationResponse> {
    try {
      if (!notificationId) {
        throw new Error('Notification ID is required');
      }

      const response = await api.delete(`/api/notifications/${notificationId}`);
      return response.data as SingleNotificationResponse;
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Create a new notification (admin only)
   * @param notificationData - The notification data to create
   * @returns Promise with created notification
   */
  async createNotification(notificationData: {
    message: string;
    type: string;
    user_id: string;
    metadata?: Record<string, any>;
  }): Promise<SingleNotificationResponse> {
    try {
      const response = await api.post('/api/notifications', notificationData);
      return response.data as SingleNotificationResponse;
    } catch (error: any) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Type guard to check if an object is a valid Notification
   * @param obj - Object to check
   * @returns True if the object is a valid Notification
   */
  isNotification(obj: any): obj is Notification {
    return obj && 
           typeof obj.id === 'string' &&
           typeof obj.message === 'string' &&
           typeof obj.type === 'string' &&
           typeof obj.user_id === 'string' &&
           typeof obj.is_read === 'boolean' &&
           typeof obj.created_at === 'string';
  }

  /**
   * Filter notifications by type
   * @param notifications - Array of notifications to filter
   * @param type - Notification type to filter by
   * @returns Filtered array of notifications
   */
  filterByType(notifications: Notification[], type: string): Notification[] {
    return notifications.filter(notification => notification.type === type);
  }

  /**
   * Filter notifications by read status
   * @param notifications - Array of notifications to filter
   * @param isRead - Read status to filter by
   * @returns Filtered array of notifications
   */
  filterByReadStatus(notifications: Notification[], isRead: boolean): Notification[] {
    return notifications.filter(notification => notification.is_read === isRead);
  }

  /**
   * Sort notifications by creation date
   * @param notifications - Array of notifications to sort
   * @param ascending - Sort in ascending order (oldest first)
   * @returns Sorted array of notifications
   */
  sortByDate(notifications: Notification[], ascending: boolean = false): Notification[] {
    return [...notifications].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return ascending ? dateA - dateB : dateB - dateA;
    });
  }
}

export default new NotificationService();
