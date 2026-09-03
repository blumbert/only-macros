/** Keeps a field to digits with at most one decimal point and one decimal place. */
export function sanitizeMacroInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned.slice(0, 4);
  const whole = cleaned.slice(0, dot).slice(0, 4);
  const frac = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 1);
  return whole + '.' + frac;
}

export function parseMacroInput(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
