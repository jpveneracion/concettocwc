// src/app/admin/pricing/page.tsx

import PricingManager from '@/components/admin/PricingManager';
import AdminLayout from '@/components/AdminLayout';

export default function AdminPricingPage() {
  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Pricing Management</h1>
          <p className="text-gray-600 mt-2">
            Manage pricing configurations, view history, and make updates to the comprehensive pricing system.
          </p>
        </div>

        <PricingManager />
      </div>
    </AdminLayout>
  );
}