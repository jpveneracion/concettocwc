interface PopularCollectionsProps {
  collections: Array<{
    collection: string;
    count: number;
    revenue: number;
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

export default function PopularCollections({ collections, currency = 'USD' }: PopularCollectionsProps) {
  if (collections.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Collections</h3>
        <p className="text-sm text-gray-500">No collections yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Collections</h3>
      <div className="space-y-3">
        {collections.slice(0, 10).map((item, index) => (
          <div
            key={item.collection}
            className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">
                {index + 1}. {item.collection}
              </span>
              <span className="text-xs text-gray-500">({item.count} quotes)</span>
            </div>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(item.revenue, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
