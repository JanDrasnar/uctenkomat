// Zařazení dokladu do účetního období podle data vystavení.
import type { PeriodType } from './settings';

/** "2026-Q2" (čtvrtletí) nebo "2026-04" (měsíc); bez data "neurceno". */
export function periodKey(isoDate: string | null | undefined, type: PeriodType): string {
  const m = isoDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 'neurceno';
  const year = m[1];
  const month = Number(m[2]);
  if (type === 'mesic') return `${year}-${m[2]}`;
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}

/** Lidský popis období, např. "2. čtvrtletí 2026" nebo "duben 2026". */
export function periodLabel(key: string): string {
  if (!key || key === 'neurceno') return 'Nezařazeno';
  const mesice = [
    'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
    'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
  ];
  const q = key.match(/^(\d{4})-Q(\d)$/);
  if (q) return `${q[2]}. čtvrtletí ${q[1]}`;
  const m = key.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${mesice[Number(m[2]) - 1]} ${m[1]}`;
  return key;
}
