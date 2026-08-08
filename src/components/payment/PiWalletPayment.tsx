'use client';

import { useState, useEffect } from 'react';

interface PiWalletPaymentProps {
  amount: number;
  planName: string;
  promoCode?: string;
}

export default function PiWalletPayment({ amount, planName, promoCode }: PiWalletPaymentProps) {
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [addressCopied, setAddressCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentSettings();
  }, []);

  useEffect(() => {
    if (amount > 0) {
      fetchQuote();
    }
  }, [amount]);

  const fetchPaymentSettings = async () => {
    try {
      const response = await fetch('/api/payment-settings');
      if (response.ok) {
        const settings = await response.json();
        setPaymentSettings(settings);
      }
    } catch (error) {
      console.error('Failed to fetch payment settings:', error);
    }
  };

  const fetchQuote = async () => {
    try {
      setLoadingQuote(true);
      const response = await fetch(`/api/payments/pi/quote?amount=${encodeURIComponent(amount)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Pi quote');
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch Pi quote');
      }
      setQuote(data);
    } catch (error) {
      console.error('Pi quote error:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch Pi quote');
    } finally {
      setLoadingQuote(false);
    }
  };

  const piDetails = paymentSettings?.mobile?.pi || {};
  const walletAddress = piDetails.number || '';
  const accountName = piDetails.accountName || 'Concetto Inc.';
  const customQrCodeUrl = piDetails.qrCodeUrl || '';
  const qrCodeUrl = customQrCodeUrl ||
    (walletAddress
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(walletAddress)}`
      : '');

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatPiAmount = (value: number): string => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6
    });
  };

  const amountPi = quote?.amount_pi;

  if (!walletAddress) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-600">
          Pi wallet details are not configured yet. Please contact support.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* QR Code */}
      <div className="flex flex-col items-center">
        {loadingQuote || !qrCodeUrl ? (
          <div className="bg-white p-6 rounded-lg border-2 border-gray-200 w-64 h-64 flex items-center justify-center">
            {loadingQuote ? (
              <div className="animate-spin text-4xl mr-3">⏳</div>
            ) : (
              <p className="text-gray-500 text-sm text-center">
                QR code unavailable.<br />Use the wallet address below instead.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
            <img
              src={qrCodeUrl}
              alt="Pi Wallet QR Code"
              className="w-48 h-48 object-contain"
            />
          </div>
        )}

        <div className="text-center mt-4">
          <p className="text-sm text-gray-600 mb-1">Scan with your Pi Wallet, or send to:</p>
          <p className="text-sm font-mono text-gray-800 break-all bg-gray-50 rounded-lg p-3 mb-3 max-w-sm">
            {walletAddress}
          </p>
          <p className="text-xs text-gray-500">
            Wallet: {accountName}
          </p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(walletAddress);
              setAddressCopied(true);
              setTimeout(() => setAddressCopied(false), 2000);
            }}
            className={`mt-2 px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
              addressCopied
                ? 'bg-green-500 text-white'
                : 'bg-[#7b2cbf] hover:bg-[#9d4edd] text-white'
            }`}
          >
            {addressCopied ? '✓ Address Copied!' : 'Copy Wallet Address'}
          </button>
        </div>
      </div>

      {/* Amount */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="text-center">
          <p className="text-sm text-purple-700 mb-1">Amount to Send:</p>
          {loadingQuote ? (
            <p className="text-3xl font-bold text-purple-900 animate-pulse">...</p>
          ) : amountPi !== undefined ? (
            <>
              <p className="text-3xl font-bold text-purple-900 mb-1">
                π {formatPiAmount(amountPi)}
              </p>
              <p className="text-xs text-purple-600">
                ≈ {formatCurrency(amount)} PHP
              </p>
            </>
          ) : (
            <p className="text-3xl font-bold text-purple-900 mb-1">
              ≈ {formatCurrency(amount)}
            </p>
          )}
          <p className="text-xs text-purple-600 mt-1">For: {planName}</p>
          {promoCode && (
            <p className="text-xs text-green-600 mt-1">💰 Promo code applied!</p>
          )}
        </div>
      </div>

      {/* Step by Step Instructions */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">
          How to Pay with Pi Network
        </h4>
        <ol className="space-y-2">
          {[
            'Open your Pi Wallet app',
            'Tap "Send" (or scan the QR code above)',
            'Paste the wallet address (or confirm the scanned one)',
            `Enter the exact amount: ${amountPi !== undefined ? `${formatPiAmount(amountPi)} Pi` : 'shown above'}`,
            'Confirm and pay the transaction fee (if any)',
            'Copy the transaction ID (txid) from the confirmation',
            'Take a screenshot of the completed transaction',
            'Submit the screenshot and txid in the payment proof below'
          ].map((instruction, index) => (
            <li key={index} className="flex items-start gap-3 text-sm text-gray-700">
              <span className="flex-shrink-0 w-6 h-6 bg-[#7b2cbf] text-white rounded-full flex items-center justify-center text-xs font-semibold">
                {index + 1}
              </span>
              <span>{instruction}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Important Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-yellow-600 text-xl">⚠️</span>
          <div className="flex-1">
            <p className="font-medium text-yellow-900 mb-1">
              Important Pi Payment Instructions
            </p>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Send the <strong>exact amount</strong> of Pi shown above</li>
              <li>• Only send to the <strong>wallet address</strong> displayed here</li>
              <li>• Pi sent to a wrong address <strong>cannot be recovered</strong></li>
              <li>• Keep the <strong>transaction ID (txid)</strong> — it is your reference number</li>
              <li>• <strong>Take a clear screenshot</strong> of the transaction confirmation</li>
              <li>• Your payment will be verified <strong>manually</strong> before activation</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Rate Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800 text-center">
          <strong>Rate Notice:</strong>{' '}
          {quote?.pi_price_usd
            ? `1 Pi = $${Number(quote.pi_price_usd).toFixed(4)} USD (live market price).`
            : '1 Pi = $1.00 USD equivalent.'}{' '}
          Conversion from PHP uses the rate at the time of payment. The payment verification team
          will use the rate at the time of transaction confirmation.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
