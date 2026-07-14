// src/components/admin/AdminHeader.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { AdminUser, AdminNotifications, AdminQuickAction } from '@/types/admin';

interface AdminHeaderProps {
  adminUser: AdminUser | null;
  notifications: AdminNotifications;
}

export default function AdminHeader({ adminUser, notifications }: AdminHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const quickActions: AdminQuickAction[] = [
    {
      label: 'Generate Code',
      icon: '🔑',
      href: '/admin/activation-codes',
    },
    {
      label: 'Pending Products',
      icon: '📋',
      href: '/admin/pending-products',
      badge: notifications.pendingApprovals > 0 ? notifications.pendingApprovals : undefined,
    },
  ];

  return (
    <header className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200 h-16 flex items-center justify-between px-4 sticky top-0 z-30">
      {/* Left: Admin branding */}
      <div className="flex items-center gap-3">
        <div className="bg-purple-600 text-white px-3 py-1 rounded-lg text-sm font-semibold flex items-center gap-2">
          <span>🛡️</span>
          <span>Admin Console</span>
        </div>
      </div>

      {/* Center: Quick actions - hidden on mobile */}
      <div className="hidden md:flex items-center gap-2">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors relative"
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
            {action.badge && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {action.badge > 9 ? '9+' : action.badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Right: Notifications and profile */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          className="relative p-2 text-purple-600 hover:bg-purple-100 rounded-lg"
          aria-label="Notifications"
        >
          <span className="text-xl">🔔</span>
          {notifications.unreadCount > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {notifications.unreadCount > 9 ? '9+' : notifications.unreadCount}
            </span>
          )}
        </button>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden p-2 text-purple-600 hover:bg-purple-100 rounded-lg"
          aria-label="Open admin menu"
        >
          <span className="text-xl">☰</span>
        </button>

        {/* Admin profile */}
        {adminUser && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-purple-100 rounded-lg">
            <span className="text-purple-700 text-sm font-medium">
              {adminUser.adminEmail || 'Admin'}
            </span>
            {adminUser.adminRole && (
              <span className="text-xs text-purple-600 bg-purple-200 px-2 py-0.5 rounded">
                {adminUser.adminRole}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mobile quick actions menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="fixed top-16 right-0 w-64 bg-white shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-3">Admin Quick Actions</h3>
            <div className="space-y-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-purple-700 hover:bg-purple-50 relative"
                >
                  <span className="text-xl">{action.icon}</span>
                  <span className="font-medium">{action.label}</span>
                  {action.badge && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                      {action.badge > 9 ? '9+' : action.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}