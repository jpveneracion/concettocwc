'use client';

import { TrialRestrictionProvider } from '@/contexts/TrialRestrictionContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import dynamic from 'next/dynamic';
import type { ThemePreference } from '@/lib/theme-schema';

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
  themePreference?: ThemePreference | null;
}

export function Providers({ children, themePreference }: ProvidersProps) {
  return (
    <TrialRestrictionProvider>
      <ThemeProvider initialPreference={themePreference}>
        <OnboardingProvider
          enabled={true}
          respectAdminExclusion={true}
          triggerDelay={1500}
          autoTrigger={true}
        >
          {children}
        </OnboardingProvider>
      </ThemeProvider>
    </TrialRestrictionProvider>
  );
}
