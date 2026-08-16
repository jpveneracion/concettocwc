'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { presetThemes } from '@/config/theme';
import { TOKEN_NAMES, type TokenName } from '@/types/theme';
import { getWCAGRating } from '@/lib/contrast-calculator';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export default function ThemeEditor() {
  const { tokens, customTokens, updateTokens, removeToken, save, saving, themeId } = useTheme();
  const [drafts, setDrafts] = useState<Partial<Record<TokenName, string>>>({});
  const [lowContrast, setLowContrast] = useState(false);
  const [overrideContrast, setOverrideContrast] = useState(false);
  const baselineRef = useRef(customTokens);

  const presetTokens = presetThemes[themeId] || presetThemes.light;
  const hasChanges = Object.keys(drafts).length > 0;

  // Accessibility guardrails: warn (but never block) on low WCAG AA contrast
  useEffect(() => {
    const textVsBg = getWCAGRating(tokens.text, tokens.bg);
    const primaryFgVsPrimary = getWCAGRating(tokens['primary-foreground'], tokens.primary);
    setLowContrast(!textVsBg.aa || !primaryFgVsPrimary.aa);
  }, [tokens.text, tokens.bg, tokens.primary, tokens['primary-foreground']]);

  const handleTokenChange = useCallback(
    (tokenName: TokenName, value: string) => {
      setDrafts((prev) => ({ ...prev, [tokenName]: value }));
      if (HEX_REGEX.test(value)) {
        updateTokens({ [tokenName]: value });
      }
    },
    [updateTokens]
  );

  const resetTokenToBaseline = useCallback(
    (tokenName: TokenName) => {
      const baseline = baselineRef.current[tokenName];
      if (baseline) {
        updateTokens({ [tokenName]: baseline });
      } else {
        removeToken(tokenName);
      }
    },
    [updateTokens, removeToken]
  );

  const handleResetToken = useCallback(
    (tokenName: TokenName) => {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[tokenName];
        return next;
      });
      resetTokenToBaseline(tokenName);
    },
    [resetTokenToBaseline]
  );

  const handleSave = async () => {
    await save();
    baselineRef.current = customTokens;
    setDrafts({});
  };

  const handleCancel = () => {
    Object.keys(drafts).forEach((tokenName) => {
      resetTokenToBaseline(tokenName as TokenName);
    });
    setDrafts({});
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Customize Colors</h2>

        {hasChanges && (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg border border-stone-300 hover:bg-stone-100 text-sm"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {TOKEN_NAMES.map((tokenName) => (
          <div
            key={tokenName}
            className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-stone-200 bg-stone-50"
          >
            <div className="w-32 font-medium text-sm text-stone-900">{tokenName}</div>

            <input
              type="color"
              value={drafts[tokenName] || tokens[tokenName]}
              onChange={(e) => handleTokenChange(tokenName, e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0"
              aria-label={`Change ${tokenName} color`}
            />

            <input
              type="text"
              value={drafts[tokenName] || tokens[tokenName]}
              onChange={(e) => handleTokenChange(tokenName, e.target.value)}
              className="flex-1 min-w-28 px-3 py-2 rounded border border-stone-300 bg-white text-sm text-stone-900"
              placeholder="#000000"
              maxLength={7}
            />

            {(tokenName in drafts || tokenName in customTokens) && (
              <button
                onClick={() => handleResetToken(tokenName)}
                className="px-3 py-2 text-sm rounded border border-stone-300 hover:bg-stone-100 text-stone-700"
                aria-label={`Reset ${tokenName} to preset`}
              >
                Reset
              </button>
            )}

            <div
              className="w-10 h-10 rounded border border-stone-300"
              style={{ backgroundColor: tokens[tokenName] }}
              aria-label={`${tokenName} preview`}
            />
          </div>
        ))}
      </div>

      {lowContrast && !overrideContrast && (
        <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-300">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-amber-500 shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <div className="font-medium text-amber-900">Low contrast warning</div>
              <div className="text-sm text-amber-800">
                Some color combinations may not meet WCAG AA standards (text vs background,
                button text vs button color).
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={overrideContrast}
              onChange={(e) => setOverrideContrast(e.target.checked)}
            />
            <span className="text-sm text-amber-900">I understand contrast may be low</span>
          </label>
        </div>
      )}
    </section>
  );
}
