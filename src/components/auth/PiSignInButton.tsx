'use client';
import { useEffect, useState } from 'react';

interface PiSignInButtonProps {
  onSuccess?: (accessToken: string) => void;
  onError?: (error: string) => void;
}

export function PiSignInButton({ onSuccess, onError }: PiSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    // Load Pi SDK
    const script = document.createElement('script');
    script.src = 'https://sdk.minepi.com/pi-sdk.js';
    script.async = true;
    script.onload = () => {
      // @ts-ignore - Pi SDK global
      if (window.Pi) {
        // @ts-ignore
        window.Pi.init({ version: '2.0' });
        setSdkLoaded(true);
        setDebugInfo('SDK loaded successfully');
      } else {
        setDebugInfo('SDK script loaded but Pi object not found');
        onError?.('Pi SDK initialization failed');
      }
    };
    script.onerror = () => {
      console.error('Failed to load Pi SDK');
      setDebugInfo('Failed to load SDK script');
      onError?.('Failed to load Pi SDK');
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup script
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [onError]);

  const handlePiSignIn = async () => {
    if (!sdkLoaded) {
      const errorMsg = 'Pi SDK not loaded. Please wait a moment and try again.';
      setDebugInfo(`Sign-in failed: ${errorMsg}`);
      onError?.(errorMsg);
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_PI_CLIENT_ID;
    if (!clientId || clientId === 'your_pi_client_id_here') {
      const errorMsg = 'Pi Client ID not configured. Please check your environment variables.';
      setDebugInfo(`Configuration error: ${errorMsg}`);
      onError?.(errorMsg);
      return;
    }

    setIsLoading(true);
    setDebugInfo('Initiating Pi Sign-in...');

    try {
      // Generate state for CSRF protection
      const state = crypto.randomUUID();
      sessionStorage.setItem('pi_oauth_state', state);

      // @ts-ignore - Pi SDK
      window.Pi.signIn({
        clientId: clientId,
        redirectUri: `${window.location.origin}/auth/pi/callback`,
        scopes: ['username', 'wallet_address'],
        state,
      });

      setDebugInfo('Redirecting to Pi Network...');
    } catch (error) {
      console.error('Pi Sign-in error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Pi Sign-in failed';
      setDebugInfo(`Error: ${errorMsg}`);
      onError?.(errorMsg);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handlePiSignIn}
        disabled={!sdkLoaded || isLoading}
        className={`
          w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg
          bg-[#7b2cbf] hover:bg-[#9d4edd] text-white font-medium text-sm md:text-base
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-200
          min-h-[44px] border border-transparent
        `}
      >
        <span className="text-lg font-bold">π</span>
        <span>{isLoading ? 'Connecting to Pi...' : 'Sign in with Pi Network'}</span>
      </button>

      {/* Debug information */}
      {debugInfo && !sdkLoaded && (
        <div className="text-xs text-amber-600 text-center">
          {debugInfo}
        </div>
      )}

      {/* Environment check */}
      {process.env.NEXT_PUBLIC_PI_CLIENT_ID === 'your_pi_client_id_here' && (
        <div className="text-xs text-red-600 text-center">
          ⚠️ Pi Client ID not configured in environment variables
        </div>
      )}
    </div>
  );
}