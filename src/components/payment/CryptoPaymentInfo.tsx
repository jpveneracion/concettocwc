'use client';

import { useState, useEffect } from 'react';
import { paymentConfig } from '@/config/payment';
import { AlertTriangle } from 'lucide-react';

interface CryptoPaymentInfoProps {
  amount: number;
  planName: string;
}

export default function CryptoPaymentInfo({ amount, planName }: CryptoPaymentInfoProps) {
  const [selectedCrypto, setSelectedCrypto] = useState<'USDC' | 'USDT'>('USDC');
  const [addressCopied, setAddressCopied] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);

  useEffect(() => {
    fetchPaymentSettings();
  }, []);

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

  const rawCryptoInfo = paymentSettings?.crypto?.[selectedCrypto.toLowerCase()] || {};

  const cryptoInfo = {
    network: rawCryptoInfo.network || (selectedCrypto === 'USDC' ? 'Polygon (MATIC)' : 'Tron (TRC20)'),
    address: rawCryptoInfo.address || rawCryptoInfo.polygonAddress || rawCryptoInfo.tronAddress || '0x1234567890123456789012345678901234567890',
    usdRate: rawCryptoInfo.usdRate || 1.0
  };

  const phpToUsdRate = paymentSettings?.rates?.phpToUsd || 0.018;
  const usdAmount = amount * phpToUsdRate;
  const cryptoAmount = usdAmount / cryptoInfo.usdRate;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(cryptoInfo.address);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Crypto Selection */}
      <div className="flex gap-3">
        <button
          onClick={() => setSelectedCrypto('USDC')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedCrypto === 'USDC'
              ? 'bg-indigo-600 text-white'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          USDC
        </button>
        <button
          onClick={() => setSelectedCrypto('USDT')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedCrypto === 'USDT'
              ? 'bg-indigo-600 text-white'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          USDT
        </button>
      </div>

      {/* Network and Amount Info */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="text-center">
          <p className="text-sm text-green-700 mb-1">Network:</p>
          <p className="text-xl font-bold text-green-900 mb-3">
            {cryptoInfo.network}
          </p>

          <div className="border-t border-green-300 pt-3 mt-3">
            <p className="text-sm text-green-700 mb-1">Amount to Send:</p>
            <p className="text-3xl font-bold text-green-900 mb-1">
              {cryptoAmount.toFixed(2)} {selectedCrypto}
            </p>
            <p className="text-xs text-green-600">
              ≈ {formatCurrency(amount)} PHP
            </p>
            <p className="text-xs text-green-600 mt-1">
              For: {planName}
            </p>
          </div>
        </div>
      </div>

      {/* Wallet Address */}
      <div className="bg-stone-50 rounded-lg p-4">
        <h4 className="font-semibold text-stone-900 mb-3">
          {selectedCrypto} Wallet Address
        </h4>

        <div className="bg-white border-2 border-stone-200 rounded-lg p-4 mb-3">
          <p className="text-sm font-mono text-stone-800 break-all mb-3">
            {cryptoInfo.address}
          </p>

          <button
            onClick={handleCopyAddress}
            className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
              addressCopied
                ? 'bg-green-500 text-white'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {addressCopied ? 'Address Copied!' : 'Copy Address'}
          </button>
        </div>

        <div className="flex items-start gap-2 text-xs text-stone-600">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p>
            Make sure you're sending on the <strong>{cryptoInfo.network}</strong> network.
            Sending on the wrong network may result in permanent loss.
          </p>
        </div>
      </div>

      {/* Step by Step Instructions */}
      <div className="bg-stone-50 rounded-lg p-4">
        <h4 className="font-semibold text-stone-900 mb-3">
          How to Pay with {selectedCrypto}
        </h4>
        <ol className="space-y-2">
          {[
            'Open your crypto wallet (MetaMask, Trust Wallet, etc.)',
            `Select "${cryptoInfo.network}" network`,
            `Choose to send ${selectedCrypto}`,
            `Paste the wallet address: ${cryptoInfo.address.substring(0, 10)}...`,
            `Enter the exact amount: ${cryptoAmount.toFixed(2)} ${selectedCrypto}`,
            'Confirm the transaction',
            'Take a screenshot of the transaction confirmation'
          ].map((instruction, index) => (
            <li key={index} className="flex items-start gap-3 text-sm text-stone-700">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                {index + 1}
              </span>
              <span>{instruction}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Important Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-900 mb-1">
              Important Crypto Payment Instructions
            </p>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>• Send the <strong>exact amount</strong> of {selectedCrypto}</li>
              <li>• Use the <strong>{cryptoInfo.network}</strong> network only</li>
              <li>• <strong>Double-check the wallet address</strong> before sending</li>
              <li>• <strong>Take a clear screenshot</strong> of the transaction hash</li>
              <li>• Include the <strong>transaction ID</strong> in your payment proof</li>
              <li>• Crypto payments may take <strong>10-30 minutes</strong> to confirm</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Rate Disclaimer */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
        <p className="text-xs text-indigo-800 text-center">
          <strong>Rate Notice:</strong> Conversion rate of 1 PHP = ${phpToUsdRate.toFixed(4)} USD is used for this transaction.
          Actual market rates may vary slightly. The payment verification team will use the rate at the time of transaction confirmation.
        </p>
      </div>
    </div>
  );
}