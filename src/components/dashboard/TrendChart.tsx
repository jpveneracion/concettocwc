'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendChartProps {
  data: Array<{ month: string; revenue: number }>;
  currency?: string;
}

export default function TrendChart({ data, currency = 'USD' }: TrendChartProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Revenue Trends</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            stroke="#6b7280"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={10}
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
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
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
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
