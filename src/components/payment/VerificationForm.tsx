'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ScreenshotUpload from './ScreenshotUpload';

interface VerificationFormProps {
  planId: string;
  planName: string;
  planAmount: number;
}

export default function VerificationForm({
  planId,
  planName,
  planAmount
}: VerificationFormProps) {
  const router = useRouter();
  const [screenshot, setScreenshot] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!screenshot) {
      setError('Please upload a payment screenshot');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/payment-verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId,
          screenshot_base64: screenshot,
          reference_number: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Failed to submit payment verification');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToHistory = () => {
    router.push('/payment/verification/history');
  };

  const handleGoToAccount = () => {
    router.push('/account/subscription');
  };

  if (success) {
    return (
      <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Payment Verification Submitted!
          </h3>
          <p className="text-gray-600 text-sm">
            Your payment proof has been submitted for verification.
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="text-2xl">ℹ️</div>
            <div className="text-left">
              <p className="font-medium text-blue-900">What happens next?</p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                <li>• Our team will verify your payment within 24 hours</li>
                <li>• You'll receive a confirmation email once approved</li>
                <li>• Your subscription will be activated automatically</li>
                <li>• You can check status in your verification history</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleGoToHistory}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            View History
          </button>
          <button
            onClick={handleGoToAccount}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            My Account
          </button>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Submit Payment Verification
      </h3>

      {/* Plan Summary */}
      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <h4 className="font-medium text-gray-900 mb-2">Plan Details</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Plan:</span>
            <span className="text-gray-900">{planName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Amount:</span>
            <span className="text-gray-900 font-medium">{formatCurrency(planAmount)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {/* Screenshot Upload */}
        <ScreenshotUpload
          onScreenshotSelect={setScreenshot}
        />

        {/* Reference Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transaction Reference (Optional)
          </label>
          <input
            type="text"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="e.g., GCASH-123456789"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Reference number from your payment confirmation
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional information about your payment..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!screenshot || isSubmitting}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Payment Verification'}
        </button>

        {/* Help Notice */}
        <div className="bg-yellow-50 rounded-lg p-3">
          <p className="text-xs text-yellow-700">
            <strong>Important:</strong> Please ensure your screenshot clearly shows the payment amount,
            date, and transaction reference. Blurred or incomplete screenshots may delay verification.
          </p>
        </div>
      </div>
    </div>
  );
}