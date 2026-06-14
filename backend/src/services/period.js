// Zařazení dokladu do účetního období podle data vystavení.

const PERIOD_TYPE = process.env.DEFAULT_PERIOD_TYPE || 'ctvrtleti';

/**
 * Vrátí klíč období pro dané datum.
 *  - čtvrtletí: "2026-Q2"
 *  - měsíc:     "2026-04"
 * @param {string|null} isoDate  YYYY-MM-DD; pokud null, zařadí se do "neurceno"
 * @param {string} [type]
 * @returns {string}
 */
export function periodKey(isoDate, type = PERIOD_TYPE) {
  if (!isoDate) return 'neurceno';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return 'neurceno';

  const year = d.getFullYear();
  const month = d.getMonth(); // 0-11

  if (type === 'mesic') {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
  const q = Math.floor(month / 3) + 1;
  return `${year}-Q${q}`;
}

/** Lidský popis období, např. "2. čtvrtletí 2026" nebo "duben 2026". */
export function periodLabel(key) {
  if (key === 'neurceno') return 'Nezařazeno';
  const mesice = [
    'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
    'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
  ];
  const qMatch = key.match(/^(\d{4})-Q(\d)$/);
  if (qMatch) return `${qMatch[2]}. čtvrtletí ${qMatch[1]}`;
  const mMatch = key.match(/^(\d{4})-(\d{2})$/);
  if (mMatch) return `${mesice[Number(mMatch[2]) - 1]} ${mMatch[1]}`;
  return key;
}

/** Aktuální období pro dané datum (default dnešek předaný volajícím). */
export function currentPeriodKey(today) {
  return periodKey(today);
}
