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
  const [encryptPhase, setEncryptPhase] = useState<'encrypting' | 'verifying' | 'deleting' | 'complete'>('encrypting');
  const [currency, setCurrency] = useState<string>('USD');

  useEffect(() => {
    fetchMetrics();
    fetchCurrency();
    encryptExistingData();
  }, [period]);

  async function fetchCurrency() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.currency) {
        setCurrency(data.currency);
      }
    } catch (err) {
      console.error('Failed to fetch currency:', err);
    }
  }

  async function encryptExistingData() {
    try {
      setEncrypting(true);
      setEncryptPhase('encrypting');

      // Encrypt quotes
      const quotesRes = await fetch('/api/encrypt-quotes', { method: 'POST' });
      const quotesData = await quotesRes.json();

      if (!quotesRes.ok) {
        console.error('Encrypt quotes failed:', quotesData);
        setEncrypting(false);
        return;
      }

      setEncryptPhase('verifying');

      // Encrypt users
      const usersRes = await fetch('/api/encrypt-users', { method: 'POST' });
      const usersData = await usersRes.json();

      if (!usersRes.ok) {
        console.error('Encrypt users failed:', usersData);
        setEncrypting(false);
        return;
      }

      setEncryptPhase('deleting');

      // Give UI a moment to show the deleting phase
      await new Promise(resolve => setTimeout(resolve, 500));

      setEncryptPhase('complete');

      if (quotesData.encrypted > 0) {
        console.log(`Encrypted ${quotesData.encrypted} quotes, verified ${quotesData.verified}, deleted ${quotesData.deleted}`);
      }

      if (usersData.encrypted > 0) {
        console.log(`Encrypted ${usersData.encrypted} users, verified ${usersData.verified}, deleted ${usersData.deleted}`);
      }

      // Hide modal after showing complete
      setTimeout(() => {
        setEncrypting(false);
        setEncryptPhase('encrypting');
      }, 2000);
    } catch (err) {
      console.error('Encrypt error:', err);
      setEncrypting(false);
    }
  }

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
    const localeMap: Record<string, string> = {
      USD: 'en-US',
      EUR: 'de-DE',
      GBP: 'en-GB',
      JPY: 'ja-JP',
      AUD: 'en-AU',
      CAD: 'en-CA',
      PHP: 'en-PH',
      SGD: 'en-SG',
      HKD: 'zh-HK',
      CNY: 'zh-CN',
    };

    return new Intl.NumberFormat(localeMap[currency] || 'en-US', {
      style: 'currency',
      currency: currency,
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
        <EncryptionModal show={encrypting} phase={encryptPhase} />
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
        <EncryptionModal show={encrypting} phase={encryptPhase} />
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
        <TrendChart data={metrics.revenueTrends} currency={currency} />
        <PopularCollections collections={metrics.popularCollections} currency={currency} />
      </div>

      <div className="mt-6">
        <TopCustomersTable customers={metrics.topCustomers} currency={currency} />
      </div>
    </AppLayout>
  );
}
