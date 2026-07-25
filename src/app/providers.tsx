'use client';

import { TrialRestrictionProvider } from '@/contexts/TrialRestrictionContext';
import dynamic from 'next/dynamic';

// Dynamically import OnboardingProvider to disable SSR
const OnboardingProvider = dynamic(
  () => import('@/components/providers/OnboardingProvider').then(mod => ({ default: mod.OnboardingProvider })),
  { ssr: false }
);

const OnboardingModal = dynamic(
  () => import('@/components/onboarding/OnboardingModal'),
  { ssr: false }
);

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <TrialRestrictionProvider>
      <OnboardingProvider
        enabled={true}
        respectAdminExclusion={true}
        triggerDelay={1500}
        autoTrigger={true}
      >
        {children}
      </OnboardingProvider>
    </TrialRestrictionProvider>
  );
}