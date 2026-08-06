'use client';

import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeMode } from '@/lib/theme-utils';

const modes: { id: ThemeMode; label: string; description: string }[] = [
  { id: 'light', label: 'Light', description: 'Always use light theme' },
  { id: 'dark', label: 'Dark', description: 'Always use dark theme' },
  { id: 'system', label: 'System', description: 'Follow your OS preference' },
];

export default function ModePicker() {
  const { mode, setMode, save } = useTheme();

  const handleModeChange = async (newMode: ThemeMode) => {
    setMode(newMode);
    await save();
  };

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Theme Mode</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => handleModeChange(m.id)}
            className={`
              p-4 rounded-lg border-2 transition-all text-left
              ${mode === m.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
              }
            `}
            aria-pressed={mode === m.id}
          >
            <div className="font-medium mb-1">{m.label}</div>
            <div className="text-sm text-muted">{m.description}</div>

            <div className="flex gap-2 mt-3">
              <div className="w-6 h-6 rounded-full bg-bg border border-border" />
              <div className="w-6 h-6 rounded-full bg-text" />
              <div className="w-6 h-6 rounded-full bg-primary" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
