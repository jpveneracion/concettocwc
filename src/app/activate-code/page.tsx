'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Unlock, CheckCircle2 } from 'lucide-react';

export default function ActivateCodePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/activate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase().trim()
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-indigo-50 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <div className="text-center mb-6 md:mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
            <Unlock className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl md:text-2xl font-bold text-indigo-600">Activate Account</h1>
          </div>
            <p className="text-xs md:text-sm text-stone-500 mt-2">
              Enter your activation code to continue
            </p>
          </div>

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Activation Code *
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full px-3 md:px-4 py-2 md:py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm md:text-base uppercase tracking-wider"
                  placeholder="e.g. z0ixtuwb"
                  maxLength={32}
                  required
                  autoFocus
                />
                <p className="text-xs text-stone-400 mt-1">
                  Enter the code you received to unlock premium features
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full bg-indigo-600 text-white py-2 md:py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
              >
                {loading ? 'Activating...' : 'Activate Account'}
              </button>

              <div className="text-center text-xs text-stone-500 mt-4">
                <p>Need to make a payment?</p>
                <a href="mailto:support@concetto.com" className="text-indigo-600 hover:underline">
                  Contact support
                </a>
              </div>
            </form>
          ) : (
            <div className="text-center py-8">
              <div className="text-emerald-600 mb-4"><CheckCircle2 className="w-14 h-14 mx-auto" /></div>
              <h2 className="text-xl font-semibold text-stone-900 mb-2">
                Account Activated!
              </h2>
              <p className="text-stone-600 mb-6">
                Redirecting to dashboard...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}