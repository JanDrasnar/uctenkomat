// Generování CSV pro účetní. Středník (CZ Excel default) + UTF-8 BOM (aby Excel
// na českých Windows otevřel diakritiku správně).

import fs from 'node:fs';

const HEADER = [
  'cislo', 'datum', 'dodavatel', 'ico', 'dic', 'typ',
  'zaklad_21', 'dph_21', 'zaklad_12', 'dph_12', 'celkem', 'mena', 'vs',
];

function dphPart(doc, sazba, field) {
  const row = (doc.data.dph_rozpis || []).find((r) => r.sazba === sazba);
  return row ? row[field] : '';
}

function esc(value) {
  const s = value == null ? '' : String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Zapíše CSV soubor a vrátí jeho cestu. */
export function generateCsv(filePath, docs) {
  const lines = [HEADER.join(';')];
  docs.forEach((doc, i) => {
    const d = doc.data;
    lines.push([
      i + 1,
      d.datum_vystaveni ?? '',
      esc(d.dodavatel?.nazev),
      d.dodavatel?.ico ?? '',
      d.dodavatel?.dic ?? '',
      d.typ_dokladu ?? '',
      dphPart(doc, 21, 'zaklad'),
      dphPart(doc, 21, 'dph'),
      dphPart(doc, 12, 'zaklad'),
      dphPart(doc, 12, 'dph'),
      d.castka_celkem ?? '',
      d.mena ?? 'CZK',
      d.variabilni_symbol ?? '',
    ].join(';'));
  });

  const content = '﻿' + lines.join('\r\n'); // BOM + CRLF
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}
