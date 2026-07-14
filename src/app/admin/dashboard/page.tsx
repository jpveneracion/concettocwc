'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">
          System administration and management
        </p>
      </div>

      {/* Admin Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/activation-codes"
          className="bg-blue-50 border border-blue-200 rounded-lg p-6 hover:bg-blue-100 transition-colors"
        >
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            🔑 Activation Codes
          </h3>
          <p className="text-blue-700 text-sm">
            Manage trial activation codes and subscription system
          </p>
        </Link>

        <Link
          href="/admin/pending-products"
          className="bg-green-50 border border-green-200 rounded-lg p-6 hover:bg-green-100 transition-colors"
        >
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            🏷️ Pending Products
          </h3>
          <p className="text-green-700 text-sm">
            Review and approve merchant-submitted products
          </p>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Admin Functions
          </h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>✅ User and role management</p>
            <p>✅ Product review and approval system</p>
            <p>✅ Subscription and activation code management</p>
            <p>✅ System monitoring and analytics</p>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}