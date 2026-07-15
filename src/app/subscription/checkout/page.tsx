'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
      // Create subscription request (without PayMongo)
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan_id: selectedPlan,
          payment_method: 'manual' // Indicate manual payment processing
        })
      });

      // Handle response
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create subscription request');
      }

      const data = await response.json();

      // Redirect to account/subscription with payment instructions
      router.push('/account/subscription?request_created=true');

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6">
            <span className="text-3xl">🛡️</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Start your 3-day free trial. Cancel anytime.
          </p>
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <span className="text-green-600 text-lg">✓</span>
            <span className="text-green-800 font-medium text-sm">
              3-day free trial • No credit card required for trial • Cancel anytime
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-red-600 text-xl flex-shrink-0 mt-0.5">⚠️</span>
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
        <div className="mb-10">
          <PlanComparison
            onPlanSelect={handlePlanSelect}
            selectedPlan={selectedPlan}
          />
        </div>

        {/* Selected Plan Summary */}
        {selectedPlan && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">✓</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">Plan Selected</p>
                  <p className="text-xs text-blue-700">Ready to start your free trial</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-blue-900">3-Day Free Trial</p>
                <p className="text-xs text-blue-700">No credit card required</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Section */}
        <div className="flex flex-col items-center gap-6">
          <button
            onClick={handleSubscribe}
            disabled={isButtonDisabled}
            className={`
              px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200
              ${isButtonDisabled
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transform hover:scale-105'
              }
              ${isLoading ? 'cursor-wait' : ''}
            `}
            style={{ minHeight: '56px', minWidth: '280px' }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-xl animate-spin">⏳</span>
                <span>Setting up your trial...</span>
              </div>
            ) : (
              'Start Free Trial'
            )}
          </button>

          {/* Trust Elements */}
          <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="text-green-600">🛡️</span>
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
        <div className="mt-12 text-center">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-3xl mx-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Why choose our subscription plans?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Flexible Pricing</h4>
                <p className="text-sm text-gray-600">
                  Start with our Basic plan and upgrade as your business grows. No long-term contracts.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Risk-Free Trial</h4>
                <p className="text-sm text-gray-600">
                  Try our Pro plan free for 3 days. Experience all premium features before committing.
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
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <p className="text-gray-600">Loading checkout...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}