'use client';
import { LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendChartProps {
  data: Array<{ label: string; revenue: number }>;
  currency?: string;
  title?: string;
}

export default function TrendChart({ data, currency = 'USD', title = 'Revenue Trends' }: TrendChartProps) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 md:p-6 card-shadow">
      <h3 className="text-base md:text-lg font-semibold text-stone-900 tracking-tight mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.3}/>
              <stop offset="100%" stopColor="#4F46E5" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E2E8F0"
            horizontal={true}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => {
              const localeMap: Record<string, string> = {
                USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', JPY: 'ja-JP',
                AUD: 'en-AU', CAD: 'en-CA', PHP: 'en-PH', SGD: 'en-SG',
                HKD: 'zh-HK', CNY: 'zh-CN',
              };
              const locale = localeMap[currency] || 'en-US';
              const formatter = new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              });
              const formatted = formatter.format(value);
              return currency === 'USD' ? `$${(value / 1000).toFixed(1)}k` : formatted.replace(/\D/g, '').slice(0, -3) + 'k';
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #E7E5E4',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#1C1917',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
            formatter={(value: unknown) => {
              const localeMap: Record<string, string> = {
                USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', JPY: 'ja-JP',
                AUD: 'en-AU', CAD: 'en-CA', PHP: 'en-PH', SGD: 'en-SG',
                HKD: 'zh-HK', CNY: 'zh-CN',
              };
              const locale = localeMap[currency] || 'en-US';
              const formatter = new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              });
              const numericValue = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : 0;
              return [formatter.format(numericValue || 0), 'Revenue'];
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            fill="url(#revenueGradient)"
            stroke="none"
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#4F46E5"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: '#4F46E5', stroke: 'white', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}