'use client';
import { PiSignInButton } from '@/components/auth/PiSignInButton';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export default function PiSignInPage() {
  const router = useRouter();
  const [redirectUri, setRedirectUri] = useState('');

  useEffect(() => {
    // Set redirect URI only on client side
    setRedirectUri(`${window.location.origin}/auth/pi/callback`);
  }, []);

  const handleSuccess = (accessToken: string) => {
    // Store the access token temporarily
    sessionStorage.setItem('pi_access_token', accessToken);
    // Redirect to callback handler
    router.push('/auth/pi/callback');
  };

  const handleError = (error: string) => {
    console.error('Pi Sign-in error:', error);
    // Show error message to user
    alert(`Pi Sign-in Error: ${error}\n\nPlease check:\n1. Your network connection\n2. Pi Client ID configuration\n3. Browser console for details`);
  };

  const clientIdConfigured = process.env.NEXT_PUBLIC_PI_CLIENT_ID &&
                            process.env.NEXT_PUBLIC_PI_CLIENT_ID !== 'your_pi_client_id_here';

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 md:p-8 text-center">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-indigo-600 mb-2">Pi Network Sign-in</h1>
          <p className="text-xs md:text-sm text-stone-500">Sign in with your Pi Network account</p>
        </div>

        {/* Environment check */}
        {!clientIdConfigured && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Configuration Required:</strong>
              <p className="mt-1">To use Pi Sign-in, you need to configure your Pi Client ID in the environment variables.</p>
              <p className="mt-2 text-xs">Get your Client ID from the <a href="https://developers.pi.com" target="_blank" rel="noopener noreferrer" className="underline">Pi Developer Portal</a></p>
            </div>
          </div>
        )}

        <PiSignInButton
          onSuccess={handleSuccess}
          onError={handleError}
        />

        <div className="mt-6">
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            ← Back to Login
          </button>
        </div>

        {/* Additional debugging info */}
        <div className="mt-4 p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-600 text-left">
          <p><strong>Debugging Information:</strong></p>
          <ul className="mt-2 space-y-1">
            <li className="flex items-center gap-1.5">• Client ID configured: {clientIdConfigured ? (<><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />Yes</>) : (<><XCircle className="w-3.5 h-3.5 text-rose-600" />No</>)}</li>
            <li>• SDK loading: Check browser console</li>
            {redirectUri && <li>• Redirect URI: {redirectUri}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}