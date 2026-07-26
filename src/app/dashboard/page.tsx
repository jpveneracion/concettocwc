'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import MetricCard from '@/components/dashboard/MetricCard';
import TrendChart from '@/components/dashboard/TrendChart';
import TopCustomersTable from '@/components/dashboard/TopCustomersTable';
import PopularCollections from '@/components/dashboard/PopularCollections';
import EncryptionModal from '@/components/EncryptionModal';
import type { DashboardMetrics } from '@/types';

const YEAR_DROPDOWN_SPAN = 10;

export default function DashboardPage() {
  const currentUtcYear = new Date().getUTCFullYear();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'month' | 'year' | 'all' | 'custom'>('month');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getUTCFullYear());
  const [encrypting, setEncrypting] = useState(false);
  const [encryptPhase, setEncryptPhase] = useState<'encrypting' | 'verifying' | 'deleting' | 'complete'>('encrypting');
  const [currency, setCurrency] = useState<string>('USD');

  const tabClassName = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`;

  // Side effects run once on mount.
  useEffect(() => {
    fetchCurrency();
    encryptExistingData();
  }, []);

  // Metrics refetch whenever the filter changes (also runs on mount).
  useEffect(() => {
    fetchMetrics();
  }, [period, selectedYear]);

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

      console.log(`Quotes: encrypted ${quotesData.encrypted}, verified ${quotesData.verified}, deleted ${quotesData.deleted}`);
      console.log(`Users: encrypted ${usersData.encrypted}, verified ${usersData.verified}, deleted ${usersData.deleted}`);
      if (quotesData.errors?.length > 0) {
        console.error('Quotes errors:', quotesData.errors);
      }
      if (usersData.errors?.length > 0) {
        console.error('Users errors:', usersData.errors);
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
      const dashboardUrl =
        period === 'custom'
          ? `/api/dashboard?period=custom&startDate=${selectedYear}-01-01&endDate=${selectedYear}-12-31`
          : `/api/dashboard?period=${period}`;
      const res = await fetch(dashboardUrl);
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

  const salesTitle =
    period === 'month'
      ? 'Monthly Sales'
      : period === 'year'
        ? 'Yearly Sales'
        : period === 'all'
          ? 'All-Time Sales'
          : `${selectedYear} Sales`;

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
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPeriod('month')}
            className={tabClassName(period === 'month')}
          >
            Current Month
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={tabClassName(period === 'year')}
          >
            Current Year
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={tabClassName(period === 'all')}
          >
            All Time
          </button>
          <button
            onClick={() => setPeriod('custom')}
            className={tabClassName(period === 'custom')}
          >
            Specific Year
          </button>
          {period === 'custom' && (
            <select
              value={String(selectedYear)}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={`${tabClassName(false)} border border-gray-300`}
            >
              {Array.from({ length: YEAR_DROPDOWN_SPAN }, (_, i) => currentUtcYear - i).map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title={salesTitle}
          value={formatCurrency(metrics.monthlySales)}
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
