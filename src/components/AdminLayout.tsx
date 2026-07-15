// src/components/AdminLayout.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import AdminHeader from './admin/AdminHeader';
import AdminNotificationCenter from './admin/AdminNotifications';
import { AdminNotificationProvider, useAdminNotifications } from '@/contexts/AdminNotificationContext';
import type { AdminUser } from '@/types/admin';

interface LayoutProps {
  children: React.ReactNode;
}

function AdminLayoutContent({ children }: LayoutProps) {
  const router = useRouter();
  const { notifications, refreshNotifications } = useAdminNotifications();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdminStatus() {
      try {
        const res = await fetch('/api/auth/admin-status');
        const data = await res.json();

        if (res.ok && data.isAdmin) {
          setIsAdmin(true);
          setAdminUser({
            isAdmin: true,
            adminRole: data.role,
            adminEmail: data.email,
          });

          // Fetch admin notifications
          await refreshNotifications();
        } else {
          // Redirect if not admin
          router.push('/dashboard');
        }
      } catch (err) {
        console.error('Admin status check failed:', err);
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    }

    checkAdminStatus();
  }, [router, refreshNotifications]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-pulse text-purple-600 text-lg mb-2">
            Verifying admin access...
          </div>
          <div className="text-sm text-gray-500">Please wait</div>
        </div>
      </div>
    );
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="text-red-600 text-4xl mb-3">🚫</div>
          <h1 className="text-xl font-bold text-red-900 mb-2">Access Denied</h1>
          <p className="text-red-700 mb-4">
            You don't have permission to access this admin area.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Admin Header */}
        <AdminHeader adminUser={adminUser} notifications={notifications} />

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          {/* Admin notifications */}
          <AdminNotificationCenter notifications={notifications} />

          {/* Page content */}
          {children}
        </div>
      </div>
    </AppLayout>
  );
}

export default function AdminLayout({ children }: LayoutProps) {
  return (
    <AdminNotificationProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AdminNotificationProvider>
  );
}