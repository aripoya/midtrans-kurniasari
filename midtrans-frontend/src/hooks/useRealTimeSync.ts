import { useState, useEffect, useCallback, useRef } from "react";

// API Base URL configuration - Production backend only to prevent authentication conflicts
const API_BASE_URL =
  "https://order-management-app-production.wahwooh.workers.dev";

// TypeScript interfaces for type safety
export interface SyncStatus {
  connected: boolean;
  lastSync: string | null;
  error: string | null;
}

export interface UpdateInfo {
  timestamp: string;
  role: UserRole;
  type: "data_update";
}

export interface Notification {
  id: string;
  message: string;
  created_at: string;
  is_read: boolean;
  user_id: string;
  type?: string;
}

export type UserRole = "admin" | "outlet" | "deliveryman" | "public";

export interface UseRealTimeSyncOptions {
  role?: UserRole;
  onUpdate?: ((updateInfo: UpdateInfo) => void) | null;
  pollingInterval?: number;
  enabled?: boolean;
}

export interface UseRealTimeSyncReturn {
  lastUpdate: string | null;
  isPolling: boolean;
  syncStatus: SyncStatus;
  manualRefresh: () => void;
  forceUpdate: () => void;
}

export interface UseNotificationSyncOptions {
  userId?: string;
  onNewNotification?: ((notifications: Notification[]) => void) | null;
  pollingInterval?: number;
}

export interface UseNotificationSyncReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Custom hook for real-time synchronization across all user roles
 * Polls for updates and triggers data refresh when changes are detected
 */
export const useRealTimeSync = ({
  role = "admin",
  onUpdate = null,
  pollingInterval = 60000, // Default 60 seconds (1 minute) - optimized for cost efficiency
  enabled = true,
}: UseRealTimeSyncOptions = {}): UseRealTimeSyncReturn => {
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    connected: false,
    lastSync: null,
    error: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<string | null>(null);

  type LastUpdateResponse = {
    success: boolean;
    lastUpdate: string; // ISO string
  };

  const checkForUpdates = useCallback(async (): Promise<void> => {
    if (!enabled) return;

    setIsPolling(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/sync/last-update`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: LastUpdateResponse = await response.json();

      if (!data.success) {
        throw new Error("Server returned success=false");
      }

      const serverLastUpdate = data.lastUpdate;

      const serverTs = new Date(serverLastUpdate).getTime();
      const localTs = lastUpdateRef.current
        ? new Date(lastUpdateRef.current).getTime()
        : 0;

      // First time: just store it
      if (lastUpdateRef.current === null) {
        lastUpdateRef.current = serverLastUpdate;
        setLastUpdate(serverLastUpdate);
      }
      // Newer data on server
      else if (serverTs > localTs) {
        console.log("SYNC: New updates detected, triggering refresh");
        lastUpdateRef.current = serverLastUpdate;
        setLastUpdate(serverLastUpdate);

        onUpdate?.({
          timestamp: serverLastUpdate,
          role,
          type: "data_update",
        });
      }

      setSyncStatus({
        connected: true,
        lastSync: new Date().toISOString(),
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("SYNC: Error checking for updates:", message);

      setSyncStatus({
        connected: false,
        lastSync: new Date().toISOString(),
        error: message,
      });
    } finally {
      setIsPolling(false);
    }
  }, [enabled, role]);

  // Start/stop polling
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial check
    checkForUpdates();

    // Set up polling interval
    intervalRef.current = setInterval(checkForUpdates, pollingInterval);

    // Cleanup interval on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkForUpdates, pollingInterval, enabled]);

  // Manual refresh function
  const manualRefresh = useCallback((): void => {
    checkForUpdates();
  }, [checkForUpdates]);

  // Force update function (resets last update timestamp)
  const forceUpdate = useCallback((): void => {
    lastUpdateRef.current = null;
    checkForUpdates();
  }, [checkForUpdates]);

  return {
    lastUpdate,
    isPolling,
    syncStatus,
    manualRefresh,
    forceUpdate,
  };
};

/**
 * Hook specifically for notifications real-time sync
 */
export const useNotificationSync = ({
  userId,
  onNewNotification = null,
  pollingInterval = 60000, // Default 60 seconds (1 minute) - optimized for cost efficiency
}: UseNotificationSyncOptions): UseNotificationSyncReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<Date | null>(null);

  const checkNotifications = useCallback(async (): Promise<void> => {
    if (!userId) return;

    try {
      setIsLoading(true);

      const token =
        sessionStorage.getItem("token") || sessionStorage.getItem("adminToken");
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/notifications`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.notifications) {
        const newNotifications: Notification[] = data.notifications;
        const newUnreadCount = newNotifications.filter(
          (n) => !n.is_read
        ).length;

        // Check if there are new notifications since last check
        if (lastCheckRef.current && newUnreadCount > unreadCount) {
          const newOnes = newNotifications.filter(
            (n) => !n.is_read && new Date(n.created_at) > lastCheckRef.current!
          );

          if (newOnes.length > 0 && onNewNotification) {
            onNewNotification(newOnes);
          }
        }

        setNotifications(newNotifications);
        setUnreadCount(newUnreadCount);
        lastCheckRef.current = new Date();
      }
    } catch (error: any) {
      console.error("NOTIFICATION SYNC: Error checking notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, onNewNotification, unreadCount]);

  useEffect(() => {
    if (!userId) return;

    // Initial check
    checkNotifications();

    // Set up polling
    intervalRef.current = setInterval(checkNotifications, pollingInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkNotifications, pollingInterval, userId]);

  const markAsRead = useCallback(
    async (notificationId: string): Promise<void> => {
      try {
        const token =
          sessionStorage.getItem("token") ||
          sessionStorage.getItem("adminToken");
        if (!token) return;

        const response = await fetch(
          `${API_BASE_URL}/api/notifications/${notificationId}/read`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          // Refresh notifications after marking as read
          await checkNotifications();
        }
      } catch (error: any) {
        console.error("Error marking notification as read:", error);
      }
    },
    [checkNotifications]
  );

  const markAllAsRead = useCallback(async (): Promise<void> => {
    try {
      const token =
        sessionStorage.getItem("token") || sessionStorage.getItem("adminToken");
      if (!token) return;

      const response = await fetch(
        `${API_BASE_URL}/api/notifications/read-all`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        await checkNotifications();
      }
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
    }
  }, [checkNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh: checkNotifications,
  };
};

export default useRealTimeSync;
