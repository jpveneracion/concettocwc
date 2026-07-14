'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useCallback, memo, useEffect } from 'react';
import { useTrialRestrictions } from '@/contexts/TrialRestrictionContext';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊', requiresFutureOrders: false },
  { href: '/quotes', label: 'Orders', icon: '📄', requiresFutureOrders: false },
  { href: '/quotes/new', label: 'New quote', icon: '➕', requiresFutureOrders: true },
  { href: '/products', label: 'Products', icon: '🏷️', requiresFutureOrders: false },
  { href: '/settings', label: 'Settings', icon: '⚙️', requiresFutureOrders: false },
];

const adminNavItems = [
  { href: '/admin/dashboard', label: 'Admin Dashboard', icon: '🛡️' },
  { href: '/admin/pending-products', label: 'Pending Products', icon: '📋' },
  { href: '/admin/activation-codes', label: 'Activation Codes', icon: '🔑' },
];

function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { canCreateFutureOrders } = useTrialRestrictions();
  const [isAdmin, setIsAdmin] = useState(false);

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

  const handleLogout = useCallback(async () => {
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
  }, [router]);

  const handleItemClick = useCallback((href: string) => {
    onClose();
    if (href !== pathname) {
      router.push(href);
    }
  }, [pathname, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-white z-50 shadow-xl md:hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="text-lg font-semibold text-blue-600">
            🏪 Concetto
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>

        {/* Navigation items */}
        <nav
          className="flex-1 overflow-y-auto p-4"
          role="navigation"
          aria-label="Main navigation"
        >
          {navItems.map((item) => {
            const active = pathname === item.href ||
              (item.href !== '/quotes' && pathname.startsWith(item.href));
            const isRestricted = item.requiresFutureOrders && !canCreateFutureOrders;

            return (
              <button
                key={item.href}
                onClick={() => handleItemClick(item.href)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base transition-colors mb-1 ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                } ${isRestricted ? 'opacity-60' : ''}`}
                aria-current={active ? 'page' : undefined}
                disabled={isRestricted}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {isRestricted && (
                  <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full font-medium">
                    🔒 Restricted
                  </span>
                )}
              </button>
            );
          })}

          {/* Admin Navigation - only visible to admins */}
          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4">
                  Admin
                </div>
              </div>
              {adminNavItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href);
                return (
                  <button
                    key={item.href}
                    onClick={() => handleItemClick(item.href)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base transition-colors mb-1 ${
                      active
                        ? 'bg-purple-50 text-purple-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="text-xl">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </>
          )}
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => handleItemClick('/change-password')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base text-gray-600 hover:bg-gray-100 mb-1"
          >
            <span className="text-xl">🔒</span>
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base text-gray-600 hover:bg-gray-100"
          >
            <span className="text-xl">🚪</span>
            Logout
          </button>
        </div>
      </div>
    </>
  );
}

export default memo(MobileNav);