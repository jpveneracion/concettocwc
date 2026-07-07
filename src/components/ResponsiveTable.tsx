'use client';

interface ResponsiveTableProps<T> {
  data: T[];
  renderCard: (item: T, index: number) => React.ReactNode;
  renderTable: () => React.ReactNode;
  emptyMessage?: string;
}

export default function ResponsiveTable<T>({
  data,
  renderCard,
  renderTable,
  emptyMessage = 'No data available'
}: ResponsiveTableProps<T>) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Mobile card layout */}
      <div className="lg:hidden space-y-3 p-3">
        {data.map((item, index) => (
          <div key={index}>
            {renderCard(item, index)}
          </div>
        ))}
      </div>

      {/* Desktop table layout */}
      <div className="hidden lg:block">{renderTable()}</div>
    </div>
  );
}