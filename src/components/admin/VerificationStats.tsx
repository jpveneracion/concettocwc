'use client';

import { Hourglass, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import type { VerificationStats } from '@/types/payment';

interface VerificationStatsProps {
  stats: VerificationStats | null;
  loading?: boolean;
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  color: 'yellow' | 'green' | 'red' | 'blue';
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}

function StatCard({ title, value, subtitle, color, icon: Icon, loading }: StatCardProps) {
  const colorClasses = {
    yellow: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      title: 'text-amber-700',
      value: 'text-amber-900',
      subtitle: 'text-amber-600',
      icon: 'text-amber-600',
    },
    green: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      title: 'text-emerald-700',
      value: 'text-emerald-900',
      subtitle: 'text-emerald-600',
      icon: 'text-emerald-600',
    },
    red: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      title: 'text-rose-700',
      value: 'text-rose-900',
      subtitle: 'text-rose-600',
      icon: 'text-rose-600',
    },
    blue: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      title: 'text-indigo-700',
      value: 'text-indigo-900',
      subtitle: 'text-indigo-600',
      icon: 'text-indigo-600',
    }
  };

  const classes = colorClasses[color];

  return (
    <div className={`${classes.bg} ${classes.border} border rounded-xl p-4 transition-all card-shadow card-shadow-hover`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className={`text-sm font-medium ${classes.title} mb-1`}>
            {title}
          </div>

          {/* Value */}
          {loading ? (
            <div className="animate-pulse h-8 bg-stone-300 rounded mb-1"></div>
          ) : (
            <div className={`text-2xl font-bold ${classes.value} mb-1 tracking-tight`}>
              {value.toLocaleString()}
            </div>
          )}

          {/* Subtitle */}
          <div className={`text-xs ${classes.subtitle}`}>
            {subtitle}
          </div>
        </div>

        {/* Icon */}
        <div className="flex-shrink-0 ml-2 p-2 rounded-lg bg-white card-shadow">
          <Icon className={`w-5 h-5 ${classes.icon}`} />
        </div>
      </div>
    </div>
  );
}

export default function VerificationStatsCards({ stats, loading = false }: VerificationStatsProps) {
  // Default stats when loading or no data
  const defaultStats: VerificationStats = {
    total_pending: 0,
    pending_today: 0,
    approved_today: 0,
    rejected_today: 0,
    total_approved: 0,
    total_rejected: 0
  };

  const displayStats = stats || defaultStats;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Pending Verifications Card */}
      <StatCard
        title="Pending Review"
        value={displayStats.total_pending}
        subtitle={`${displayStats.pending_today} submitted today`}
        color="yellow"
        icon={Hourglass}
        loading={loading}
      />

      {/* Approved Today Card */}
      <StatCard
        title="Approved Today"
        value={displayStats.approved_today}
        subtitle="Completed reviews today"
        color="green"
        icon={CheckCircle2}
        loading={loading}
      />

      {/* Rejected Today Card */}
      <StatCard
        title="Rejected Today"
        value={displayStats.rejected_today}
        subtitle="Declined payments today"
        color="red"
        icon={XCircle}
        loading={loading}
      />

      {/* Total Approved Card */}
      <StatCard
        title="Total Approved"
        value={displayStats.total_approved}
        subtitle="All time approvals"
        color="blue"
        icon={BarChart3}
        loading={loading}
      />
    </div>
  );
}