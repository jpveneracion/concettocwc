'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const currentPath = window.location.pathname;

  useEffect(() => {
    if (status === 'loading') return; // Wait for session to load

    // Allow access to login and account choice pages
    if (currentPath === '/login' || currentPath === '/auth/account-choice') {
      return;
    }

    // Check if user has completed account setup
    if (session && !(session as any).companyId) {
      router.replace('/auth/account-choice');
    }
  }, [session, status, router, currentPath]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}