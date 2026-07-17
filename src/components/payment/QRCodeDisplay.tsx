'use client';

import { useState, useEffect } from 'react';
import { paymentConfig } from '@/config/payment';

interface QRCodeDisplayProps {
  method: 'gcash' | 'gotyme';
  amount: number;
  planName: string;
}

export default function QRCodeDisplay({ method, amount, planName }: QRCodeDisplayProps) {
  const [showQR, setShowQR] = useState(true);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);

  useEffect(() => {
    fetchPaymentSettings();
  }, []);

  const fetchPaymentSettings = async () => {
    try {
      const response = await fetch('/api/admin/payment-settings');
      if (response.ok) {
        const settings = await response.json();
        setPaymentSettings(settings);
      } else {
        // If API fails, use default config
        console.log('Using default payment config');
      }
    } catch (error) {
      console.error('Failed to fetch payment settings:', error);
      // Silently fall back to default config
    }
  };

  const details = paymentSettings?.mobile?.[method] || paymentConfig.mobile[method];
  const customQrCode = paymentSettings?.mobile?.[method]?.qrCodeUrl;

  // Safety check - if no details available, show error
  if (!details) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-600">
          Payment method details not available. Please contact support.
        </p>
      </div>
    );
  }

  // Ensure instructions always exist with proper fallback
  const instructions = details?.instructions || [
    'Open your payment app',
    'Select "Send Money" or "Transfer"',
    `Enter the number: ${details?.number || 'the number above'}`,
    'Input the exact amount shown',
    'Take a screenshot of the confirmation'
  ];

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Use custom QR code if available, otherwise generate one
  const qrCodeUrl = customQrCode || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${details.number.replace(/-/g, '')}`;

  return (
    <div className="space-y-6">
      {/* QR Code Display */}
      <div className="flex flex-col items-center">
        <div className="bg-white p-6 rounded-lg border-2 border-gray-200 mb-4">
          {showQR ? (
            <div className="relative">
              <img
                src={qrCodeUrl}
                alt={`${details.name} QR Code`}
                className="w-48 h-48 object-contain"
              />
              {customQrCode && (
                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                  Official
                </div>
              )}
            </div>
          ) : (
            <div className="w-48 h-48 flex items-center justify-center bg-gray-100">
              <span className="text-gray-400">QR Hidden</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowQR(!showQR)}
          className="text-sm text-blue-600 hover:text-blue-700 mb-2"
        >
          {showQR ? 'Hide QR Code' : 'Show QR Code'}
        </button>

        <div className="text-center">
          <p className="text-sm text-gray-600 mb-1">Scan or use this number:</p>
          <p className="text-2xl font-bold text-gray-900 tracking-wider">
            {details.number}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Account: {details.accountName}
          </p>
        </div>
      </div>

      {/* Payment Amount */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-center">
          <p className="text-sm text-blue-700 mb-1">Amount to Pay:</p>
          <p className="text-3xl font-bold text-blue-900">
            {formatCurrency(amount)}
          </p>
          <p className="text-xs text-blue-600 mt-2">
            For: {planName}
          </p>
        </div>
      </div>

      {/* Step by Step Instructions */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">
          How to Pay with {details.name}
        </h4>
        <ol className="space-y-2">
          {instructions.map((instruction, index) => {
            const formattedInstruction = instruction
              .replace('{amount}', formatCurrency(amount))
              .replace('{number}', details.number);
            return (
              <li key={index} className="flex items-start gap-3 text-sm text-gray-700">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                  {index + 1}
                </span>
                <span>{formattedInstruction}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Important Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-yellow-600 text-xl">⚠️</span>
          <div className="flex-1">
            <p className="font-medium text-yellow-900 mb-1">
              Important Payment Instructions
            </p>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Send the <strong>exact amount</strong> shown above</li>
              <li>• Use your <strong>registered name</strong> in payment notes</li>
              <li>• <strong>Take a clear screenshot</strong> of the payment confirmation</li>
              <li>• Include the <strong>reference number</strong> in your payment proof</li>
              <li>• Keep your payment <strong>receipt/confirmation</strong> for verification</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Copy Button */}
      <div className="flex justify-center">
        <button
          onClick={() => {
            navigator.clipboard.writeText(details.number);
            // You could add a toast notification here
          }}
          className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          Copy Number to Clipboard
        </button>
      </div>
    </div>
  );
}