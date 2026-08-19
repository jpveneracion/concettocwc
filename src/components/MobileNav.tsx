'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useCallback, memo, useEffect } from 'react';
import {
  BarChart3,
  FileText,
  Plus,
  Tag,
  Building,
  CreditCard,
  Ticket,
  Settings,
  Check,
  Key,
  Store,
  Lock,
  LogOut,
  X,
  LayoutDashboard,
} from 'lucide-react';
import { useTrialRestrictions } from '@/contexts/TrialRestrictionContext';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3, requiresFutureOrders: false },
  { href: '/quotes', label: 'Orders', icon: FileText, requiresFutureOrders: false },
  { href: '/quotes/new', label: 'New quote', icon: Plus, requiresFutureOrders: true },
  { href: '/products', label: 'Products', icon: Tag, requiresFutureOrders: false },
  { href: '/company-products', label: 'Company Products', icon: Building, requiresFutureOrders: false },
  { href: '/account/subscription', label: 'My Subscriptions', icon: CreditCard, requiresFutureOrders: false },
  { href: '/subscription/checkout', label: 'Plans & Pricing', icon: CreditCard, requiresFutureOrders: false },
  { href: '/activate-code', label: 'Redeem Code', icon: Ticket, requiresFutureOrders: false },
  { href: '/settings', label: 'Settings', icon: Settings, requiresFutureOrders: false },
];

const adminNavItems = [
  { href: '/admin/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
  { href: '/admin/company-products', label: 'Company Products', icon: Building },
  { href: '/admin/activation-codes', label: 'Activation Codes', icon: Key },
  { href: '/admin/plans', label: 'Subscription Plans', icon: CreditCard },
  { href: '/admin/revenue', label: 'Revenue Analytics', icon: BarChart3 },
];

function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { canCreateFutureOrders } = useTrialRestrictions();
  const [isAdmin, setIsAdmin] = useState(false);
  const [companyName, setCompanyName] = useState('');

  const brandText = companyName ? `BQMS - ${companyName}` : 'BQMS';
  const brandFontSize = Math.max(11, Math.min(18, Math.floor(260 / Math.max(brandText.length, 1))));

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.name) setCompanyName(String(data.name));
      })
      .catch(() => {});
  }, []);

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
      const res = await fetch('/api/logout', { method: 'POST' });
      if (!res.ok) {
        console.error('Logout failed');
        return;
      }
      // Force a hard redirect to ensure session is cleared
      window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, []);

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
      <div className="fixed inset-y-0 left-0 w-72 bg-white z-50 elevated md:hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <div className="text-lg font-semibold text-indigo-600 flex items-center gap-2 min-w-0">
            <Store className="w-5 h-5 flex-shrink-0" />
            <span className="truncate" style={{ fontSize: `${brandFontSize}px` }}>{brandText}</span>
          </div>
          <button
            onClick={onClose}
            className="p-3 text-slate-600 hover:bg-stone-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
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
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-slate-600 hover:bg-stone-100'
                } ${isRestricted ? 'opacity-60' : ''}`}
                aria-current={active ? 'page' : undefined}
                disabled={isRestricted}
              >
                <item.icon className={`w-5 h-5 ${active ? 'text-indigo-600' : 'text-slate-500'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {isRestricted && (
                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-full font-medium">
                    <Lock className="w-3 h-3 inline-block mr-0.5" />
                    Restricted
                  </span>
                )}
              </button>
            );
          })}

          {/* Admin Navigation - only visible to admins */}
          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4">
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
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-slate-600 hover:bg-stone-100'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <item.icon className={`w-5 h-5 ${active ? 'text-indigo-600' : 'text-slate-500'}`} />
                    {item.label}
                  </button>
                );
              })}
            </>
          )}
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-stone-200">
          <button
            onClick={() => handleItemClick('/change-password')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base text-slate-600 hover:bg-stone-100 mb-1"
          >
            <Lock className="w-5 h-5 text-slate-500" />
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base text-slate-600 hover:bg-stone-100"
          >
            <LogOut className="w-5 h-5 text-slate-500" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
}

export default memo(MobileNav);