'use client';
import ResponsiveTable from '@/components/ResponsiveTable';

interface TopCustomersTableProps {
  customers: Array<{
    customerName: string;
    totalRevenue: number;
    quoteCount: number;
  }>;
  currency?: string;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const localeMap: Record<string, string> = {
    USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', JPY: 'ja-JP',
    AUD: 'en-AU', CAD: 'en-CA', PHP: 'en-PH', SGD: 'en-SG',
    HKD: 'zh-HK', CNY: 'zh-CN',
  };
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function TopCustomersTable({ customers, currency = 'USD' }: TopCustomersTableProps) {
  // Mobile card render function
  const renderMobileCard = (customer: { customerName: string; totalRevenue: number; quoteCount: number }, index: number) => {
    return (
      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
        {/* Card header */}
        <div className="flex justify-between items-start">
          <div className="font-semibold text-base text-gray-900">{customer.customerName}</div>
          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            #{index + 1}
          </div>
        </div>

        {/* Card body */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Revenue:</span>
            <span className="font-semibold text-blue-700">
              {formatCurrency(customer.totalRevenue, currency)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Quotes:</span>
            <span className="font-medium">{customer.quoteCount}</span>
          </div>
        </div>
      </div>
    );
  };

  // Desktop table render function
  const renderDesktopTable = () => {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Customer</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Revenue</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Quotes</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer, index) => (
            <tr
              key={index}
              className="border-b border-gray-100 hover:bg-gray-50 last:border-0"
            >
              <td className="px-4 py-3 text-gray-900">{customer.customerName}</td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">
                {formatCurrency(customer.totalRevenue, currency)}
              </td>
              <td className="px-4 py-3 text-right text-gray-600">{customer.quoteCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Top Customers</h3>
      <ResponsiveTable
        data={customers}
        renderCard={renderMobileCard}
        renderTable={renderDesktopTable}
        emptyMessage="No customers yet."
      />
    </div>
  );
}