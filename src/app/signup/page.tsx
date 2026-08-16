'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store } from 'lucide-react';

type CodeStatus = 'idle' | 'checking' | 'available' | 'taken';

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('idle');

  // Company info
  const [companyCode, setCompanyCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [mobile, setMobile] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [minimumArea, setMinimumArea] = useState('15');

  // User credentials
  const [userEmail, setUserEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Debounced async availability check for the company code
  useEffect(() => {
    const code = companyCode.trim().toUpperCase();
    if (code.length < 2) {
      setCodeStatus('idle');
      return;
    }
    setCodeStatus('checking');
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/company-code-available?code=${encodeURIComponent(code)}`);
        const data = await res.json();
        setCodeStatus(res.ok && data.available ? 'available' : 'taken');
      } catch {
        setCodeStatus('idle');
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [companyCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validation
    if (!companyCode.trim() || !companyName.trim()) {
      setError('Company code and name are required');
      return;
    }
    if (codeStatus === 'taken') {
      setError('Company code is already taken. Please choose a different code.');
      return;
    }
    const minimumAreaNum = Number(minimumArea);
    if (minimumArea.trim() === '' || !Number.isFinite(minimumAreaNum) || minimumAreaNum < 0) {
      setError('Minimum area must be a number of 0 or more');
      return;
    }
    if (!userEmail.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: {
            code: companyCode.toUpperCase().trim(),
            name: companyName.trim(),
            address: address.trim(),
            mobile: mobile.trim(),
            email: companyEmail.trim(),
            prepared_by: preparedBy.trim(),
            minimum_area_sqft: parseFloat(minimumArea) || 0,
          },
          user: {
            email: userEmail.trim().toLowerCase(),
            password,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Success - redirect to login with signup success flag
      router.push('/login?signup=success&newCompany=true');
    } catch (err) {
      setError('Unable to connect. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-indigo-50 py-12">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2">
            <Store className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-indigo-600">Sign Up</h1>
          </div>
            <p className="text-sm text-stone-500 mt-2">Create your company account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Information */}
            <div>
              <h3 className="text-sm font-semibold text-stone-700 mb-3">Company Information</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Company Code *
                    </label>
                    <input
                      type="text"
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm uppercase"
                      placeholder="CWC"
                      maxLength={10}
                      required
                    />
                    <p className="text-xs text-stone-400 mt-1">Short code for quotes (e.g., CWC)</p>
                    {codeStatus === 'checking' && (
                      <p className="text-xs text-stone-500 mt-1">Checking availability...</p>
                    )}
                    {codeStatus === 'available' && (
                      <p className="text-xs text-emerald-700 mt-1">Code is available</p>
                    )}
                    {codeStatus === 'taken' && (
                      <p className="text-xs text-rose-600 mt-1">This code is already taken</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                      placeholder="Concetto Window Coverings"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                    placeholder="123 Main St, City"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Mobile
                    </label>
                    <input
                      type="text"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                      placeholder="0917-123-4567"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Company Email
                    </label>
                    <input
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                      placeholder="info@company.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Prepared By
                  </label>
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                    placeholder="Your Name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Minimum Area (sq.ft.) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={minimumArea}
                    onChange={(e) => setMinimumArea(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                    placeholder="15"
                    required
                  />
                  <p className="text-xs text-stone-400 mt-1">Smallest billable area per window (0 disables)</p>
                </div>
              </div>
            </div>

            {/* User Account */}
            <div>
              <h3 className="text-sm font-semibold text-stone-700 mb-3">Your Account</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                    placeholder="you@company.com"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                      placeholder="Min 6 characters"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                      placeholder="Same as password"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <p className="text-xs text-stone-500 text-center">
              Already have an account?{' '}
              <a href="/login" className="text-indigo-600 hover:underline">
                Sign in
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
