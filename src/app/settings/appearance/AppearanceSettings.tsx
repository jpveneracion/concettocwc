'use client';

import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import ModePicker from '@/components/theme/ModePicker';
import PresetPicker from '@/components/theme/PresetPicker';
import ThemeEditor from '@/components/theme/ThemeEditor';
import ThemeEditorLock from '@/components/theme/ThemeEditorLock';
import LivePreview from '@/components/theme/LivePreview';
import { useTheme } from '@/contexts/ThemeContext';

export default function AppearanceSettings() {
  const { canUseThemeEditor, save, saving } = useTheme();
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await save();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppLayout>
      <div className="mb-4 md:mb-6 flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-semibold">Appearance</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Saved</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white border border-stone-200 rounded-xl p-4 md:p-5 mb-4">
          <ModePicker />
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 md:p-5 mb-4">
          <PresetPicker />
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 md:p-5 mb-4">
          {canUseThemeEditor ? (
            <>
              <ThemeEditor />
              <LivePreview />
            </>
          ) : (
            <ThemeEditorLock />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
