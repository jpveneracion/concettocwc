'use client';

interface ResponsiveTableProps {
  data: any[];
  renderCard: (item: any, index: number) => React.ReactNode;
  renderTable: () => React.ReactNode;
  emptyMessage?: string;
}

export default function ResponsiveTable({
  data,
  renderCard,
  renderTable,
  emptyMessage = 'No data available'
}: ResponsiveTableProps) {
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
      <div className="md:hidden space-y-3 p-3">
        {data.map((item, index) => renderCard(item, index))}
      </div>

      {/* Desktop table layout */}
      <div className="hidden md:block">{renderTable()}</div>
    </div>
  );
}