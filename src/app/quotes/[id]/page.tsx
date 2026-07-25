'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import QuoteForm from '@/components/QuoteForm';
import PrintDoc from '@/components/PrintDoc';
import DemoWatermark from '@/components/DemoWatermark';
import type { Quote, Settings } from '@/types';
import { generatePDF } from '@/lib/pdf-utils';
import { generatePoNumber } from '@/lib/calc';

function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const printType = searchParams.get('print') as 'quotation' | 'po' | null;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

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

  const handleDownloadPDF = (type: 'quotation' | 'po') => {
    if (!quote || !settings) return;

    const filename = type === 'po'
      ? `PO-${generatePoNumber(quote.quote_number)}.pdf`
      : `Quotation-${quote.quote_number}.pdf`;

    const elementToPrint = pdfRef.current;
    if (elementToPrint) {
      generatePDF(elementToPrint, filename);
    }
  };

  if (loading) return <AppLayout><div className="p-8 text-gray-400">Loading...</div></AppLayout>;
  if (!quote || !settings) return <AppLayout><div className="p-8 text-gray-400">Quote not found.</div></AppLayout>;

  if (printType) {
    return (
      <>
        <div className="no-print p-4 bg-yellow-50 border-b border-yellow-200 text-sm text-yellow-800">
          <div className="flex justify-between items-center mb-3">
            <div className="font-semibold">🖨️ Print preview — {printType === 'po' ? 'Purchase Order' : 'Customer Quotation'}</div>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded text-xs min-h-[44px] min-w-[44px]">Print now</button>
              <a href={`/quotes/${id}`} className="px-4 py-2 border border-gray-300 rounded text-xs min-h-[44px] min-w-[44px]">Back to edit</a>
            </div>
          </div>

          <div className="bg-white border border-gray-300 rounded-lg p-3 text-xs">
            <div className="font-semibold text-gray-800 mb-2">📋 To remove headers/footers from print:</div>
            <div className="space-y-1 text-gray-700">
              <div><strong>Chrome/Edge:</strong> Print → More settings → Uncheck "Headers and footers"</div>
              <div><strong>Firefox:</strong> Print → Appearance → Uncheck headers/footers</div>
              <div><strong>Safari:</strong> Print → Show details → Uncheck "Print headers and footers"</div>
            </div>
          </div>
        </div>
        <DemoWatermark subscriptionStatus={settings.subscription_status} printMode={true}>
          <div className="print-only" ref={printRef}>
            <PrintDoc quote={quote} settings={settings} type={printType} />
          </div>
          <div className="no-print p-8 max-w-4xl mx-auto">
            <PrintDoc quote={quote} settings={settings} type={printType} />
          </div>
        </DemoWatermark>
      </>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl font-semibold">Edit quote</h1>
          <p className="text-sm text-gray-400 mt-0.5">{quote.quote_number}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => handleDownloadPDF('quotation')} className="px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 min-h-[44px] min-w-[44px]">📄 Download Quotation PDF</button>
            <button onClick={() => handleDownloadPDF('po')} className="px-4 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 min-h-[44px] min-w-[44px]">📄 Download PO PDF</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href={`/quotes/${id}?print=quotation`} className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px] min-w-[44px]">🖨️ Print quotation</a>
            <a href={`/quotes/${id}?print=po`} className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px] min-w-[44px]">🚚 Print PO</a>
          </div>
        </div>
      </div>
      <QuoteForm existing={quote} quoteNumber={quote.quote_number} />
      <div className="hidden">
        <div ref={pdfRef}>
          <PrintDoc quote={quote} settings={settings} type="quotation" />
        </div>
      </div>
    </AppLayout>
  );
}

export default function QuoteDetailPageWrapper() {
  return (
    <Suspense fallback={<AppLayout><div className="animate-pulse">Loading...</div></AppLayout>}>
      <QuoteDetailPage />
    </Suspense>
  );
}
