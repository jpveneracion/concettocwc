'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import PlanComparison from '@/components/subscription/PlanComparison';

interface CheckoutError {
  type: 'validation' | 'api' | 'network';
  message: string;
}

/**
 * Checkout Content Component
 *
 * Handles the main checkout functionality and uses searchParams
 * This is separated to enable proper Suspense boundary wrapping
 */
function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<CheckoutError | null>(null);

  // Check for cancelled payment in URL params
  useEffect(() => {
    const cancelled = searchParams.get('cancelled');
    if (cancelled === 'true') {
      setError({
        type: 'validation',
        message: 'Payment was cancelled. Please try again or contact support if you continue to have issues.'
      });
    }
  }, [searchParams]);

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    setError(null); // Clear any existing errors when user selects a plan
  };

  const validateSelection = (): boolean => {
    if (!selectedPlan) {
      setError({
        type: 'validation',
        message: 'Please select a subscription plan to continue.'
      });
      return false;
    }
    return true;
  };

  const handleSubscribe = async () => {
    // Validation
    if (!validateSelection()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create subscription request for manual payment processing
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan_id: selectedPlan,
          payment_method: 'manual', // Indicate manual payment processing
          success_url: `${window.location.origin}/account/subscription?subscription_created=true`,
          cancel_url: `${window.location.origin}/subscription/checkout?cancelled=true`
        })
      });

      // Handle response
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create subscription request');
      }

      const data = await response.json();

      // Redirect to payment instructions page with plan details
      router.push(`/subscription/payment-instructions?plan_id=${selectedPlan}`);

    } catch (err) {
      console.error('Subscription creation error:', err);

      // Determine error type
      let errorType: CheckoutError['type'] = 'network';
      let errorMessage = 'Network error. Please check your connection and try again.';

      if (err instanceof Error) {
        if (err.message.includes('Unauthorized')) {
          errorType = 'api';
          errorMessage = 'You need to log in to subscribe. Please sign in and try again.';
        } else if (err.message.includes('active subscription')) {
          errorType = 'api';
          errorMessage = 'You already have an active subscription. Visit your account page to manage your plan.';
        } else if (err.message.includes('Invalid plan')) {
          errorType = 'validation';
          errorMessage = 'Selected plan is not available. Please choose a different plan.';
        }
      }

      setError({
        type: errorType,
        message: errorMessage
      });

    } finally {
      setIsLoading(false);
    }
  };

  const isButtonDisabled = !selectedPlan || isLoading;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-2">Choose Your Plan</h1>
        <p className="text-gray-500 text-sm">Select a subscription plan that fits your needs. Cancel anytime.</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-600 text-lg flex-shrink-0">⚠️</span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">
                {error.type === 'validation' ? 'Action Required' : 'Unable to Complete Request'}
              </h3>
              <p className="text-sm text-red-700">{error.message}</p>
              {error.type === 'api' && (
                <div className="mt-3">
                  <Link
                    href="/login"
                    className="text-sm font-medium text-red-700 hover:text-red-900 underline"
                  >
                    Go to login page
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan Comparison */}
      <div className="mb-6">
        <PlanComparison
          onPlanSelect={handlePlanSelect}
          selectedPlan={selectedPlan}
        />
      </div>

      {/* Selected Plan Summary */}
      {selectedPlan && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">✓</span>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">Plan Selected</p>
              <p className="text-xs text-blue-700">Ready to proceed with subscription</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Section */}
      <div className="mb-6">
        <button
          onClick={handleSubscribe}
          disabled={isButtonDisabled}
          className={`
            px-6 py-3 rounded-lg font-medium text-white transition-colors
            ${isButtonDisabled
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
            }
            ${isLoading ? 'cursor-wait' : ''}
          `}
        >
          {isLoading ? 'Processing...' : 'Proceed to Payment'}
        </button>

        {/* Trust Elements */}
        <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span>SSL Secured</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span>No hidden fees</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Why choose our subscription plans?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Flexible Pricing</h4>
            <p className="text-sm text-gray-600">
              Start with our Basic plan and upgrade as your business grows. No long-term contracts.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Dedicated Support</h4>
            <p className="text-sm text-gray-600">
              Get help when you need it with our priority support channels for Pro plan subscribers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Subscription Checkout Page
 *
 * Main page component that wraps the checkout content in a Suspense boundary
 * This is required for proper handling of useSearchParams() in Next.js 13+ App Router
 */
export default function CheckoutPage() {
  return (
    <AppLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500 text-sm">Loading checkout...</p>
          </div>
        </div>
      }>
        <CheckoutContent />
      </Suspense>
    </AppLayout>
  );
}