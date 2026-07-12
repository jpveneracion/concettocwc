// src/components/subscription/ActivationCodeEntry.tsx

'use client';
import { useState } from 'react';

interface ActivationCodeEntryProps {
  onSuccess?: () => void;
  show?: boolean;
}

export function ActivationCodeEntry({ onSuccess, show = true }: ActivationCodeEntryProps) {
  const [code, setCode] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!show) return null;

  const plans = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly (25% off)' },
    { value: 'annual', label: 'Annual (35% off)' }
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/activate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase().trim(),
          subscription_plan: selectedPlan
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Activation failed');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err) {
      setError('Unable to connect. Please try again.');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-green-600 text-2xl mr-3">✓</div>
          <div>
            <h3 className="font-semibold text-green-900">Account Activated!</h3>
            <p className="text-sm text-green-700">Your subscription is now active.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="font-semibold text-blue-900 mb-3">
        🔓 Activate Your Account
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm uppercase tracking-wider"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            maxLength={19}
            required
          />
        </div>

        <div>
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm"
          >
            {plans.map((plan) => (
              <option key={plan.value} value={plan.value}>
                {plan.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? 'Activating...' : 'Activate Account'}
        </button>
      </form>
    </div>
  );
}