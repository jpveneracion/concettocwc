'use client';

import { SessionProvider, useSession } from '@/contexts/SessionContext';
import { TrialRestrictionProvider } from '@/contexts/TrialRestrictionContext';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <TrialRestrictionWrapper>
        {children}
      </TrialRestrictionWrapper>
    </SessionProvider>
  );
}

function TrialRestrictionWrapper({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  return (
    <TrialRestrictionProvider session={session}>
      {children}
    </TrialRestrictionProvider>
  );
}