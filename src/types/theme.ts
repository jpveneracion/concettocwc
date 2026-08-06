export const TOKEN_NAMES = [
  'bg',
  'surface',
  'surface2',
  'border',
  'text',
  'text-muted',
  'primary',
  'primary-foreground',
  'success',
  'warning',
  'danger',
  'ring',
] as const;

export type TokenName = typeof TOKEN_NAMES[number];

export type ThemeTokens = {
  [K in TokenName]: string;
};
