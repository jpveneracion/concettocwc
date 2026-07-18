'use client';

import { useState } from 'react';
import ScreenshotUpload from './ScreenshotUpload';

interface PaymentProofSectionProps {
  planId: string;
  planName: string;
  finalAmount: number;
  paymentMethod: string;
  promoCode?: string;
  onSubmit: (proofData: any) => void;
}

export default function PaymentProofSection({
  planId,
  planName,
  finalAmount,
  paymentMethod,
  promoCode,
  onSubmit
}: PaymentProofSectionProps) {
  const [screenshot, setScreenshot] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceTouched, setReferenceTouched] = useState<boolean>(false);

  const validateReferenceNumber = (value: string): string | null => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return 'GCash transaction number is required';
    }

    // Check if value contains only digits
    if (!/^\d+$/.test(trimmedValue)) {
      return 'Transaction number must contain only digits (no letters or special characters)';
    }

    // Check length (10-15 digits, standard GCash format is 13)
    if (trimmedValue.length < 10 || trimmedValue.length > 15) {
      return 'Transaction number must be 10-15 digits (standard GCash format is 13 digits)';
    }

    return null;
  };

  const handleReferenceNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setReferenceNumber(value);

    if (referenceTouched) {
      const error = validateReferenceNumber(value);
      setReferenceError(error);
    }
  };

  const handleReferenceNumberBlur = () => {
    setReferenceTouched(true);
    const error = validateReferenceNumber(referenceNumber);
    setReferenceError(error);
  };

  const handleSubmit = async () => {
    if (!screenshot) {
      setError('Please upload a payment screenshot');
      return;
    }

    // Validate reference number
    setReferenceTouched(true);
    const refError = validateReferenceNumber(referenceNumber);
    setReferenceError(refError);

    if (refError) {
      setError('Please fix the form errors before submitting');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        screenshot_base64: screenshot,
        reference_number: referenceNumber.trim(),
        notes: notes.trim() || undefined,
        payment_method: paymentMethod,
        promo_code: promoCode
      });

      setSubmitted(true);
    } catch (err) {
      setError('Failed to submit payment proof. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-xl p-6 border border-green-200 mb-6">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Payment Proof Submitted!
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
                <li>• You can check status in your account settings</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => window.location.href = '/account/subscription'}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Go to My Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Submit Payment Proof
      </h3>

      {/* Payment Summary */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <h4 className="font-medium text-gray-900 mb-2">Payment Summary</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Plan:</span>
            <span className="text-gray-900">{planName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Payment Method:</span>
            <span className="text-gray-900 capitalize">{paymentMethod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Amount Paid:</span>
            <span className="text-gray-900 font-medium">{formatCurrency(finalAmount)}</span>
          </div>
          {promoCode && (
            <div className="flex justify-between">
              <span className="text-gray-600">Promo Code:</span>
              <span className="text-gray-900">{promoCode.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Screenshot Upload */}
        <ScreenshotUpload
          onScreenshotSelect={setScreenshot}
        />

        {/* Reference Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            GCash Transaction Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={referenceNumber}
            onChange={handleReferenceNumberChange}
            onBlur={handleReferenceNumberBlur}
            placeholder="e.g., 1234567890123"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none font-mono ${
              referenceError
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : referenceTouched && referenceNumber
                ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }`}
          />
          {referenceError && (
            <p className="mt-1 text-xs text-red-600">{referenceError}</p>
          )}
          {!referenceError && (
            <p className="mt-1 text-xs text-gray-500">
              Enter the 13-digit transaction number from your GCash receipt. Required for automatic verification and speeds up processing.
            </p>
          )}
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
          disabled={!screenshot || !referenceNumber || !!referenceError || isSubmitting}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Payment Proof'}
        </button>

        {/* Help Notice */}
        <div className="bg-yellow-50 rounded-lg p-3">
          <p className="text-xs text-yellow-700">
            <strong>Important:</strong> Please ensure your screenshot clearly shows the payment amount,
            date, and transaction reference. The GCash transaction number is required for automatic verification.
            Blurred or incomplete screenshots may delay verification.
          </p>
        </div>
      </div>
    </div>
  );
}