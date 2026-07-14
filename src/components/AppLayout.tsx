'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import MobileNav from './MobileNav';
import WarningBanner from './subscription/WarningBanner';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/quotes', label: 'Orders', icon: '📄' },
  { href: '/quotes/new', label: 'New quote', icon: '➕' },
  { href: '/products', label: 'Products', icon: '🏷️' },
  { href: '/company-products', label: 'Company Products', icon: '🏢' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
  { href: '/account/subscription', label: 'Subscription', icon: '💳' },
];

const adminNavItems = [
  { href: '/admin/dashboard', label: 'Admin Dashboard', icon: '🛡️' },
  { href: '/admin/pending-products', label: 'Pending Products', icon: '📋' },
  { href: '/admin/company-products', label: 'Company Products', icon: '🏢' },
  { href: '/admin/activation-codes', label: 'Activation Codes', icon: '🔑' },
  { href: '/admin/plans', label: 'Subscription Plans', icon: '💳' },
  { href: '/admin/revenue', label: 'Revenue Analytics', icon: '📊' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  async function handleLogout() {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) {
        console.error('Logout failed');
        return;
      }
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  useEffect(() => {
    async function checkAdminStatus() {
      try {
        const res = await fetch('/api/auth/admin-status');
        const data = await res.json();
        if (res.ok && data.isAdmin) {
          setIsAdmin(true);
        }
      } catch (err) {
        console.error('Admin status check failed', err);
        setIsAdmin(false);
      }
    }

    checkAdminStatus();
  }, []);

  return (
    <div className="flex flex-col md:h-screen bg-gray-50">
      {/* Subscription Warning Banner */}
      <WarningBanner />

      {/* Main Layout Container */}
      <div className="flex flex-1 flex-col md:flex-row md:overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div className="text-lg font-semibold text-blue-600">
          🏪 Concetto
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          aria-label="Open navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          ☰
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-52 md:flex-shrink-0 lg:w-52 lg:flex-shrink-0 bg-white border-r border-gray-200 flex-col p-4 gap-1" aria-label="Main navigation">
        <div className="text-lg font-semibold text-blue-600 mb-4 pb-4 border-b border-gray-200">
          🏪 Concetto
        </div>
        <nav role="navigation" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/quotes' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}

          {/* Admin Navigation - only visible to admins */}
          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3">
                  Admin
                </div>
              </div>
              {adminNavItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-purple-50 text-purple-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
        <div className="mt-auto pt-4 border-t border-gray-200">
          <Link
            href="/change-password"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            <span>🔒</span>
            Change Password
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 w-full"
          >
            <span>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile navigation */}
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-3 md:p-6">{children}</main>
      </div>
    </div>
  );
}