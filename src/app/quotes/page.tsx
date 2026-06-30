'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
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

      if (!res.ok || !Array.isArray(data)) {
        setError(data?.error || 'Failed to load quotes.');
        setQuotes(null);
      } else {
        setQuotes(data);
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

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  };

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">Quotes</h1>
        <Link
          href="/quotes/new"
          className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          ➕ New quote
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-600">
            {error}
          </div>
        ) : !Array.isArray(quotes) || quotes.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No quotes yet.{' '}
            <Link href="/quotes/new" className="text-blue-600 underline">Create your first one.</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {['Quote #', 'Customer', 'Date', 'Panels', 'Total', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
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
                    <div className="flex gap-2">
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
        )}
      </div>
    </AppLayout>
  );
}
