interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose';
}

const colorConfig = {
  indigo: {
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    valueColor: 'text-indigo-700',
  },
  emerald: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    valueColor: 'text-emerald-700',
  },
  amber: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    valueColor: 'text-amber-700',
  },
  rose: {
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    valueColor: 'text-rose-700',
  },
};

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'indigo',
}: MetricCardProps) {
  const colorAccent = colorConfig[color];

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 md:p-6 card-shadow card-shadow-hover transition-all duration-200 group">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${colorAccent.iconBg} group-hover:scale-105 transition-transform duration-200`}>
          <Icon className={`w-5 h-5 md:w-6 md:h-6 ${colorAccent.iconColor}`} />
        </div>
        {subtitle && (
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {subtitle}
          </span>
        )}
      </div>
      <div className={`text-2xl md:text-3xl font-bold text-stone-900 mb-1 tracking-tight ${colorAccent.valueColor}`}>
        {value}
      </div>
      <div className="text-sm text-slate-600 font-medium">{title}</div>
    </div>
  );
}