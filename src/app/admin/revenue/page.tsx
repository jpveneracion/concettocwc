'use client';

import AdminLayout from '@/components/AdminLayout';
import { BarChart3 } from 'lucide-react';

export default function AdminRevenuePage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Revenue Management</h1>
          <p className="text-stone-600 mt-1">
            Track and analyze revenue metrics
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-lg p-6">
          <div className="text-center py-8 text-stone-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-stone-400" />
            <p>Revenue management dashboard</p>
            <p className="text-sm mt-2">This feature is coming soon.</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}