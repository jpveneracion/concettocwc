/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Calculate relative luminance (WCAG formula)
 */
function luminance(rgb: { r: number; g: number; b: number }): number {
  const a = [rgb.r, rgb.g, rgb.b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Calculate contrast ratio between two hex colors
 */
export function contrastRatio(color1: string, color2: string): number {
  const lum1 = luminance(hexToRgb(color1));
  const lum2 = luminance(hexToRgb(color2));
  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (brighter + 0.05) / (darker + 0.05);
}

/**
 * Check WCAG AA compliance (4.5:1 for normal text)
 */
export function isWCAG_AA(color1: string, color2: string): boolean {
  return contrastRatio(color1, color2) >= 4.5;
}

/**
 * Get WCAG rating
 */
export function getWCAGRating(color1: string, color2: string): {
  ratio: number;
  aa: boolean;
  aaa: boolean;
} {
  const ratio = contrastRatio(color1, color2);
  return {
    ratio: Math.round(ratio * 100) / 100,
    aa: ratio >= 4.5,
    aaa: ratio >= 7.0,
  };
}
