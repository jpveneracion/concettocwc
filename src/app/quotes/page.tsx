'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import ResponsiveTable from '@/components/ResponsiveTable';
import type { Quote } from '@/types';
import { phpFormat } from '@/lib/calc';

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[] | null>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchQuotes(); }, []);

  async function fetchQuotes() {
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
  }

  async function deleteQuote(id: string, num: string) {
    if (!confirm(`Delete quote ${num}?`)) return;
    await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
    fetchQuotes();
  }

  async function changeStatus(id: string, currentStatus: string, newStatus: string, quoteNum: string) {
    if (!confirm(`Change status for quote ${quoteNum} from "${currentStatus}" to "${newStatus}"?`)) return;

    try {
      const res = await fetch(`/api/quotes/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error?.error || 'Failed to update status');
        return;
      }

      fetchQuotes();
    } catch (err) {
      console.error('Failed to change status:', err);
      alert('Failed to update status');
    }
  }

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  };

  // Mobile card render function
  const renderMobileCard = (quote: Quote, index: number) => {
    return (
      <div key={quote.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        {/* Card header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="font-semibold text-lg">#{quote.quote_number}</div>
            <div className="text-gray-600 text-sm">{quote.customer_name}</div>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor[quote.status]}`}>
            {quote.status}
          </span>
        </div>

        {/* Card body */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Date:</span>
            <span>{quote.quote_date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Panels:</span>
            <span>{quote.panel_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total:</span>
            <span className="font-semibold">{phpFormat(quote.total)}</span>
          </div>
        </div>

        {/* Card actions */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="flex gap-2">
            <select
              value={quote.status}
              onChange={(e) => changeStatus(quote.id, quote.status, e.target.value, quote.quote_number)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded bg-white"
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
              className="px-3 py-2 text-sm border border-gray-300 rounded text-center hover:bg-gray-50"
            >
              ✏️ Edit
            </Link>
            <Link
              href={`/quotes/${quote.id}?print=quotation`}
              className="px-3 py-2 text-sm border border-gray-300 rounded text-center hover:bg-gray-50"
            >
              🖨️ Quote
            </Link>
            <Link
              href={`/quotes/${quote.id}?print=po`}
              className="px-3 py-2 text-sm border border-gray-300 rounded text-center hover:bg-gray-50"
            >
              🚚 PO
            </Link>
            <button
              onClick={() => deleteQuote(quote.id, quote.quote_number)}
              className="px-3 py-2 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50"
            >
              🗑️ Delete
            </button>
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
            {['Quote #', 'Customer', 'Date', 'Panels', 'Total', 'Status', 'Actions'].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {quotes?.map((q) => (
            <tr key={q.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{q.quote_number}</td>
              <td className="px-4 py-3">{q.customer_name}</td>
              <td className="px-4 py-3">{q.quote_date}</td>
              <td className="px-4 py-3">{q.panel_count}</td>
              <td className="px-4 py-3 font-medium">{phpFormat(q.total)}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[q.status]}`}>
                  {q.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2 items-center">
                  <select
                    value={q.status}
                    onChange={(e) => changeStatus(q.id, q.status, e.target.value, q.quote_number)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 bg-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <Link
                    href={`/quotes/${q.id}`}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                  >
                    ✏️ Edit
                  </Link>
                  <Link
                    href={`/quotes/${q.id}?print=quotation`}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                  >
                    🖨️ Quote
                  </Link>
                  <Link
                    href={`/quotes/${q.id}?print=po`}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                  >
                    🚚 PO
                  </Link>
                  <button
                    onClick={() => deleteQuote(q.id, q.quote_number)}
                    className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                  >
                    🗑️
                  </button>
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
        <h1 className="text-lg font-semibold md:text-xl">Orders</h1>
        <Link
          href="/quotes/new"
          className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          ➕ New quote
        </Link>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
          Loading...
        </div>
      ) : error ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-red-600">
          {error}
        </div>
      ) : !Array.isArray(quotes) || quotes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
          No quotes yet.{' '}
          <Link href="/quotes/new" className="text-blue-600 underline">Create your first one.</Link>
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