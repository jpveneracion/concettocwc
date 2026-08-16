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
      <div className="bg-white border border-stone-200 rounded-xl p-4 md:p-6 card-shadow">
        <h3 className="text-base md:text-lg font-semibold text-stone-900 tracking-tight mb-4">Popular Collections</h3>
        <p className="text-sm text-stone-500">No collections yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 md:p-6 card-shadow">
      <h3 className="text-base md:text-lg font-semibold text-stone-900 tracking-tight mb-4">Popular Collections</h3>
      <div className="space-y-3">
        {collections.slice(0, 10).map((item, index) => (
          <div
            key={item.collection}
            className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0"
          >
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
              <span className={`flex-shrink-0 w-6 h-6 rounded-md text-xs font-semibold flex items-center justify-center ${
                index < 3
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'bg-stone-100 text-stone-500'
              }`}>
                {index + 1}
              </span>
              <span className="text-xs md:text-sm font-medium text-stone-900 truncate">
                {item.collection}
              </span>
              <span className="text-xs text-stone-500 shrink-0">({item.count})</span>
            </div>
            <span className="text-xs md:text-sm font-semibold text-stone-900 ml-2 shrink-0">
              {formatCurrency(item.revenue, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}