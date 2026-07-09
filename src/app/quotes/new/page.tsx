'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import QuoteWizard from '@/components/QuoteWizard';
import QuoteForm from '@/components/QuoteForm';

type WizardStepData = {
  customer: {
    customer_name: string;
    customer_address: string;
    quote_date: string;
    our_ref: string;
    status: string;
  };
  items: any[];
  installation_fee: number;
  delivery_fee: number;
};

export default function NewQuotePage() {
  const router = useRouter();
  const [quoteNumber, setQuoteNumber] = useState('');
  const [useWizard, setUseWizard] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleWizardSubmit = async (data: Record<string, unknown>) => {
    const wizardData = data as WizardStepData;

    if (!wizardData.customer?.customer_name?.trim()) {
      alert('Customer name is required.');
      return;
    }

    if (!wizardData.items?.some((r: any) => r.area_sqft > 0)) {
      alert('Add at least one window with measurements.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        quote_number: quoteNumber,
        customer_name: wizardData.customer.customer_name,
        customer_address: wizardData.customer.customer_address || '',
        quote_date: wizardData.customer.quote_date,
        our_ref: wizardData.customer.our_ref || '',
        status: wizardData.customer.status || 'draft',
        installation_fee: wizardData.installation_fee || 0,
        delivery_fee: wizardData.delivery_fee || 0,
        items: wizardData.items?.map((item: any) => {
          const { id, quote_id, ...rest } = item;
          return rest;
        }) || [],
      };

      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setSaving(false);

      if (res.ok) {
        router.push('/quotes');
      } else {
        const errorData = await res.json();
        alert(`Failed to save quote: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      setSaving(false);
      alert('Failed to save quote. Please try again.');
      console.error('Submit error:', error);
    }
  };

  if (!quoteNumber) return <AppLayout><div className="text-gray-400 p-8">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h1 className="text-lg font-semibold md:text-xl">New quote</h1>
        <button
          onClick={() => setUseWizard(!useWizard)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          {useWizard ? '📝 Traditional Form' : '🧙 Wizard Mode'}
        </button>
      </div>

      {useWizard ? (
        <div className="max-w-3xl">
          {saving ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
              Saving quote...
            </div>
          ) : (
            <QuoteWizard
              quoteNumber={quoteNumber}
              onComplete={handleWizardSubmit}
            />
          )}
        </div>
      ) : (
        <QuoteForm quoteNumber={quoteNumber} />
      )}
    </AppLayout>
  );
}