export const colors = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  primary: '#1D6FE0',
  primaryText: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#6B7280',
  border: '#E2E5EA',
  warn: '#C9700A',
  warnBg: '#FDF3E3',
  ok: '#1B873F',
};

export function fmtKc(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('cs-CZ').format(n) + ' Kč';
}
