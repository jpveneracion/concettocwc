'use client';

import React, { useState } from 'react';
import { X, Mail, ArrowRight } from 'lucide-react';
import { LoginModalProps, OAuthProvider } from '@/types/landing';
import { signIn } from 'next-auth/react';

const oauthProviders: OAuthProvider[] = [
  {
    id: 'google',
    name: 'Continue with Google',
    icon: 'G',
    bgColor: 'bg-white',
    hoverColor: 'hover:bg-stone-50',
    textColor: 'text-stone-700'
  },
  {
    id: 'pi',
    name: 'Continue with Pi Network',
    icon: 'π',
    bgColor: 'bg-white',
    hoverColor: 'hover:bg-stone-50',
    textColor: 'text-stone-700'
  }
];

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleOAuthSignIn = async (providerId: string) => {
    setIsLoading(true);
    try {
      // Pi uses its own implicit OAuth flow, not NextAuth
      if (providerId === 'pi') {
        window.location.href = '/auth/pi/signin';
        return;
      }

      // Use NextAuth signIn with proper redirect handling
      await signIn(providerId, {
        callbackUrl: '/dashboard'
      });
    } catch (error) {
      console.error('OAuth sign-in failed:', error);
      setIsLoading(false);
    }
  };

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Redirect to login page with email pre-filled
    // The login page will handle both login and signup scenarios
    window.location.href = `/login?email=${encodeURIComponent(email)}`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onKeyDown={handleKeyPress}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2
            id="login-modal-title"
            className="text-2xl font-bold text-stone-900 mb-2"
          >
            Get Started with Concetto
          </h2>
          <p className="text-stone-600 text-sm">
            Join now and experience streamlined business management
          </p>
        </div>

        {/* Unified OAuth Section */}
        <div className="space-y-3 mb-4">
          {oauthProviders.map((provider) => (
            <button
              key={provider.id}
              onClick={() => handleOAuthSignIn(provider.id)}
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-stone-300 rounded-lg transition-all ${provider.bgColor} ${provider.hoverColor} ${provider.textColor} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="text-xl font-bold">{provider.icon}</span>
              <span className="font-medium">{provider.name}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-stone-300"></div>
          <span className="text-sm text-stone-500">or continue with email</span>
          <div className="flex-1 h-px bg-stone-300"></div>
        </div>

        {/* Email Form */}
        {!showEmailForm ? (
          <button
            onClick={() => setShowEmailForm(true)}
            disabled={isLoading}
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use Email
            <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <form onSubmit={handleEmailContinue} className="space-y-3">
            <div>
              <label htmlFor="email-input" className="sr-only">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-5 h-5" />
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Continuing...' : 'Continue'}
              {!isLoading && <ArrowRight className="w-5 h-5" />}
            </button>
          </form>
        )}

        {/* Terms */}
        <p className="text-xs text-stone-500 text-center mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}