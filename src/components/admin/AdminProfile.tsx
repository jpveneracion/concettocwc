// src/components/admin/AdminProfile.tsx

'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { AdminUser } from '@/types/admin';

interface AdminProfileProps {
  adminUser: AdminUser | null;
}

export default function AdminProfile({ adminUser }: AdminProfileProps) {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (!adminUser) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 w-full"
      >
        <span>👤</span>
        <span className="flex-1 text-left">{adminUser.adminEmail || 'Admin'}</span>
        {adminUser.adminRole && (
          <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
            {adminUser.adminRole}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 space-y-1">
          <button
            onClick={() => {
              setShowDropdown(false);
              router.push('/change-password');
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 w-full"
          >
            <span>🔒</span>
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 w-full"
          >
            <span>🚪</span>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
