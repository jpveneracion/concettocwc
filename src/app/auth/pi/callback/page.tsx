'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PiCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState('');

  useEffect(() => {
    const handlePiCallback = async () => {
      try {
        // Parse URL fragment to get access token
        const params = new URLSearchParams(window.location.hash.slice(1));
        const expectedState = sessionStorage.getItem('pi_oauth_state');
        sessionStorage.removeItem('pi_oauth_state');

        // Verify state to prevent CSRF
        const state = params.get('state');
        if (state !== expectedState) {
          throw new Error('State mismatch — possible CSRF, aborting.');
        }

        // Check for errors
        const error = params.get('error');
        if (error) {
          const errorMessages: Record<string, string> = {
            access_denied: 'You declined the sign-in request',
            expired: 'The sign-in request timed out',
            cancelled: 'You cancelled the sign-in process',
            server_error: 'An unexpected server-side error occurred'
          };
          throw new Error(errorMessages[error] || 'Pi Sign-in failed');
        }

        // Get access token from URL fragment
        const accessToken = params.get('access_token');
        if (!accessToken) {
          throw new Error('No access token found in callback');
        }

        // Call Pi API to get user info
        const me = await fetch('https://api.minepi.com/v2/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json());

        if (!me.uid) {
          throw new Error('Failed to get user information from Pi API');
        }

        // Send user info to backend for session creation
        const response = await fetch('/api/auth/pi/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: me.uid,
            username: me.username,
            access_token: accessToken,
            wallet_address: me.wallet_address
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Authentication failed');
        }

        setStatus('success');

        // Clear the token from URL
        history.replaceState(null, '', window.location.pathname);

        // Redirect based on response
        setTimeout(() => {
          if (data.redirect) {
            // Store temporary data for account choice if needed
            if (data.tempToken && data.piUser) {
              sessionStorage.setItem('temp_token', data.tempToken);
              sessionStorage.setItem('pi_user', JSON.stringify(data.piUser));
            }
            router.push(data.redirect);
          }
        }, 1000);

      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handlePiCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 md:p-8 text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7b2cbf] mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Processing Pi Sign-in...</h2>
            <p className="text-sm text-gray-500">Please wait while we verify your identity</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Sign-in Successful!</h2>
            <p className="text-sm text-gray-500">Redirecting you to the dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Sign-in Failed</h2>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2 bg-[#7b2cbf] text-white rounded-lg hover:bg-[#9d4edd] transition-colors"
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}