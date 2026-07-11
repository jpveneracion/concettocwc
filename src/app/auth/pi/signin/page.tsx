'use client';
import { PiSignInButton } from '@/components/auth/PiSignInButton';
import { useRouter } from 'next/navigation';

export default function PiSignInPage() {
  const router = useRouter();

  const handleSuccess = (accessToken: string) => {
    // Store the access token temporarily
    sessionStorage.setItem('pi_access_token', accessToken);
    // Redirect to callback handler
    router.push('/auth/pi/callback');
  };

  const handleError = (error: string) => {
    console.error('Pi Sign-in error:', error);
    // Handle error (show message, redirect to login, etc.)
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 md:p-8 text-center">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-[#7b2cbf] mb-2">Pi Network Sign-in</h1>
          <p className="text-xs md:text-sm text-gray-500">Sign in with your Pi Network account</p>
        </div>

        <PiSignInButton
          onSuccess={handleSuccess}
          onError={handleError}
        />

        <div className="mt-6">
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}