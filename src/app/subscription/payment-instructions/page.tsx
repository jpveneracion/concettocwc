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
      // Submit payment proof with all relevant details
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
        // Redirect to success page or account
        router.push('/payment/verification/success?reference_id=' + (await response.json()).verification_id);
      }
    } catch (error) {
      console.error('Error submitting proof:', error);
    }
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