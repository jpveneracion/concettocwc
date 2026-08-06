'use client';

import AppLayout from '@/components/AppLayout';
import ModePicker from '@/components/theme/ModePicker';
import PresetPicker from '@/components/theme/PresetPicker';

export default function AppearanceSettings() {
  return (
    <AppLayout>
      <div className="mb-4 md:mb-6">
        <h1 className="text-lg md:text-xl font-semibold">Appearance</h1>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 mb-4">
          <ModePicker />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 mb-4">
          <PresetPicker />
        </div>
      </div>
    </AppLayout>
  );
}
