'use client';
import ResponsiveTable from '@/components/ResponsiveTable';
import { ActionDropdown } from '@/components/ui/ActionDropdown';

interface TopCustomersTableProps {
  customers: Array<{
    customerName: string;
    totalRevenue: number;
    quoteCount: number;
  }>;
  currency?: string;
  onViewCustomer?: (customer: { customerName: string; totalRevenue: number; quoteCount: number }) => void;
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

export default function TopCustomersTable({ customers, currency = 'USD', onViewCustomer }: TopCustomersTableProps) {
  // Mobile card render function
  const renderMobileCard = (customer: { customerName: string; totalRevenue: number; quoteCount: number }, index: number) => {
    return (
      <div key={index} className="bg-white border border-stone-200 rounded-lg p-4 space-y-2 card-shadow">
        {/* Card header */}
        <div className="flex justify-between items-start">
          <div className="font-semibold text-base text-stone-900">{customer.customerName}</div>
          <div className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-full">
            #{index + 1}
          </div>
        </div>

        {/* Card body */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">Revenue:</span>
            <span className="font-semibold text-indigo-700">
              {formatCurrency(customer.totalRevenue, currency)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Quotes:</span>
            <span className="font-medium">{customer.quoteCount}</span>
          </div>
        </div>
      </div>
    );
  };

  // Desktop table render function
  const renderDesktopTable = () => {
    return (
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-stone-200">
              Customer
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-stone-200">
              Revenue
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-stone-200">
              Quotes
            </th>
            {onViewCustomer && (
              <th className="px-4 py-3 border-b border-stone-200"></th>
            )}
          </tr>
        </thead>
        <tbody>
          {customers.map((customer, index) => (
            <tr
              key={index}
              className="hover:bg-slate-50 transition-colors duration-150 group"
            >
              <td className="px-4 py-3 text-stone-900 font-medium">{customer.customerName}</td>
              <td className="px-4 py-3 text-right text-stone-900 font-semibold">
                {formatCurrency(customer.totalRevenue, currency)}
              </td>
              <td className="px-4 py-3 text-right text-stone-600">{customer.quoteCount}</td>
              {onViewCustomer && (
                <td className="px-4 py-3 text-right">
                  <ActionDropdown
                    onView={() => onViewCustomer(customer)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 md:p-6 card-shadow">
      <h3 className="text-base md:text-lg font-semibold text-stone-900 tracking-tight mb-4">Top Customers</h3>
      <ResponsiveTable
        data={customers}
        renderCard={renderMobileCard}
        renderTable={renderDesktopTable}
        emptyMessage="No customers yet."
      />
    </div>
  );
}