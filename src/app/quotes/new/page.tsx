'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import QuoteForm from '@/components/QuoteForm';

export default function NewQuotePage() {
  const [quoteNumber, setQuoteNumber] = useState('');

  useEffect(() => {
    // Generate quote number from current count
    // API will validate session and return company code
    fetch('/api/quotes')
      .then((r) => {
        if (!r.ok) {
          // Session invalid - redirect to login
          window.location.href = '/login';
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;

        const yr = new Date().getFullYear().toString().slice(-2);
        const seq = (data.quotes.length + 1).toString().padStart(5, '0');
        setQuoteNumber(`${data.companyCode}-DF-QT-${yr}-${seq}`);
      })
      .catch(() => {
        window.location.href = '/login';
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
