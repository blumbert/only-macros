import { useColorScheme } from 'react-native';

export type MacroKey = 'c' | 'p' | 'f';

export const MACROS: { key: MacroKey; letter: string; name: string; kcalPerGram: number }[] = [
  { key: 'c', letter: 'C', name: 'Carbs', kcalPerGram: 4 },
  { key: 'p', letter: 'P', name: 'Protein', kcalPerGram: 4 },
  { key: 'f', letter: 'F', name: 'Fat', kcalPerGram: 9 },
];

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  onAccent: string;
  macro: Record<MacroKey, string>;
};

const dark: Palette = {
  bg: '#0A0B0E',
  surface: '#14171F',
  surfaceAlt: '#1C202B',
  border: '#262B37',
  text: '#F3F5F9',
  muted: '#8C94A5',
  faint: '#5A6172',
  accent: '#F3F5F9',
  onAccent: '#0A0B0E',
  macro: { c: '#FFB020', p: '#5B9BFF', f: '#B98BFF' },
};

const light: Palette = {
  bg: '#F3F4F7',
  surface: '#FFFFFF',
  surfaceAlt: '#EDEFF4',
  border: '#E1E5EC',
  text: '#0D1117',
  muted: '#666E7D',
  faint: '#9AA1AF',
  accent: '#0D1117',
  onAccent: '#FFFFFF',
  macro: { c: '#B7791F', p: '#2563EB', f: '#7C3AED' },
};

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';
  return { isDark, c: isDark ? dark : light };
}

/** Thousands separator without relying on Intl being present in the JS engine. */
export function formatNumber(n: number): string {
  const rounded = Math.round(n);
  const s = String(Math.abs(rounded));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return rounded < 0 ? `-${out}` : out;
}

/** Grams render as whole numbers unless the user actually typed a fraction. */
export function formatGrams(n: number): string {
  return Number.isInteger(n) ? formatNumber(n) : (Math.round(n * 10) / 10).toFixed(1);
}
