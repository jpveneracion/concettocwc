// src/components/AdminLayout.tsx

'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import AdminHeader from './admin/AdminHeader';
import AdminNavigation from './admin/AdminNavigation';
import AdminNotificationCenter from './admin/AdminNotifications';
import AdminProfile from './admin/AdminProfile';
import type { AdminUser, AdminNotifications } from '@/types/admin';

interface LayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [notifications, setNotifications] = useState<AdminNotifications>({
    pendingApprovals: 0,
    systemAlerts: [],
    unreadCount: 0,
  });
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
          await fetchNotifications();
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
  }, [router]);

  const fetchNotifications = async () => {
    try {
      // Fetch pending products count for notifications
      const pendingRes = await fetch('/api/pending-products');
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
      console.error('Failed to fetch notifications:', err);
    }
  };

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

        {/* Main content area with enhanced layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Enhanced sidebar with admin navigation */}
          <aside className="hidden md:flex md:w-52 lg:w-52 flex-shrink-0 bg-white border-r border-gray-200 flex-col p-4 overflow-y-auto">
            {/* Regular navigation would be inherited from AppLayout */}
            {/* Add admin-specific navigation section */}
            <AdminNavigation currentPath={pathname} />

            {/* Admin profile section */}
            <div className="mt-auto pt-4 border-t border-gray-200">
              <AdminProfile adminUser={adminUser} />
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-3 md:p-6">
            {/* Admin notifications */}
            <AdminNotificationCenter notifications={notifications} />

            {/* Page content */}
            {children}
          </main>
        </div>
      </div>
    </AppLayout>
  );
}