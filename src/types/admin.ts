// src/types/admin.ts

/**
 * Admin user information from authentication system
 */
export interface AdminUser {
  isAdmin: boolean;
  adminRole?: 'admin' | 'superadmin';
  adminEmail?: string;
}

/**
 * Admin notification data structure
 */
export interface AdminNotifications {
  pendingApprovals: number;
  systemAlerts: string[];
  unreadCount: number;
}

/**
 * Admin quick action configuration
 */
export interface AdminQuickAction {
  label: string;
  icon: string;
  href: string;
  badge?: number;
}

/**
 * Admin layout component props
 */
export interface AdminLayoutProps {
  children: React.ReactNode;
}