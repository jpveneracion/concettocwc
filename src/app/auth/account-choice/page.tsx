'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountChoicePage() {
  const router = useRouter();
  const [action, setAction] = useState<'join' | 'create'>('join');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [piUser, setPiUser] = useState<any>(null);

  const [formData, setFormData] = useState({
    email: '',
    company_code: '',
    company_name: '',
    company_address: '',
    company_mobile: '',
    company_email: ''
  });

  useEffect(() => {
    // Check if user has temporary Pi data
    const tempPiUser = sessionStorage.getItem('pi_user');
    if (tempPiUser) {
      setPiUser(JSON.parse(tempPiUser));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Get temporary OAuth data
      const tempToken = sessionStorage.getItem('temp_token');
      const tempPiUser = sessionStorage.getItem('pi_user');

      if (!tempToken && !tempPiUser) {
        setError('Session expired. Please sign in again.');
        setLoading(false);
        return;
      }

      const piUserData = tempPiUser ? JSON.parse(tempPiUser) : null;

      const response = await fetch('/api/auth/account-choice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-temp-provider': 'pi',
          'x-temp-provider-id': piUserData?.uid || 'unknown',
          'x-temp-token': tempToken || '',
          'x-temp-username': piUserData?.username || '',
          'x-temp-wallet': piUserData?.wallet_address || ''
        },
        body: JSON.stringify({
          action,
          email: formData.email,
          ...(action === 'join' ? {
            company_code: formData.company_code
          } : {
            company_name: formData.company_name,
            company_address: formData.company_address,
            company_mobile: formData.company_mobile,
            company_email: formData.company_email
          })
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Account creation failed');
      }

      // Clear temporary data
      sessionStorage.removeItem('temp_token');
      sessionStorage.removeItem('pi_user');

      // Redirect to dashboard
      router.push(data.redirect || '/dashboard');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account creation failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 md:p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-blue-600 mb-2">Complete Your Account</h1>
          <p className="text-xs md:text-sm text-gray-500">
            {piUser ? `Welcome, ${piUser.username}!` : 'Choose how you want to continue'}
          </p>
        </div>

        {/* Action Toggle */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setAction('join')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              action === 'join' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
            }`}
          >
            Join Company
          </button>
          <button
            onClick={() => setAction('create')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              action === 'create' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'
            }`}
          >
            Create Company
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (always required) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
              placeholder="your@email.com"
              required
            />
          </div>

          {action === 'join' ? (
            /* Join Existing Company */
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Code *
              </label>
              <input
                type="text"
                value={formData.company_code}
                onChange={(e) => setFormData({...formData, company_code: e.target.value})}
                className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base uppercase"
                placeholder="COMPANY123"
                required
              />
            </div>
          ) : (
            /* Create New Company */
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                  placeholder="My Window Coverings"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address (Optional)
                </label>
                <input
                  type="text"
                  value={formData.company_address}
                  onChange={(e) => setFormData({...formData, company_address: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                  placeholder="123 Main St"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.company_mobile}
                  onChange={(e) => setFormData({...formData, company_mobile: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                  placeholder="+63 912 345 6789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.company_email}
                  onChange={(e) => setFormData({...formData, company_email: e.target.value})}
                  className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                  placeholder="company@email.com"
                />
              </div>
            </>
          )}

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
            {loading ? 'Creating Account...' : (action === 'join' ? 'Join Company' : 'Create Account')}
          </button>
        </form>
      </div>
    </div>
  );
}