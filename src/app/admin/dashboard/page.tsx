'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Key, Building, Tag, CheckCircle2 } from 'lucide-react';
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
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Admin Dashboard</h1>
        <p className="text-stone-600 mt-1">
          System administration and management
        </p>
      </div>

      {/* Admin Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/activation-codes"
          className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 hover:bg-indigo-100 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="p-2 rounded-lg bg-white card-shadow">
              <Key className="w-5 h-5 text-indigo-600" />
            </span>
            <h3 className="text-lg font-semibold text-indigo-900">
              Activation Codes
            </h3>
          </div>
          <p className="text-indigo-700 text-sm">
            Manage trial activation codes and subscription system
          </p>
        </Link>

        <Link
          href="/admin/company-products"
          className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 hover:bg-emerald-100 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="p-2 rounded-lg bg-white card-shadow">
              <Building className="w-5 h-5 text-emerald-600" />
            </span>
            <h3 className="text-lg font-semibold text-emerald-900">
              Company Products
            </h3>
          </div>
          <p className="text-emerald-700 text-sm">
            Review and promote company-specific products to global catalog
          </p>
        </Link>

        <Link
          href="/admin/promo-codes"
          className="bg-amber-50 border border-amber-200 rounded-xl p-6 hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="p-2 rounded-lg bg-white card-shadow">
              <Tag className="w-5 h-5 text-amber-600" />
            </span>
            <h3 className="text-lg font-semibold text-amber-900">
              Promo Codes
            </h3>
          </div>
          <p className="text-amber-700 text-sm">
            Manage promo codes and discount campaigns
          </p>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-stone-400">Loading...</div>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl p-6 card-shadow">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">
            Admin Functions
          </h2>
          <div className="space-y-3 text-sm text-stone-600">
            <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" />User and role management</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" />Product review and approval system</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" />Subscription and activation code management</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" />System monitoring and analytics</p>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}