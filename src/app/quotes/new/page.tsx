'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import QuoteForm from '@/components/QuoteForm';

export default function NewQuotePage() {
  const [quoteNumber, setQuoteNumber] = useState('');

  useEffect(() => {
    // Generate quote number from current count
    fetch('/api/quotes')
      .then((r) => r.json())
      .then((quotes) => {
        const yr = new Date().getFullYear().toString().slice(-2);
        const seq = (quotes.length + 1).toString().padStart(5, '0');
        setQuoteNumber(`CWC-DF-QT-${yr}-${seq}`);
      });
  }, []);

  if (!quoteNumber) return <AppLayout><div className="text-gray-400 p-8">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">New quote</h1>
      </div>
      <QuoteForm quoteNumber={quoteNumber} />
    </AppLayout>
  );
}
