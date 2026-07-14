'use client';

import { SessionProvider } from '@/contexts/SessionContext';
import { TrialRestrictionProvider } from '@/contexts/TrialRestrictionContext';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <TrialRestrictionProvider>
        {children}
      </TrialRestrictionProvider>
    </SessionProvider>
  );
}