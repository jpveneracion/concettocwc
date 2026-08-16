// src/components/admin/AdminNotifications.tsx

'use client';

import type { AdminNotifications } from '@/types/admin';
import { AlertTriangle } from 'lucide-react';

interface AdminNotificationCenterProps {
  notifications: AdminNotifications;
}

export default function AdminNotificationCenter({ notifications }: AdminNotificationCenterProps) {
  const { pendingApprovals, systemAlerts, unreadCount } = notifications;

  if (unreadCount === 0 && systemAlerts.length === 0) {
    return null;
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-semibold text-amber-900 mb-2">Admin Notifications</h4>

          {/* Pending approvals */}
          {pendingApprovals > 0 && (
            <div className="text-sm text-amber-800 mb-2">
              <strong>{pendingApprovals}</strong> product(s) pending approval
            </div>
          )}

          {/* System alerts */}
          {systemAlerts.length > 0 && (
            <ul className="text-sm text-amber-800 space-y-1">
              {systemAlerts.map((alert) => (
                <li key={alert}>• {alert}</li>
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