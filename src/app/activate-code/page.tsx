'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ActivateCodePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const plans = [
    { value: 'monthly', label: 'Monthly', description: 'Flexible monthly subscription' },
    { value: 'quarterly', label: 'Quarterly', description: 'Save 25% with quarterly billing' },
    { value: 'annual', label: 'Annual', description: 'Best value - save 35% with annual billing' }
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
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      setError('Unable to connect. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <div className="text-center mb-6 md:mb-8">
            <h1 className="text-xl md:text-2xl font-bold text-blue-600">🔓 Activate Account</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-2">
              Enter your activation code to continue
            </p>
          </div>

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Activation Code *
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base uppercase tracking-wider"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  maxLength={19}
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  Enter the code provided after payment
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Plan *
                </label>
                <div className="space-y-2">
                  {plans.map((plan) => (
                    <label
                      key={plan.value}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedPlan === plan.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={plan.value}
                        checked={selectedPlan === plan.value}
                        onChange={(e) => setSelectedPlan(e.target.value)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-sm">{plan.label}</div>
                        <div className="text-xs text-gray-500">{plan.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full bg-blue-600 text-white py-2 md:py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
              >
                {loading ? 'Activating...' : 'Activate Account'}
              </button>

              <div className="text-center text-xs text-gray-500 mt-4">
                <p>Need to make a payment?</p>
                <a href="mailto:support@concetto.com" className="text-blue-600 hover:underline">
                  Contact support
                </a>
              </div>
            </form>
          ) : (
            <div className="text-center py-8">
              <div className="text-green-600 text-6xl mb-4">✓</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Account Activated!
              </h2>
              <p className="text-gray-600 mb-6">
                Redirecting to dashboard...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}