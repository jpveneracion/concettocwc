'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import QuoteForm from '@/components/QuoteForm';
import PrintDoc from '@/components/PrintDoc';
import type { Quote, Settings } from '@/types';

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const printType = searchParams.get('print') as 'quotation' | 'po' | null;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/quotes/${id}`).then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
    ]).then(([q, s]) => {
      setQuote(q);
      setSettings(s);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (printType && quote && settings) {
      setTimeout(() => window.print(), 300);
    }
  }, [printType, quote, settings]);

  if (loading) return <AppLayout><div className="p-8 text-gray-400">Loading...</div></AppLayout>;
  if (!quote || !settings) return <AppLayout><div className="p-8 text-gray-400">Quote not found.</div></AppLayout>;

  if (printType) {
    return (
      <>
        <div className="no-print p-4 bg-yellow-50 border-b border-yellow-200 text-sm text-yellow-800 flex justify-between items-center">
          <span>🖨️ Print preview — {printType === 'po' ? 'Purchase Order' : 'Customer Quotation'}</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-3 py-1 bg-blue-600 text-white rounded text-xs">Print now</button>
            <a href={`/quotes/${id}`} className="px-3 py-1 border border-gray-300 rounded text-xs">Back to edit</a>
          </div>
        </div>
        <div className="print-only" ref={printRef}>
          <PrintDoc quote={quote} settings={settings} type={printType} />
        </div>
        <div className="no-print p-8 max-w-4xl mx-auto">
          <PrintDoc quote={quote} settings={settings} type={printType} />
        </div>
      </>
    );
  }

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-semibold">Edit quote</h1>
          <p className="text-sm text-gray-400 mt-0.5">{quote.quote_number}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/quotes/${id}?print=quotation`} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">🖨️ Print quotation</a>
          <a href={`/quotes/${id}?print=po`} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">🚚 Print PO</a>
        </div>
      </div>
      <QuoteForm existing={quote} quoteNumber={quote.quote_number} />
    </AppLayout>
  );
}
