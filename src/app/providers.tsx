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
  themeEditorEntitled?: boolean;
  isLoggedIn?: boolean;
}

export function Providers({ children, themePreference, themeEditorEntitled, isLoggedIn }: ProvidersProps) {
  return (
    <TrialRestrictionProvider>
      <ThemeProvider initialPreference={themePreference} themeEditorEntitled={themeEditorEntitled} isLoggedIn={isLoggedIn}>
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
