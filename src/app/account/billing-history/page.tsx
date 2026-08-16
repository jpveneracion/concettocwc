'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';

interface BillingEntry {
  id: string;
  plan_name: string | null;
  amount: number;
  payment_method: string | null;
  reference_number: string | null;
  promo_code: string | null;
  discount_amount: number;
  verified_at: string | null;
  created_at: string;
}

type LoadState = 'loading' | 'success' | 'error' | 'empty';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0
  }).format(amount);
}

function formatMethod(method: string | null): string {
  if (!method) return '—';
  const labels: Record<string, string> = {
    gcash: 'GCash',
    gotyme: 'GoTyme',
    usdc: 'USDC',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
    manual: 'Manual'
  };
  return labels[method.toLowerCase()] || method;
}

export default function BillingHistoryPage() {
  const [payments, setPayments] = useState<BillingEntry[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch('/api/account/billing-history');
        if (res.status === 401) {
          setError('Authentication required. Please log in again.');
          setState('error');
          return;
        }
        if (!res.ok) {
          throw new Error('Failed to load billing history');
        }
        const data = await res.json();
        setPayments(data.payments || []);
        setState(data.payments?.length ? 'success' : 'empty');
      } catch (err) {
        console.error('Billing history fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load billing history');
        setState('error');
      }
    }
    fetchHistory();
  }, []);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/account/subscription"
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              ← Back to Subscription
            </Link>
          </div>
          <h1 className="text-xl font-semibold mb-2">Billing History</h1>
          <p className="text-stone-500 text-sm">Your approved payments and subscriptions.</p>
        </div>

        {state === 'loading' && (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-stone-500 text-sm">Loading billing history...</p>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {state === 'empty' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800 text-sm mb-4">No billing history yet.</p>
            <Link
              href="/subscription/checkout"
              className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Choose a Plan
            </Link>
          </div>
        )}

        {state === 'success' && (
          <div className="space-y-3">
            {payments.map((payment) => {
              const total = payment.amount;
              const discount = Number(payment.discount_amount) || 0;
              const full = total + discount;
              return (
                <div
                  key={payment.id}
                  className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="text-sm font-semibold text-stone-900">
                        {payment.plan_name || 'Subscription'}
                      </div>
                      <div className="text-xs text-stone-500">
                        {new Date(payment.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                        {' · '}
                        {formatMethod(payment.payment_method)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-stone-900">
                        {formatCurrency(total)}
                      </div>
                      {discount > 0 && (
                        <div className="text-xs text-stone-500 line-through">
                          {formatCurrency(full)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-stone-100">
                    {payment.reference_number && (
                      <span className="text-xs text-stone-500">
                        Ref: <span className="font-mono">{payment.reference_number}</span>
                      </span>
                    )}
                    {payment.promo_code && (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {payment.promo_code}
                      </span>
                    )}
                    {discount > 0 && (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        -{formatCurrency(discount)}
                      </span>
                    )}
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium ml-auto">
                      Paid
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
