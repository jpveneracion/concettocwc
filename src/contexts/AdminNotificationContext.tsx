// src/contexts/AdminNotificationContext.tsx

'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { AdminNotifications } from '@/types/admin';

interface AdminNotificationContextType {
  notifications: AdminNotifications;
  refreshNotifications: () => Promise<void>;
}

const AdminNotificationContext = createContext<AdminNotificationContextType | undefined>(undefined);

interface AdminNotificationProviderProps {
  children: ReactNode;
}

export function AdminNotificationProvider({ children }: AdminNotificationProviderProps) {
  const [notifications, setNotifications] = useState<AdminNotifications>({
    pendingApprovals: 0,
    systemAlerts: [],
    unreadCount: 0,
  });

  const refreshNotifications = useCallback(async () => {
    try {
      // Fetch pending products count for notifications - only get PENDING status
      const pendingRes = await fetch('/api/pending-products?status=PENDING');
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        const pendingCount = pendingData.products?.length || 0;

        setNotifications({
          pendingApprovals: pendingCount,
          systemAlerts: pendingCount > 5 ? ['High volume of pending products'] : [],
          unreadCount: pendingCount,
        });
      }
    } catch (err) {
      console.error('Failed to refresh notifications:', err);
    }
  }, []);

  return (
    <AdminNotificationContext.Provider value={{ notifications, refreshNotifications }}>
      {children}
    </AdminNotificationContext.Provider>
  );
}

export function useAdminNotifications() {
  const context = useContext(AdminNotificationContext);
  if (context === undefined) {
    // Context not available - return safe defaults instead of throwing error
    console.warn('useAdminNotifications called outside of AdminNotificationProvider - using safe defaults');
    return {
      notifications: {
        pendingApprovals: 0,
        systemAlerts: [],
        unreadCount: 0,
      },
      refreshNotifications: async () => {
        console.warn('refreshNotifications called outside of AdminNotificationProvider - no-op');
      },
    };
  }
  return context;
}