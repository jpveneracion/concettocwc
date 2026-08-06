'use client';

import { useCallback, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { presetThemes } from '@/config/theme';
import { TOKEN_NAMES, type TokenName } from '@/types/theme';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export default function ThemeEditor() {
  const { tokens, customTokens, updateTokens, removeToken, save, saving, themeId } = useTheme();
  const [drafts, setDrafts] = useState<Partial<Record<TokenName, string>>>({});
  const baselineRef = useRef(customTokens);

  const presetTokens = presetThemes[themeId] || presetThemes.light;
  const hasChanges = Object.keys(drafts).length > 0;

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
              className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-sm"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
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
            className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50"
          >
            <div className="w-32 font-medium text-sm text-gray-900">{tokenName}</div>

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
              className="flex-1 min-w-28 px-3 py-2 rounded border border-gray-300 bg-white text-sm text-gray-900"
              placeholder="#000000"
              maxLength={7}
            />

            {(tokenName in drafts || tokenName in customTokens) && (
              <button
                onClick={() => handleResetToken(tokenName)}
                className="px-3 py-2 text-sm rounded border border-gray-300 hover:bg-gray-100 text-gray-700"
                aria-label={`Reset ${tokenName} to preset`}
              >
                Reset
              </button>
            )}

            <div
              className="w-10 h-10 rounded border border-gray-300"
              style={{ backgroundColor: tokens[tokenName] }}
              aria-label={`${tokenName} preview`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
