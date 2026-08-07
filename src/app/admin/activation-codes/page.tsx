// src/app/admin/activation-codes/page.tsx

'use client';
import { useState, useEffect } from 'react';
import { AccountLockedBanner } from '@/components/subscription/AccountLockedBanner';
import AdminLayout from '@/components/AdminLayout';

interface DashboardAnalytics {
  total_gcash_payments: number;
  total_crypto_payments: number;
  total_usd_payments: number;
  active_subscriptions: number;
  pending_codes: number;
  average_revenue_per_user: number;
  trial_to_conversion_rate: number;
  payment_method_distribution: PaymentMethodStats[];
  discount_distribution: DiscountStats[];
  plan_distribution: PlanStats[];
}

export default function AdminDashboardPage() {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New code generation form - access codes, no plan/discount/payment fields
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [codeForm, setCodeForm] = useState({
    campaign_name: '',
    notes: ''
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      const res = await fetch('/api/admin/dashboard');
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  async function generateCode(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/activation-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(codeForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate code');
      }

      alert(`Code generated: ${data.code.code}`);
      setShowCodeForm(false);
      fetchAnalytics(); // Refresh analytics
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate code');
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Trial system and activation code management
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Active Subscriptions"
            value={analytics?.active_subscriptions || 0}
            color="blue"
          />
          <MetricCard
            title="Pending Codes"
            value={analytics?.pending_codes || 0}
            color="yellow"
          />
          <MetricCard
            title="Total Revenue"
            value={`$${((analytics?.total_gcash_payments || 0) +
                      (analytics?.total_crypto_payments || 0) +
                      (analytics?.total_usd_payments || 0)).toFixed(2)}`}
            color="green"
          />
          <MetricCard
            title="Conversion Rate"
            value={`${(analytics?.trial_to_conversion_rate || 0).toFixed(1)}%`}
            color="purple"
          />
        </div>

        {/* Payment Method Distribution */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Payment Methods
          </h2>
          <div className="space-y-3">
            {analytics?.payment_method_distribution?.map((method) => (
              <div key={method.method} className="flex items-center">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {method.method.toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {method.count} transactions
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    ${method.amount.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {method.percentage}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Generate Code Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCodeForm(!showCodeForm)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
          >
            {showCodeForm ? 'Cancel' : 'Generate Activation Code'}
          </button>
        </div>

        {/* Generate Code Form */}
        {showCodeForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Generate New Activation Code
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Access-grant codes unlock premium features (e.g. theme editor) when redeemed. No plan or payment details needed.
            </p>
            <form onSubmit={generateCode} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={codeForm.campaign_name}
                    onChange={(e) => setCodeForm({...codeForm, campaign_name: e.target.value})}
                    placeholder="e.g. Theme beta launch"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={codeForm.notes}
                    onChange={(e) => setCodeForm({...codeForm, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700"
                >
                  Generate Code
                </button>
                <button
                  type="button"
                  onClick={() => setShowCodeForm(false)}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

// Helper component for metric cards
function MetricCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    purple: 'bg-purple-50 border-purple-200'
  };

  return (
    <div className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-lg p-4`}>
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

// Type definitions for the dashboard
interface PaymentMethodStats {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

interface DiscountStats {
  discount_percent: number;
  count: number;
  total_amount: number;
}

interface PlanStats {
  plan: string;
  count: number;
  revenue: number;
  percentage: number;
}