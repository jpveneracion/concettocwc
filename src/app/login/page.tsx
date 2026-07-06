'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const signupSuccess = searchParams.get('signup') === 'success';
    const newCompany = searchParams.get('newCompany') === 'true';
    const resetSuccess = searchParams.get('reset') === 'success';

    if (resetSuccess) {
      setSuccess('Password reset successfully! Please sign in with your new password.');
    } else if (signupSuccess) {
      if (newCompany) {
        setSuccess('Company account created! Sign in to set up your pricing and get started.');
      } else {
        setSuccess('Account created! Please sign in with your credentials.');
      }
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Determine where to redirect based on account state
      if (data.defaultPassword) {
        // Must change password first
        router.push('/change-password?prompt=default');
      } else if (!data.hasPricing) {
        // New company - needs to set up pricing
        router.push('/setup/pricing?new=true');
      } else {
        // Everything is set up - go to dashboard
        router.push('/dashboard');
      }
      router.refresh();
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
            <h1 className="text-xl md:text-2xl font-bold text-blue-600">🏪 Concetto</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-2">Window Blinds Management</p>
          </div>

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 md:px-4 py-2 md:py-3 rounded-lg text-xs md:text-sm mb-4">
              ✓ {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                placeholder="your@email.com"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 md:py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="flex justify-center items-center text-xs text-gray-500 text-center mt-4">
            <a href="/reset-password" className="text-blue-600 hover:underline">
              Forgot password?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
