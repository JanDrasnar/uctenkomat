// CSV pro účetní (souhrnné odeslání za období). Středník + BOM kvůli českému Excelu.
import type { Doklad } from './types';

const HEADER = [
  'cislo', 'datum', 'cislo_dokladu', 'dodavatel', 'ico', 'dic', 'typ',
  'zaklad_21', 'dph_21', 'zaklad_12', 'dph_12', 'zaklad_0', 'celkem', 'mena', 'vs', 'foto',
];

export function dph(doc: Doklad, sazba: number, field: 'zaklad' | 'dph'): number | '' {
  const row = (doc.data?.dph_rozpis ?? []).find((r) => Number(r.sazba) === sazba);
  return row ? row[field] : '';
}

function esc(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(docs: Doklad[]): string {
  const lines = [HEADER.join(';')];
  docs.forEach((doc, i) => {
    const d = doc.data!;
    lines.push([
      i + 1, d.datum_vystaveni, esc(d.cislo_dokladu), esc(d.dodavatel?.nazev),
      d.dodavatel?.ico, d.dodavatel?.dic, d.typ_dokladu,
      dph(doc, 21, 'zaklad'), dph(doc, 21, 'dph'), dph(doc, 12, 'zaklad'), dph(doc, 12, 'dph'),
      dph(doc, 0, 'zaklad'), d.castka_celkem, d.mena ?? 'CZK', esc(d.variabilni_symbol),
      doc.driveLink,
    ].map((v) => (v == null ? '' : String(v))).join(';'));
  });
  return '﻿' + lines.join('\r\n');
}
