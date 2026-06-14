// Lidský popis klíče období (mirror backendu). Backend posílá i `label`,
// tohle je fallback pro souhrny období.
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
