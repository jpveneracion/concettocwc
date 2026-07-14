// src/components/admin/AdminNavigation.tsx

'use client';

import Link from 'next/link';

interface AdminNavigationProps {
  currentPath: string;
}

export default function AdminNavigation({ currentPath }: AdminNavigationProps) {
  const adminNavItems = [
    { href: '/admin/dashboard', label: 'Admin Dashboard', icon: '🛡️' },
    { href: '/admin/pending-products', label: 'Pending Products', icon: '📋' },
    { href: '/admin/activation-codes', label: 'Activation Codes', icon: '🔑' },
    { href: '/admin/plans', label: 'Subscription Plans', icon: '💳' },
    { href: '/admin/revenue', label: 'Revenue Analytics', icon: '📊' },
  ];

  return (
    <div className="space-y-1">
      {/* Admin section header */}
      <div className="pt-4 pb-2">
        <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider px-3">
          Admin Console
        </div>
      </div>

      {/* Admin navigation items */}
      {adminNavItems.map((item) => {
        const active = currentPath === item.href || currentPath.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              active
                ? 'bg-purple-50 text-purple-700 font-medium'
                : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}