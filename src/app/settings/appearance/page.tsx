import type { Metadata } from 'next';
import AppearanceSettings from './AppearanceSettings';

export const metadata: Metadata = {
  title: 'Appearance',
  description: 'Customize your theme and appearance preferences',
};

export default function AppearanceSettingsPage() {
  return <AppearanceSettings />;
}
