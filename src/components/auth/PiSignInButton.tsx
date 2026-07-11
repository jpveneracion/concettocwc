'use client';
import { useEffect, useState } from 'react';

interface PiSignInButtonProps {
  onSuccess?: (accessToken: string) => void;
  onError?: (error: string) => void;
}

export function PiSignInButton({ onSuccess, onError }: PiSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);

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
      }
    };
    script.onerror = () => {
      console.error('Failed to load Pi SDK');
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
      onError?.('Pi SDK not loaded');
      return;
    }

    setIsLoading(true);

    try {
      // Generate state for CSRF protection
      const state = crypto.randomUUID();
      sessionStorage.setItem('pi_oauth_state', state);

      // @ts-ignore - Pi SDK
      window.Pi.signIn({
        clientId: process.env.NEXT_PUBLIC_PI_CLIENT_ID || 'your-pi-client-id',
        redirectUri: `${window.location.origin}/auth/pi/callback`,
        scopes: ['username', 'wallet_address'],
        state,
      });
    } catch (error) {
      console.error('Pi Sign-in error:', error);
      onError?.('Pi Sign-in failed');
      setIsLoading(false);
    }
  };

  return (
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
  );
}