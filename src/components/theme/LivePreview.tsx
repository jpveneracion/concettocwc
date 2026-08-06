'use client';

import { useTheme } from '@/contexts/ThemeContext';

export default function LivePreview() {
  const { tokens } = useTheme();

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Live Preview</h2>

      <div
        className="p-6 rounded-lg border"
        style={{
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
          color: tokens.text,
        }}
      >
        <button
          className="px-4 py-2 rounded mb-4"
          style={{
            backgroundColor: tokens.primary,
            color: tokens['primary-foreground'],
          }}
        >
          Sample Button
        </button>

        <div
          className="p-4 rounded mb-4"
          style={{
            backgroundColor: tokens.bg,
            border: `1px solid ${tokens.border}`,
          }}
        >
          <h3 className="font-semibold mb-2">Card Title</h3>
          <p style={{ color: tokens['text-muted'] }}>
            This is how content will look with your custom colors.
          </p>
        </div>

        <div
          className="p-3 rounded"
          style={{
            backgroundColor: tokens.surface2,
            borderBottom: `1px solid ${tokens.border}`,
          }}
        >
          <span className="font-medium">Table Header</span>
        </div>

        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: tokens.success }} />
            <span className="text-sm">Success</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: tokens.warning }} />
            <span className="text-sm">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: tokens.danger }} />
            <span className="text-sm">Danger</span>
          </div>
        </div>
      </div>
    </section>
  );
}
