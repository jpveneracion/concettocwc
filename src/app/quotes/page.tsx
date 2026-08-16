'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Printer, Truck, Trash2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ResponsiveTable from '@/components/ResponsiveTable';
import { ActionDropdown } from '@/components/ui/ActionDropdown';
import { getStatusBadgeClass, formatStatusLabel } from '@/lib/design-system';
import type { Quote } from '@/types';
import { phpFormat } from '@/lib/calc';

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[] | null>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchQuotes = useCallback(async () => {
    try {
      const res = await fetch('/api/quotes');
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || 'Failed to load quotes.');
        setQuotes(null);
      } else if (!Array.isArray(data.quotes)) {
        setError('Invalid response from server.');
        setQuotes(null);
      } else {
        setQuotes(data.quotes);
        setError(null);
      }
    } catch (err) {
      console.error('Fetch quotes failed', err);
      setError('Unable to load quotes.');
      setQuotes(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteQuote = useCallback(async (id: string, num: string) => {
    if (!window.confirm(`Delete quote ${num}?`)) return;

    try {
      const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        console.error('Delete failed:', error?.error || 'Unknown error');
        return;
      }
      fetchQuotes();
    } catch (err) {
      console.error('Delete error:', err);
    }
  }, [fetchQuotes]);

  const changeStatus = useCallback(async (id: string, currentStatus: string, newStatus: string, quoteNum: string) => {
    if (!window.confirm(`Change status for quote ${quoteNum} from "${currentStatus}" to "${newStatus}"?`)) return;

    try {
      const res = await fetch(`/api/quotes/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const error = await res.json();
        console.error('Status change failed:', error?.error || 'Unknown error');
        return;
      }

      fetchQuotes();
    } catch (err) {
      console.error('Status change error:', err);
    }
  }, [fetchQuotes]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const statusBadge = (status: string) =>
    `px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border ${getStatusBadgeClass(status)}`;

  // Mobile card render function
  const renderMobileCard = (quote: Quote, index: number) => {
    return (
      <div key={quote.id} className="bg-white border border-stone-200 rounded-lg p-4 space-y-3 card-shadow">
        {/* Card header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="font-semibold text-lg text-stone-900">#{quote.quote_number}</div>
            <div className="text-stone-600 text-sm">{quote.customer_name}</div>
          </div>
          <span className={statusBadge(quote.status)}>
            {formatStatusLabel(quote.status)}
          </span>
        </div>

        {/* Card body */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">Date:</span>
            <span className="text-stone-900">{quote.quote_date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Panels:</span>
            <span className="text-stone-900">{quote.panel_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Total:</span>
            <span className="font-semibold text-stone-900">{phpFormat(quote.total)}</span>
          </div>
        </div>

        {/* Card actions */}
        <div className="space-y-2 pt-2 border-t border-stone-100">
          <div className="flex gap-2">
            <select
              value={quote.status}
              disabled={quote.status === 'delivered'}
              onChange={(e) => changeStatus(quote.id, quote.status, e.target.value, quote.quote_number)}
              className={`flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white ${quote.status === 'delivered' ? 'bg-stone-50 text-stone-500' : ''}`}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/quotes/${quote.id}`}
              className="px-3 py-2 text-sm border border-stone-300 rounded-lg text-center text-stone-700 hover:bg-stone-50 transition-colors inline-flex items-center justify-center gap-1.5"
              aria-label="Edit quote"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Link>
            <Link
              href={`/quotes/${quote.id}?print=quotation`}
              className="px-3 py-2 text-sm border border-stone-300 rounded-lg text-center text-stone-700 hover:bg-stone-50 transition-colors inline-flex items-center justify-center gap-1.5"
              aria-label="Print quotation"
            >
              <Printer className="w-3.5 h-3.5" />
              Quote
            </Link>
            <Link
              href={`/quotes/${quote.id}?print=po`}
              className="px-3 py-2 text-sm border border-stone-300 rounded-lg text-center text-stone-700 hover:bg-stone-50 transition-colors inline-flex items-center justify-center gap-1.5"
              aria-label="Print purchase order"
            >
              <Truck className="w-3.5 h-3.5" />
              PO
            </Link>
            <button
              onClick={() => deleteQuote(quote.id, quote.quote_number)}
              className="px-3 py-2 text-sm border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 transition-colors inline-flex items-center justify-center gap-1.5"
              aria-label="Delete quote"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
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
            {['Quote #', 'Customer', 'Date', 'Panels', 'Total', 'Status', 'Actions'].map((h) => (
              <th
                key={h}
                className={`text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-stone-200 ${
                  h === 'Total' || h === 'Panels' ? 'text-right' : ''
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {quotes?.map((q) => (
            <tr key={q.id} className="hover:bg-slate-50 transition-colors duration-150">
              <td className="px-4 py-3 font-medium text-stone-900">{q.quote_number}</td>
              <td className="px-4 py-3 text-stone-900">{q.customer_name}</td>
              <td className="px-4 py-3 text-stone-600">{q.quote_date}</td>
              <td className="px-4 py-3 text-right text-stone-600">{q.panel_count}</td>
              <td className="px-4 py-3 text-right font-semibold text-stone-900">{phpFormat(q.total)}</td>
              <td className="px-4 py-3">
                <span className={statusBadge(q.status)}>
                  {formatStatusLabel(q.status)}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <select
                    value={q.status}
                    disabled={q.status === 'delivered'}
                    onChange={(e) => changeStatus(q.id, q.status, e.target.value, q.quote_number)}
                    className={`px-2 py-1 text-xs border border-stone-300 rounded-lg hover:bg-stone-50 bg-white transition-colors ${
                      q.status === 'delivered' ? 'bg-stone-50 text-stone-500' : ''
                    }`}
                    aria-label="Change quote status"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <ActionDropdown
                    actions={[
                      { label: 'Edit', icon: Pencil, onClick: () => { router.push(`/quotes/${q.id}`); } },
                      { label: 'Print Quotation', icon: Printer, onClick: () => { router.push(`/quotes/${q.id}?print=quotation`); } },
                      { label: 'Print Purchase Order', icon: Truck, onClick: () => { router.push(`/quotes/${q.id}?print=po`); } },
                      { label: 'Delete', icon: Trash2, onClick: () => deleteQuote(q.id, q.quote_number), variant: 'danger' },
                    ]}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h1 className="text-lg font-semibold md:text-xl tracking-tight">Orders</h1>
        <Link
          href="/quotes/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          aria-label="Create new quote"
        >
          <Plus className="w-4 h-4" />
          New quote
        </Link>
      </div>

      {loading ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-stone-400">
          Loading...
        </div>
      ) : error ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-rose-600">
          {error}
        </div>
      ) : !Array.isArray(quotes) || quotes.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-stone-400">
          No quotes yet.{' '}
          <Link href="/quotes/new" className="text-indigo-600 underline">Create your first one.</Link>
        </div>
      ) : (
        <ResponsiveTable
          data={quotes}
          renderCard={renderMobileCard}
          renderTable={renderDesktopTable}
          emptyMessage="No quotes yet."
        />
      )}
    </AppLayout>
  );
}