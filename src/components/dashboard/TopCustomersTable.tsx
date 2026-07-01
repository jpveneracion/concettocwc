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
  if (customers.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Customers</h3>
        <p className="text-sm text-gray-500">No customers yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Customers</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-xs font-medium text-gray-500">Customer</th>
              <th className="text-right py-2 text-xs font-medium text-gray-500">Revenue</th>
              <th className="text-right py-2 text-xs font-medium text-gray-500">Quotes</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer, index) => (
              <tr
                key={index}
                className="border-b border-gray-100 hover:bg-gray-50 last:border-0"
              >
                <td className="py-3 text-gray-900">{customer.customerName}</td>
                <td className="py-3 text-right font-medium text-gray-900">
                  {formatCurrency(customer.totalRevenue, currency)}
                </td>
                <td className="py-3 text-right text-gray-600">{customer.quoteCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
