'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
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
  Menu,
  LayoutDashboard,
} from 'lucide-react';
import MobileNav from './MobileNav';
import { TrialRestrictionBanner } from './TrialRestrictionBanner';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/quotes', label: 'Orders', icon: FileText },
  { href: '/quotes/new', label: 'New quote', icon: Plus },
  { href: '/products', label: 'Products', icon: Tag },
  { href: '/company-products', label: 'Company Products', icon: Building },
  { href: '/account/subscription', label: 'My Subscriptions', icon: CreditCard },
  { href: '/subscription/checkout', label: 'Plans & Pricing', icon: CreditCard },
  { href: '/activate-code', label: 'Redeem Code', icon: Ticket },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const adminNavItems = [
  { href: '/admin/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
  { href: '/admin/verifications', label: 'Payment Verifications', icon: Check },
  { href: '/admin/company-products', label: 'Company Products', icon: Building },
  { href: '/admin/activation-codes', label: 'Activation Codes', icon: Key },
  { href: '/admin/plans', label: 'Subscription Plans', icon: CreditCard },
  { href: '/admin/revenue', label: 'Revenue Analytics', icon: BarChart3 },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [countError, setCountError] = useState<string | null>(null);

  async function handleLogout() {
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
  }

  // Helper function to format badge counts
  const formatBadgeCount = (count: number): string => count > 9 ? '9+' : String(count);

  // Function to fetch pending verification count
  async function fetchPendingCount() {
    try {
      setCountError(null);
      const res = await fetch('/api/payment-verifications/pending/count');

      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          // Not authorized - silently set count to 0
          setPendingCount(0);
          return;
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      if (typeof data.count === 'number') {
        setPendingCount(data.count);
      } else {
        console.error('Invalid count data received:', data);
        setPendingCount(0);
      }
    } catch (err) {
      console.error('Failed to fetch pending count:', err);
      setCountError('failed');
      // On error, set to 0 to avoid showing incorrect information
      setPendingCount(0);
    }
  }

  useEffect(() => {
    async function checkAdminStatus() {
      try {
        const res = await fetch('/api/auth/admin-status');
        const data = await res.json();
        if (res.ok && data.isAdmin) {
          setIsAdmin(true);
          // Fetch pending count for admin users
          fetchPendingCount();
        }
      } catch (err) {
        console.error('Admin status check failed', err);
        setIsAdmin(false);
      }
    }

    checkAdminStatus();
  }, []);

  return (
    <div className="flex flex-col md:h-screen bg-stone-50">
      {/* Trial Restriction Banner */}
      <TrialRestrictionBanner />

      {/* Main Layout Container */}
      <div className="flex flex-1 flex-col md:flex-row md:overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-stone-200">
          <div className="text-lg font-semibold text-indigo-600 flex items-center gap-2">
            <Store className="w-5 h-5" />
            Concetto
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-3 text-slate-600 hover:bg-stone-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-52 md:flex-shrink-0 lg:w-52 lg:flex-shrink-0 bg-white border-r border-stone-200 flex-col p-4 gap-1" aria-label="Main navigation">
        <div className="text-lg font-semibold text-indigo-600 mb-4 pb-4 border-b border-stone-200 flex items-center gap-2">
          <Store className="w-5 h-5" />
          Concetto
        </div>
        <nav role="navigation" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/quotes' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 card-shadow'
                    : 'text-slate-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <item.icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-slate-500'}`} />
                {item.label}
              </Link>
            );
          })}

          {/* Admin Navigation - only visible to admins */}
          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3">
                  Admin
                </div>
              </div>
              {adminNavItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href);
                const showBadge = item.href === '/admin/verifications' && pendingCount > 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative ${
                      active
                        ? 'bg-indigo-50 text-indigo-700 card-shadow'
                        : 'text-slate-600 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {formatBadgeCount(pendingCount)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
        <div className="mt-auto pt-4 border-t border-stone-200">
          <Link
            href="/change-password"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
          >
            <Lock className="w-4 h-4 text-slate-500" />
            Change Password
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-stone-100 hover:text-stone-900 w-full transition-colors"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
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