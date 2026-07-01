'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import TrendChart from '@/components/dashboard/TrendChart';
import TopCustomersTable from '@/components/dashboard/TopCustomersTable';
import PopularCollections from '@/components/dashboard/PopularCollections';
import EncryptionModal from '@/components/EncryptionModal';
import type { DashboardMetrics } from '@/types';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [encrypting, setEncrypting] = useState(false);

  useEffect(() => {
    fetchMetrics();
  }, [period]);

  async function fetchMetrics() {
    try {
      setLoading(true);
      setError(null);
      setEncrypting(true);
      const res = await fetch(`/api/dashboard?period=${period}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load dashboard');
        setMetrics(null);
      } else {
        setMetrics(data);
        setError(null);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Unable to load dashboard');
      setMetrics(null);
    } finally {
      setLoading(false);
      setEncrypting(false);
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatPercent(value: number): string {
    return `${(value * 100).toFixed(0)}%`;
  }

  if (loading) {
    return (
      <AppLayout>
        <EncryptionModal show={encrypting} />
        <div className="p-12 text-center text-gray-400">Loading dashboard...</div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-12 text-center text-red-600">{error}</div>
      </AppLayout>
    );
  }

  if (!metrics) {
    return (
      <AppLayout>
        <EncryptionModal show={encrypting} />
        <div className="p-12 text-center text-gray-400">No data available</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <EncryptionModal show={encrypting} />
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-4">Dashboard</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Current Month
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'year'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Current Year
          </button>
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title={period === 'month' ? 'Monthly Sales' : 'Yearly Sales'}
          value={formatCurrency(period === 'month' ? metrics.monthlySales : metrics.yearlySales)}
          icon="💰"
          color="blue"
        />
        <MetricCard
          title="Profit"
          value={formatCurrency(metrics.profit)}
          subtitle={`Margin: ${formatPercent(metrics.profitMargin)}`}
          icon="📈"
          color="green"
        />
        <MetricCard
          title="Conversion Rate"
          value={formatPercent(metrics.conversionRate)}
          subtitle={`${metrics.approvedQuotes} of ${metrics.totalQuotes} approved`}
          icon="🎯"
          color="purple"
        />
        <MetricCard
          title="Avg Order Value"
          value={formatCurrency(metrics.averageOrderValue)}
          icon="📊"
          color="orange"
        />
      </div>

      {/* Charts and tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart data={metrics.revenueTrends} />
        <PopularCollections collections={metrics.popularCollections} />
      </div>

      <div className="mt-6">
        <TopCustomersTable customers={metrics.topCustomers} />
      </div>
    </AppLayout>
  );
}
