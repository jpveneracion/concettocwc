interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

const colorAccents = {
  blue: 'text-blue-600 bg-blue-50',
  green: 'text-green-600 bg-green-50',
  purple: 'text-purple-600 bg-purple-50',
  orange: 'text-orange-600 bg-orange-50',
};

export default function MetricCard({ title, value, subtitle, icon, color }: MetricCardProps) {
  const colorAccent = colorAccents[color];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-2xl ${colorAccent}`}>{icon}</span>
        {subtitle && (
          <span className="text-xs text-gray-500">{subtitle}</span>
        )}
      </div>
      <div className={`text-2xl font-bold text-gray-900 mb-1 ${colorAccent}`}>{value}</div>
      <div className="text-sm text-gray-600">{title}</div>
    </div>
  );
}
