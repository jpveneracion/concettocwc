interface PopularCollectionsProps {
  collections: Array<{
    collection: string;
    count: number;
    revenue: number;
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export default function PopularCollections({ collections }: PopularCollectionsProps) {
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
        {collections.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">
                {index + 1}. {item.collection}
              </span>
              <span className="text-xs text-gray-500">({item.count} quotes)</span>
            </div>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(item.revenue)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
