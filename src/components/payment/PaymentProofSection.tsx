'use client';

import { useState } from 'react';
import ScreenshotUpload from './ScreenshotUpload';
import { CheckCircle2, Info } from 'lucide-react';

interface PaymentProofData {
  screenshot_base64: string;
  reference_number: string;
  notes?: string;
  payment_method: string;
  promo_code?: string;
}

interface PaymentProofSectionProps {
  planId: string;
  planName: string;
  finalAmount: number;
  paymentMethod: string;
  promoCode?: string;
  onSubmit: (proofData: PaymentProofData) => void;
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
    const methodLabel = paymentMethod === 'gotyme' ? 'GoTyme' : paymentMethod === 'pi' ? 'Pi Network' : 'GCash';

    if (!trimmedValue) {
      return `${methodLabel} transaction ID is required`;
    }

    // Check if value contains only alphanumeric characters
    if (!/^[a-zA-Z0-9]+$/.test(trimmedValue)) {
      return 'Transaction ID must be alphanumeric only (no letters with symbols or special characters)';
    }

    // Check length (GCash standard 13 chars, GoTyme standard 17 chars, Pi txid up to 64 chars)
    const maxLength = paymentMethod === 'gotyme' ? 20 : paymentMethod === 'pi' ? 64 : 15;
    const standardLength = paymentMethod === 'gotyme' ? 17 : paymentMethod === 'pi' ? 0 : 13;
    if (trimmedValue.length < 10 || trimmedValue.length > maxLength) {
      return `Transaction ID must be 10-${maxLength} characters${standardLength ? ` (standard ${methodLabel} format is ${standardLength} characters)` : ''}`;
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
      setError(err instanceof Error && err.message
        ? err.message
        : 'Failed to submit payment proof. Please try again.');
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
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-600" />
          <h3 className="text-lg font-semibold text-stone-900 mb-2">
            Payment Proof Submitted!
          </h3>
          <p className="text-stone-600 text-sm">
            Your payment proof has been submitted for verification.
          </p>
        </div>

        <div className="bg-indigo-50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <Info className="w-6 h-6 text-indigo-600 flex-shrink-0" />
            <div className="text-left">
              <p className="font-medium text-indigo-900">What happens next?</p>
              <ul className="text-sm text-indigo-700 mt-2 space-y-1">
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
            className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
          >
            Go to My Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-stone-200 mb-6">
      <h3 className="text-lg font-semibold text-stone-900 mb-4">
        Submit Payment Proof
      </h3>

      {/* Payment Summary */}
      <div className="bg-stone-50 rounded-lg p-4 mb-4">
        <h4 className="font-medium text-stone-900 mb-2">Payment Summary</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-600">Plan:</span>
            <span className="text-stone-900">{planName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">Payment Method:</span>
            <span className="text-stone-900 capitalize">{paymentMethod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">Amount Paid:</span>
            <span className="text-stone-900 font-medium">{formatCurrency(finalAmount)}</span>
          </div>
          {promoCode && (
            <div className="flex justify-between">
              <span className="text-stone-600">Promo Code:</span>
              <span className="text-stone-900">{promoCode.toUpperCase()}</span>
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
          <label className="block text-sm font-medium text-stone-700 mb-2">
            {paymentMethod === 'gotyme' ? 'GoTyme' : paymentMethod === 'pi' ? 'Pi Network' : 'GCash'} Transaction ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={referenceNumber}
            onChange={handleReferenceNumberChange}
            onBlur={handleReferenceNumberBlur}
            placeholder={paymentMethod === 'pi' ? "e.g., txid from your Pi Wallet" : "e.g., 1234567890123"}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none font-mono ${
              referenceError
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : referenceTouched && referenceNumber
                ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                : 'border-stone-300 focus:ring-indigo-500 focus:border-indigo-500'
            }`}
          />
          {referenceError && (
            <p className="mt-1 text-xs text-red-600">{referenceError}</p>
          )}
          {!referenceError && (
            <p className="mt-1 text-xs text-stone-500">
              {paymentMethod === 'pi'
                ? 'Enter the transaction ID (txid) from your Pi Wallet payment confirmation. Required for verification.'
                : `Enter the ${paymentMethod === 'gotyme' ? '17-digit' : '13-digit'} transaction number from your ${paymentMethod === 'gotyme' ? 'GoTyme' : 'GCash'} receipt. Required for automatic verification and speeds up processing.`}
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Additional Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional information about your payment..."
            rows={3}
            className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
          className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Payment Proof'}
        </button>

        {/* Help Notice */}
        <div className="bg-yellow-50 rounded-lg p-3">
          <p className="text-xs text-yellow-700">
            <strong>Important:</strong> Please ensure your screenshot clearly shows the payment amount,
            date, and transaction reference. The {paymentMethod === 'gotyme' ? 'GoTyme' : paymentMethod === 'pi' ? 'Pi Network txid' : 'GCash'} transaction ID is required for verification.
            Blurred or incomplete screenshots may delay verification.
          </p>
        </div>
      </div>
    </div>
  );
}