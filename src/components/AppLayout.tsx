'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/quotes', label: 'Quotes', icon: '📄' },
  { href: '/quotes/new', label: 'New quote', icon: '➕' },
  { href: '/products', label: 'Products', icon: '🏷️' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col p-4 gap-1">
        <div className="text-lg font-semibold text-blue-600 mb-4 pb-4 border-b border-gray-200">
          🏪 Concetto
        </div>
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
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
