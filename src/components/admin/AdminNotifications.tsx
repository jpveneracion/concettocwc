// src/components/admin/AdminNotifications.tsx

'use client';

import type { AdminNotifications } from '@/types/admin';

interface AdminNotificationsProps {
  notifications: AdminNotifications;
}

export default function AdminNotifications({ notifications }: AdminNotificationsProps) {
  const { pendingApprovals, systemAlerts, unreadCount } = notifications;

  if (unreadCount === 0 && systemAlerts.length === 0) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <h4 className="font-semibold text-yellow-900 mb-2">Admin Notifications</h4>

          {/* Pending approvals */}
          {pendingApprovals > 0 && (
            <div className="text-sm text-yellow-800 mb-2">
              <strong>{pendingApprovals}</strong> product(s) pending approval
            </div>
          )}

          {/* System alerts */}
          {systemAlerts.length > 0 && (
            <ul className="text-sm text-yellow-800 space-y-1">
              {systemAlerts.map((alert, index) => (
                <li key={index}>• {alert}</li>
              ))}
            </ul>
          )}

          {/* Total unread */}
          <div className="text-xs text-yellow-700 mt-2">
            Total: {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}