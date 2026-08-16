'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VerificationForm from '@/components/payment/VerificationForm';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  discount_percent: number;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: any; // Allow additional properties from API response
}

interface VerificationContentProps {
  searchParams: URLSearchParams;
}

function VerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get plan_id from URL params
  const planIdFromUrl = searchParams.get('plan_id');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscription-plans');
      if (!response.ok) throw new Error('Failed to fetch plans');

      const data = await response.json();
      const plansData = data.plans || [];
      const activePlans = plansData.filter((plan: any) => plan.is_active);
      setPlans(activePlans as Plan[]);

      // Pre-select plan if provided in URL
      if (planIdFromUrl) {
        const plan = activePlans.find((p: any) => p.id === planIdFromUrl);
        if (plan) {
          setSelectedPlan(plan as Plan);
        }
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      setError('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
    // Update URL without page reload
    const url = new URL(window.location.href);
    url.searchParams.set('plan_id', plan.id);
    window.history.pushState({}, '', url.toString());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin mr-3 text-indigo-600" />
            <p className="text-stone-600">Loading payment verification...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-red-900">Error</h3>
            </div>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => router.push('/subscription/checkout')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
            >
              Back to Plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">
            Submit Payment Verification
          </h1>
          <p className="text-stone-600">
            Upload your payment proof to activate your subscription
          </p>
        </div>

        {!selectedPlan ? (
          /* Plan Selection */
          <div className="bg-white rounded-xl p-6 border border-stone-200">
            <h3 className="text-lg font-semibold text-stone-900 mb-4">
              Select Subscription Plan
            </h3>

            {plans.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  No active subscription plans available. Please contact support.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handlePlanSelect(plan)}
                    className="w-full p-4 border border-stone-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-stone-900">{plan.name}</h4>
                        <p className="text-sm text-stone-600">{plan.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-stone-900">
                          ₱{plan.price.toLocaleString()}
                        </div>
                        <div className="text-xs text-stone-600">/{plan.interval}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Verification Form */
          <VerificationForm
            planId={selectedPlan.id}
            planName={selectedPlan.name}
            planAmount={selectedPlan.price}
          />
        )}

        {/* Help Section */}
        <div className="mt-8 bg-white rounded-xl p-6 border border-stone-200">
          <h3 className="font-semibold text-stone-900 mb-3">Need Help?</h3>
          <div className="space-y-2 text-sm text-stone-600">
            <p>• Make sure your screenshot shows the payment amount and date clearly</p>
            <p>• Include transaction reference number if available</p>
            <p>• Verification typically takes 24 hours or less</p>
            <p>• Contact support if you haven't heard back within 48 hours</p>
          </div>
          <a
            href="mailto:support@concetto.com"
            className="inline-block mt-4 text-sm text-indigo-600 hover:text-indigo-700"
          >
            Contact Support →
          </a>
        </div>
      </div>
    </div>
  );
}

export default function VerificationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin mr-3 text-indigo-600" />
            <p className="text-stone-600">Loading payment verification...</p>
          </div>
        </div>
      </div>
    }>
      <VerificationContent />
    </Suspense>
  );
}