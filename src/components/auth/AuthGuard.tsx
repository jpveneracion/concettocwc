'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || status === 'loading') return; // Wait for component mount and session to load

    // Allow access to login and account choice pages
    if (pathname === '/login' || pathname === '/auth/account-choice') {
      return;
    }

    // Check if user has completed account setup
    if (session && !(session as any).companyId) {
      router.replace('/auth/account-choice');
    }
  }, [session, status, router, pathname, isMounted]);

  if (!isMounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}