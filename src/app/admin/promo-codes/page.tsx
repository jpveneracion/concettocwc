'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import PromoCodeManager from '@/components/admin/PromoCodeManager';

export default function PromoCodesPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Check authorization via API call
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin-status');
        if (response.ok) {
          setAuthorized(true);
        } else {
          window.location.href = '/login';
        }
      } catch (error) {
        window.location.href = '/login';
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  if (!authorized) {
    return null; // Will redirect in useEffect
  }

  return (
    <AdminLayout>
      <PromoCodeManager />
    </AdminLayout>
  );
}
