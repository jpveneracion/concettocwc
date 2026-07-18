'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PaymentMethodSelector from '@/components/payment/PaymentMethodSelector';
import QRCodeDisplay from '@/components/payment/QRCodeDisplay';
import CryptoPaymentInfo from '@/components/payment/CryptoPaymentInfo';
import PromoCodeInput from '@/components/payment/PromoCodeInput';
import PaymentProofSection from '@/components/payment/PaymentProofSection';
import { PaymentMethod } from '@/types/payment';

interface PlanDetails {
  id: string;
  name: string;
  price: number;
  description: string;
}

function PaymentInstructionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [plan, setPlan] = useState<PlanDetails | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('gcash');
  const [promoCode, setPromoCode] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [finalAmount, setFinalAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Verification state management
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'checking' | 'success' | 'pending' | 'error'>('idle');
  const [gracePeriodCountdown, setGracePeriodCountdown] = useState<number>(0);
  const [verificationId, setVerificationId] = useState<string>('');

  const planId = searchParams.get('plan_id');

  useEffect(() => {
    if (planId) {
      fetchPlanDetails(planId);
    }
  }, [planId]);

  useEffect(() => {
    if (plan) {
      setFinalAmount(plan.price - discount);
    }
  }, [plan, discount]);

  // Countdown effect for grace period
  useEffect(() => {
    if (gracePeriodCountdown > 0 && verificationStatus === 'pending') {
      const timer = setTimeout(() => {
        setGracePeriodCountdown(gracePeriodCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gracePeriodCountdown === 0 && verificationStatus === 'pending') {
      // Grace period ended, redirect to manual pending page
      router.push('/payment/verification/pending');
    }
  }, [gracePeriodCountdown, verificationStatus, router]);

  const fetchPlanDetails = async (id: string) => {
    try {
      setLoading(true);
      // In a real implementation, fetch from your API
      // For now, using mock data
      const mockPlans: Record<string, PlanDetails> = {
        'basic': { id: 'basic', name: 'Basic Plan', price: 499, description: 'Perfect for small businesses' },
        'pro': { id: 'pro', name: 'Pro Plan', price: 999, description: 'For growing companies' }
      };

      const planDetails = mockPlans[id] || mockPlans['basic'];
      setPlan(planDetails);
    } catch (error) {
      console.error('Error fetching plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePromoApply = async (code: string) => {
    setValidatingPromo(true);
    setPromoError(null);

    try {
      // Call your existing activation API
      const response = await fetch('/api/validate-promo-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, plan_id: plan?.id })
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setPromoCode(code);
        setDiscount(data.discount_amount || data.discount_percent ? (plan!.price * (data.discount_percent / 100)) : 0);
      } else {
        setPromoError(data.error || 'Invalid promo code');
      }
    } catch (error) {
      setPromoError('Failed to validate promo code');
    } finally {
      setValidatingPromo(false);
    }
  };

  const handlePromoRemove = () => {
    setPromoCode('');
    setDiscount(0);
    setPromoError(null);
  };

  const handlePaymentProofSubmit = async (proofData: any) => {
    try {
      // Step 1: Set verification status to 'checking' immediately
      setVerificationStatus('checking');

      // Step 2: Submit payment proof with all relevant details
      const response = await fetch('/api/payment-verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: plan?.id,
          payment_method: selectedMethod,
          promo_code: promoCode,
          final_amount: finalAmount,
          ...proofData
        })
      });

      if (response.ok) {
        const data = await response.json();

        // Step 3: Check verification_method from response
        if (data.verification_method === 'automatic') {
          // Immediate success flow
          setVerificationStatus('success');
          setTimeout(() => {
            router.push('/payment/verification/success?reference_id=' + data.verification_id);
          }, 2000);
        } else {
          // Manual verification - start grace period flow
          setVerificationId(data.verification_id);
          setVerificationStatus('pending');
          setGracePeriodCountdown(10);

          // Start polling for webhook data
          pollForVerification(data.verification_id);
        }
      } else {
        setVerificationStatus('error');
      }
    } catch (error) {
      console.error('Error submitting proof:', error);
      setVerificationStatus('error');
    }
  };

  const pollForVerification = async (id: string) => {
    const pollInterval = 2000; // Poll every 2 seconds
    const maxPolls = 5; // Maximum 5 polls (10 seconds total)
    let pollCount = 0;

    const poll = async () => {
      if (pollCount >= maxPolls || verificationStatus === 'success') {
        return;
      }

      try {
        const response = await fetch(`/api/payment-verifications/${id}`);
        if (response.ok) {
          const data = await response.json();

          // Check if verification was approved during grace period
          if (data.status === 'approved' || data.verification_method === 'automatic') {
            setVerificationStatus('success');
            setTimeout(() => {
              router.push('/payment/verification/success?reference_id=' + id);
            }, 2000);
            return;
          }

          pollCount++;
          setTimeout(poll, pollInterval);
        }
      } catch (error) {
        console.error('Error polling verification:', error);
        pollCount++;
        setTimeout(poll, pollInterval);
      }
    };

    poll();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center">
            <div className="animate-spin text-4xl mr-3">⏳</div>
            <p className="text-gray-600">Loading payment instructions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-red-900 mb-2">Plan Not Found</h3>
            <p className="text-red-700 mb-4">Unable to find the selected plan. Please try again.</p>
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

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Complete Your Subscription
          </h1>
          <p className="text-gray-600">
            Follow the payment instructions below to activate your {plan.name}
          </p>
        </div>

        {/* Plan Summary */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
              <p className="text-sm text-gray-600">{plan.description}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(finalAmount)}
              </p>
              {discount > 0 && (
                <p className="text-sm text-green-600 line-through">
                  {formatCurrency(plan.price)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <PaymentMethodSelector
          selectedMethod={selectedMethod}
          onMethodChange={(method: PaymentMethod) => setSelectedMethod(method)}
        />

        {/* Promo Code */}
        <PromoCodeInput
          code={promoCode}
          discount={discount}
          onApply={handlePromoApply}
          onRemove={handlePromoRemove}
          error={promoError}
          loading={validatingPromo}
        />

        {/* Payment Instructions */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Payment Instructions
          </h3>

          {selectedMethod === 'gcash' || selectedMethod === 'gotyme' ? (
            <QRCodeDisplay
              method={selectedMethod}
              amount={finalAmount}
              planName={plan.name}
              promoCode={promoCode}
            />
          ) : selectedMethod === 'usdc' ? (
            <CryptoPaymentInfo
              amount={finalAmount}
              planName={plan.name}
            />
          ) : null}
        </div>

        {/* Payment Proof Submission */}
        <PaymentProofSection
          planId={plan.id}
          planName={plan.name}
          finalAmount={finalAmount}
          paymentMethod={selectedMethod}
          promoCode={promoCode}
          onSubmit={handlePaymentProofSubmit}
        />

        {/* Help Section */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 mt-6">
          <h3 className="font-semibold text-gray-900 mb-3">Need Help?</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• Make sure your payment screenshot shows the amount and date clearly</p>
            <p>• Include transaction reference number if available</p>
            <p>• Verification typically takes 24 hours or less</p>
            <p>• Contact support if you haven't heard back within 48 hours</p>
          </div>
          <a
            href="mailto:support@concetto.com"
            className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-700"
          >
            Contact Support →
          </a>
        </div>

        {/* Optimistic UI Overlays */}

        {/* Checking State */}
        {verificationStatus === 'checking' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Verifying your payment via network...
              </h3>
              <p className="text-gray-600">This typically takes less than 5 seconds</p>
            </div>
          </div>
        )}

        {/* Pending Grace Period */}
        {verificationStatus === 'pending' && gracePeriodCountdown > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center">
              <div className="animate-pulse text-4xl mb-4">📱</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Waiting for network confirmation...
              </h3>
              <p className="text-gray-600 mb-4">
                Checking for GCash notification ({gracePeriodCountdown}s remaining)
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${(10 - gracePeriodCountdown) * 10}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {verificationStatus === 'success' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Payment Verified Automatically!
              </h3>
              <p className="text-gray-600 mb-4">
                Your subscription is being activated now
              </p>
              <p className="text-sm text-green-600">Redirecting...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {verificationStatus === 'error' && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center">
              <div className="text-4xl mb-4">❌</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Payment Verification Error
              </h3>
              <p className="text-gray-600 mb-4">
                There was an error processing your payment verification
              </p>
              <button
                onClick={() => setVerificationStatus('idle')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentInstructionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center">
            <div className="animate-spin text-4xl mr-3">⏳</div>
            <p className="text-gray-600">Loading payment instructions...</p>
          </div>
        </div>
      </div>
    }>
      <PaymentInstructionsContent />
    </Suspense>
  );
}