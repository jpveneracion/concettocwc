'use client';

import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeEditorLock() {
  const { canUseThemeEditor } = useTheme();
  if (canUseThemeEditor) return null;

  return (
    <section className="mb-8">
      <div className="p-6 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
        <h2 className="text-lg font-semibold mb-2">Customize Colors</h2>
        <p className="text-sm text-gray-600 mb-4">
          The theme editor is a premium feature. Redeem an activation code to unlock it and make the app your own.
        </p>
        <ul className="text-sm space-y-1 mb-4 text-gray-700">
          <li>• Custom brand colors across the entire app</li>
          <li>• Live preview while you edit</li>
          <li>• Saved to your account</li>
        </ul>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/activate-code"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 text-center"
          >
            Activate with code
          </a>
          <a
            href="/subscription/checkout"
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-sm text-center"
          >
            View subscription plans
          </a>
        </div>
      </div>
    </section>
  );
}
