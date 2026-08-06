'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { presetThemes } from '@/config/theme';

const presetInfo: Record<string, { name: string; description: string }> = {
  light: { name: 'Light', description: 'Clean and bright' },
  dark: { name: 'Dark', description: 'Easy on the eyes' },
  'concetto-blue': { name: 'Concetto Blue', description: 'Branded look' },
};

export default function PresetPicker() {
  const { themeId, setTheme, save } = useTheme();

  const handlePresetChange = async (presetId: string) => {
    setTheme(presetId);
    await save();
  };

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Color Theme</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.entries(presetThemes).map(([id, tokens]) => (
          <button
            key={id}
            onClick={() => handlePresetChange(id)}
            className={`
              p-4 rounded-lg border-2 transition-all text-left
              ${themeId === id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
              }
            `}
            aria-pressed={themeId === id}
          >
            <div className="flex gap-1 mb-3 h-16 rounded overflow-hidden">
              <div className="flex-1" style={{ backgroundColor: tokens.bg }} />
              <div className="flex-1" style={{ backgroundColor: tokens.surface }} />
              <div className="flex-1" style={{ backgroundColor: tokens.primary }} />
              <div className="flex-1" style={{ backgroundColor: tokens.text }} />
            </div>

            <div className="font-medium">{presetInfo[id]?.name || id}</div>
            <div className="text-sm text-muted">{presetInfo[id]?.description}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
