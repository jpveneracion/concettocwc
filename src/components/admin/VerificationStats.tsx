'use client';

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
  icon: string;
  loading?: boolean;
}

function StatCard({ title, value, subtitle, color, icon, loading }: StatCardProps) {
  const colorClasses = {
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      title: 'text-yellow-700',
      value: 'text-yellow-900',
      subtitle: 'text-yellow-600'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      title: 'text-green-700',
      value: 'text-green-900',
      subtitle: 'text-green-600'
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      title: 'text-red-700',
      value: 'text-red-900',
      subtitle: 'text-red-600'
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      title: 'text-blue-700',
      value: 'text-blue-900',
      subtitle: 'text-blue-600'
    }
  };

  const classes = colorClasses[color];

  return (
    <div className={`${classes.bg} ${classes.border} border rounded-lg p-4 transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className={`text-sm font-medium ${classes.title} mb-1`}>
            {title}
          </div>

          {/* Value */}
          {loading ? (
            <div className="animate-pulse h-8 bg-gray-300 rounded mb-1"></div>
          ) : (
            <div className={`text-2xl font-bold ${classes.value} mb-1`}>
              {value.toLocaleString()}
            </div>
          )}

          {/* Subtitle */}
          <div className={`text-xs ${classes.subtitle}`}>
            {subtitle}
          </div>
        </div>

        {/* Icon */}
        <div className="text-2xl flex-shrink-0 ml-2">
          {icon}
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
        icon="⏳"
        loading={loading}
      />

      {/* Approved Today Card */}
      <StatCard
        title="Approved Today"
        value={displayStats.approved_today}
        subtitle="Completed reviews today"
        color="green"
        icon="✅"
        loading={loading}
      />

      {/* Rejected Today Card */}
      <StatCard
        title="Rejected Today"
        value={displayStats.rejected_today}
        subtitle="Declined payments today"
        color="red"
        icon="❌"
        loading={loading}
      />

      {/* Total Approved Card */}
      <StatCard
        title="Total Approved"
        value={displayStats.total_approved}
        subtitle="All time approvals"
        color="blue"
        icon="📊"
        loading={loading}
      />
    </div>
  );
}