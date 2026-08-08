'use client';

// PiPaymentFlow
// Sandbox/test Pi Network payment flow.
// Requires the Pi Browser: Pi.authenticate + Pi.createPayment only work there.
// Flow: fetch Pi quote (PHP -> Pi) -> Pi.createPayment -> onReadyForServerApproval
//       (POST /api/payments/pi/approve) -> onReadyForServerCompletion
//       (POST /api/payments/pi/complete) -> success redirect.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PiPaymentFlowProps {
  amountPhp: number;
  planId: string;
  planName: string;
  promoCode?: string;
  onSuccess?: (subscriptionId?: string | null) => void;
  onError?: (error: string) => void;
}

interface PiPaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid?: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: unknown) => void;
}

export default function PiPaymentFlow({
  amountPhp,
  planId,
  planName,
  promoCode,
  onSuccess,
  onError,
}: PiPaymentFlowProps) {
  const router = useRouter();
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [amountPi, setAmountPi] = useState<number | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const amountPiRef = useRef<number | null>(null);

  // Load the Pi SDK once
  useEffect(() => {
    let script: HTMLScriptElement | null = null;

    if (typeof window !== 'undefined' && !window.Pi) {
      script = document.createElement('script');
      script.src = 'https://sdk.minepi.com/pi-sdk.js';
      script.async = true;
      script.onload = () => {
        if (window.Pi) {
          window.Pi.init({ version: '2.0' });
          setSdkLoaded(true);
        } else {
          setErrorMessage('Pi SDK failed to initialize');
        }
      };
      script.onerror = () => setErrorMessage('Failed to load Pi SDK');
      document.head.appendChild(script);
    } else if (window.Pi) {
      setSdkLoaded(true);
    }

    return () => {
      if (script && script.parentNode) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Fetch the Pi equivalent of the PHP amount (1 Pi = 1 USD)
  const fetchQuote = useCallback(async () => {
    if (amountPiRef.current !== null || amountPhp <= 0) {
      return;
    }
    try {
      const res = await fetch(`/api/payments/pi/quote?amount=${encodeURIComponent(amountPhp)}`);
      if (!res.ok) {
        throw new Error('Failed to fetch Pi quote');
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch Pi quote');
      }
      setAmountPi(data.amount_pi);
      amountPiRef.current = data.amount_pi;
    } catch (error) {
      console.error('Pi quote error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch Pi quote');
    }
  }, [amountPhp]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  const serverApprovalHandler = useCallback(
    async (paymentId: string) => {
      try {
        const response = await fetch('/api/payments/pi/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_id: paymentId,
            amount: amountPiRef.current,
            plan_id: planId,
            promo_code: promoCode || null,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || 'Server approval failed');
        }

        setNotice('Payment approved by Pi. Waiting for confirmation...');
      } catch (error) {
        console.error('Pi server approval error:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Server approval failed');
        setIsPaying(false);
        onError?.(error instanceof Error ? error.message : 'Server approval failed');
      }
    },
    [planId, promoCode, onError]
  );

  const serverCompletionHandler = useCallback(
    async (paymentId: string, txid?: string) => {
      setIsCompleting(true);
      setNotice('Finalizing payment and activating your subscription...');
      try {
        const response = await fetch('/api/payments/pi/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId, txid: txid || null }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to complete payment');
        }

        setIsPaying(false);
        setIsCompleting(false);
        setNotice(null);
        onSuccess?.(data?.subscription_id ?? null);

        // Redirect to the standard success page after a short delay
        setTimeout(() => {
          router.push('/payment/verification/success');
        }, 1500);
      } catch (error) {
        console.error('Pi completion error:', error);
        setIsCompleting(false);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to complete payment');
        onError?.(error instanceof Error ? error.message : 'Failed to complete payment');
      }
    },
    [router, onSuccess, onError]
  );

  const handlePay = async () => {
    setErrorMessage(null);
    setNotice(null);

    if (!sdkLoaded || !window.Pi) {
      setErrorMessage('Pi SDK not loaded yet. Please try again.');
      return;
    }

    if (!window.Pi.authenticate) {
      setErrorMessage('Pi Network is not available in this browser. Please open the Pi Browser and try again.');
      return;
    }

    // Check if we're in the Pi Browser (payments require it)
    const isPiBrowser = navigator.userAgent.toLowerCase().includes('pi browser');
    if (!isPiBrowser) {
      setErrorMessage('Pi payments require the Pi Browser app. Please open this page in the Pi Browser.');
      return;
    }

    await fetchQuote();
    if (amountPiRef.current === null) {
      setErrorMessage('Unable to determine Pi amount. Please try again.');
      return;
    }

    setIsPaying(true);

    const callbacks: PiPaymentCallbacks = {
      onReadyForServerApproval: (paymentId: string) => {
        serverApprovalHandler(paymentId);
      },
      onReadyForServerCompletion: (paymentId: string, txid?: string) => {
        serverCompletionHandler(paymentId, txid);
      },
      onCancel: (paymentId: string) => {
        console.log('Pi payment cancelled:', paymentId);
        setIsPaying(false);
        setNotice(null);
      },
      onError: (error: Error) => {
        console.error('Pi payment error:', error);
        setErrorMessage(error.message || 'Pi payment failed');
        setIsPaying(false);
      },
    };

    try {
      const metadata: Record<string, string> = { plan_id: planId, plan_name: planName };
      if (promoCode) {
        metadata.promo_code = promoCode;
      }

      await window.Pi.createPayment(
        {
          amount: amountPiRef.current,
          metadata,
          memo: `${planName} subscription`,
        },
        callbacks
      );
    } catch (error) {
      console.error('Pi createPayment error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start Pi payment');
      setIsPaying(false);
      onError?.(error instanceof Error ? error.message : 'Failed to start Pi payment');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">Pi Network Sandbox (test mode)</p>
        <p>
          You must be inside the <strong>Pi Browser</strong> app to pay with Pi. Test
          payments will not charge real Pi.
        </p>
      </div>

      {amountPi !== null && (
        <div className="text-sm text-gray-600 text-center">
          Total: <span className="font-semibold text-gray-900">π {amountPi.toFixed(2)}</span>
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={!sdkLoaded || isPaying || isCompleting}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-[#7b2cbf] hover:bg-[#9d4edd] text-white font-medium text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 min-h-[44px]"
      >
        <span className="text-lg font-bold">π</span>
        <span>
          {isCompleting
            ? 'Finalizing payment...'
            : isPaying
              ? 'Waiting for Pi approval...'
              : 'Pay with Pi'}
        </span>
      </button>

      {notice && <p className="text-sm text-blue-600 text-center">{notice}</p>}
      {errorMessage && <p className="text-sm text-red-600 text-center">{errorMessage}</p>}
    </div>
  );
}
