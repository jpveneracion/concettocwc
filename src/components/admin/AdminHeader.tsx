// src/components/admin/AdminHeader.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Key, Tag, Coins, Building, Shield, Bell, Menu } from 'lucide-react';
import type { AdminUser, AdminNotifications, AdminQuickAction } from '@/types/admin';

interface AdminHeaderProps {
  adminUser: AdminUser | null;
  notifications: AdminNotifications;
}

export default function AdminHeader({ adminUser, notifications }: AdminHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Helper function to format badge counts
  const formatBadgeCount = (count: number): string => count > 9 ? '9+' : String(count);

  // Escape key handler for mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);

  const quickActions: AdminQuickAction[] = [
    {
      label: 'Generate Code',
      icon: Key,
      href: '/admin/activation-codes',
    },
    {
      label: 'Promo Codes',
      icon: Tag,
      href: '/admin/promo-codes',
    },
    {
      label: 'Plans',
      icon: Coins,
      href: '/admin/plans',
    },
    {
      label: 'Company Products',
      icon: Building,
      href: '/admin/company-products',
      badge: notifications.pendingApprovals > 0 ? notifications.pendingApprovals : undefined,
    },
  ];

  return (
    <header className="bg-gradient-to-r from-indigo-50 to-indigo-50 border-b border-indigo-200 h-16 flex items-center justify-between px-4 sticky top-0 z-30">
      {/* Left: Admin branding */}
      <div className="flex items-center gap-3">
        <div className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>Admin Console</span>
        </div>
      </div>

      {/* Center: Quick actions - hidden on mobile */}
      <div className="hidden md:flex items-center gap-2">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors relative"
          >
            <action.icon className="w-4 h-4" />
            <span>{action.label}</span>
            {action.badge && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {formatBadgeCount(action.badge)}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Right: Notifications and profile */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          className="relative p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {notifications.unreadCount > 0 && (
            <span className="absolute top-1 right-1 bg-rose-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {formatBadgeCount(notifications.unreadCount)}
            </span>
          )}
        </button>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg"
          aria-label="Open admin menu"
          aria-expanded={mobileMenuOpen}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Admin profile */}
        {adminUser && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-indigo-100 rounded-lg">
            <span className="text-indigo-700 text-sm font-medium">
              {adminUser.adminEmail || 'Admin'}
            </span>
            {adminUser.adminRole && (
              <span className="text-xs text-indigo-600 bg-indigo-200 px-2 py-0.5 rounded">
                {adminUser.adminRole}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mobile quick actions menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} aria-hidden="true">
          <div className="fixed top-16 right-0 w-64 bg-white shadow-xl p-4 rounded-bl-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-stone-900 mb-3">Admin Quick Actions</h3>
            <div className="space-y-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-indigo-700 hover:bg-indigo-50 relative"
                >
                  <action.icon className="w-5 h-5" />
                  <span className="font-medium">{action.label}</span>
                  {action.badge && (
                    <span className="ml-auto bg-rose-500 text-white text-xs rounded-full px-2 py-0.5">
                      {formatBadgeCount(action.badge)}
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