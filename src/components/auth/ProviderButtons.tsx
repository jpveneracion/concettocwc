'use client';
import { signIn } from 'next-auth/react';

interface ProviderButtonsProps {
  className?: string;
}

export function ProviderButtons({ className = '' }: ProviderButtonsProps) {
  const providers = [
    {
      id: 'google',
      name: 'Google',
      color: 'bg-white hover:bg-gray-50',
      textColor: 'text-gray-900',
      borderColor: 'border-gray-300',
      icon: 'G',
      available: true
    },
    {
      id: 'microsoft',
      name: 'Microsoft',
      color: 'bg-[#00a4ef] hover:bg-[#008dc9]',
      textColor: 'text-white',
      borderColor: 'border-transparent',
      icon: 'M',
      available: false // Not available in NextAuth v5 beta yet
    },
    {
      id: 'pi',
      name: 'Pi Network',
      color: 'bg-[#7b2cbf] hover:bg-[#9d4edd]',
      textColor: 'text-white',
      borderColor: 'border-transparent',
      icon: 'π',
      available: true
    }
  ];

  const handleProviderSignIn = async (providerId: string) => {
    if (providerId === 'pi') {
      // Pi Sign-in handled separately
      window.location.href = '/auth/pi/signin';
      return;
    }

    // Sign in with OAuth provider
    await signIn(providerId, {
      callbackUrl: '/dashboard' // Default redirect, will be overridden if new user
    });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-center text-sm text-gray-500 mb-4">
        Or continue with
      </div>

      {providers.map((provider) => (
        <button
          key={provider.id}
          onClick={() => handleProviderSignIn(provider.id)}
          disabled={!provider.available}
          className={`
            w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg
            border ${provider.borderColor} ${provider.color} ${provider.textColor}
            font-medium text-sm md:text-base
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200
            min-h-[44px] // Mobile touch target
          `}
        >
          <span className="text-lg font-bold">{provider.icon}</span>
          <span>Sign in with {provider.name}</span>
        </button>
      ))}
    </div>
  );
}