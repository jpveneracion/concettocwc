'use client';

import { useState } from 'react';

interface PromoCodeInputProps {
  code: string;
  discount: number;
  onApply: (code: string) => void;
  onRemove: () => void;
  error: string | null;
  loading: boolean;
}

export default function PromoCodeInput({
  code,
  discount,
  onApply,
  onRemove,
  error,
  loading
}: PromoCodeInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(!code);

  const handleApply = () => {
    if (inputValue.trim()) {
      onApply(inputValue.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApply();
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (code && discount > 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-600 text-xl">🎉</span>
              <p className="font-semibold text-green-900">
                Promo Code Applied: {code.toUpperCase()}
              </p>
            </div>
            <p className="text-sm text-green-700">
              You saved {formatCurrency(discount)} on this subscription!
            </p>
          </div>
          <button
            onClick={onRemove}
            disabled={loading}
            className="px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Apply Promo Code
        </h3>
        <button
          onClick={() => setShowInput(!showInput)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {showInput ? 'Hide' : 'Show'}
        </button>
      </div>

      {showInput && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter promo code (e.g., SAVE20)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
              disabled={loading}
            />
            <button
              onClick={handleApply}
              disabled={!inputValue.trim() || loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Validating...' : 'Apply'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>How promo codes work:</strong> Enter your promo code and click Apply to see your discount.
              Valid codes will reduce your subscription price instantly.
            </p>
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <p>• Promo codes are case-insensitive</p>
            <p>• Only one promo code per subscription</p>
            <p>• Codes may have usage limits and expiration dates</p>
          </div>
        </div>
      )}
    </div>
  );
}