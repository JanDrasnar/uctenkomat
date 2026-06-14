// Generování PDF balíku pro účetní: krycí list se souhrnem + 1 strana na doklad
// s originální fotkou. Viz docs (layout). Používá pdfkit.

import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { periodLabel } from './period.js';

function fmtKc(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('cs-CZ').format(n) + ' Kč';
}

function sumDph(docs, sazba) {
  let total = 0;
  for (const doc of docs) {
    const row = (doc.data.dph_rozpis || []).find((r) => r.sazba === sazba);
    if (row) total += row.dph || 0;
  }
  return total;
}

/**
 * Vygeneruje PDF a vrátí Promise s cestou souboru.
 * @param {string} filePath
 * @param {string} period
 * @param {Array} docs  doklady s polem `data` a `imagePath`
 * @param {object} plmajor  { nazev, ico, dic, dnes }
 */
export function generatePeriodPdf(filePath, period, docs, plmajor = {}) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = fs.createWriteStream(filePath);
    pdf.pipe(stream);
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);

    const total = docs.reduce((s, d) => s + (d.data.castka_celkem || 0), 0);

    // --- Krycí list ---
    pdf.fontSize(20).text('DOKLADY ZA OBDOBÍ', { align: 'left' });
    pdf.moveDown(0.2);
    pdf.fontSize(14).fillColor('#333').text(periodLabel(period));
    pdf.moveDown(0.8);

    pdf.fontSize(10).fillColor('#000');
    pdf.text(`Plátce: ${plmajor.nazev || '—'}`);
    pdf.text(`IČO: ${plmajor.ico || '—'}    DIČ: ${plmajor.dic || '—'}`);
    pdf.text(`Vytvořeno: ${plmajor.dnes || ''}`);
    pdf.moveDown(0.5);
    pdf.text(`Počet dokladů: ${docs.length}`);
    pdf.text(`Celkem: ${fmtKc(total)}`);
    pdf.text(`z toho DPH 21 %: ${fmtKc(sumDph(docs, 21))}`);
    pdf.text(`        DPH 12 %: ${fmtKc(sumDph(docs, 12))}`);
    pdf.moveDown(0.8);

    // Souhrnná tabulka
    const cols = [
      { label: '#', w: 25 },
      { label: 'Datum', w: 70 },
      { label: 'Dodavatel', w: 160 },
      { label: 'IČO', w: 70 },
      { label: 'Typ', w: 70 },
      { label: 'Částka', w: 80, right: true },
    ];
    const startX = pdf.x;
    let y = pdf.y;

    const drawRow = (cells, bold) => {
      let x = startX;
      pdf.fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica');
      cols.forEach((c, i) => {
        pdf.text(String(cells[i] ?? ''), x, y, { width: c.w, align: c.right ? 'right' : 'left' });
        x += c.w;
      });
      y += 16;
    };

    drawRow(cols.map((c) => c.label), true);
    pdf.moveTo(startX, y - 3).lineTo(startX + cols.reduce((s, c) => s + c.w, 0), y - 3).stroke();
    docs.forEach((doc, i) => {
      const d = doc.data;
      drawRow([i + 1, d.datum_vystaveni || '—', d.dodavatel?.nazev || '—',
        d.dodavatel?.ico || '—', d.typ_dokladu || '—', fmtKc(d.castka_celkem)]);
    });
    pdf.moveTo(startX, y - 3).lineTo(startX + cols.reduce((s, c) => s + c.w, 0), y - 3).stroke();
    y += 4;
    drawRow(['', '', '', '', 'Σ', fmtKc(total)], true);

    // --- Jedna strana na doklad ---
    docs.forEach((doc, i) => {
      pdf.addPage();
      const d = doc.data;
      pdf.fontSize(12).font('Helvetica-Bold').fillColor('#000')
        .text(`Doklad #${i + 1}  ·  ${d.dodavatel?.nazev || '—'}  ·  ${d.datum_vystaveni || '—'}  ·  ${fmtKc(d.castka_celkem)}`);
      pdf.moveDown(0.5);

      if (doc.imagePath && fs.existsSync(doc.imagePath)) {
        try {
          pdf.image(doc.imagePath, { fit: [515, 560], align: 'center' });
        } catch {
          pdf.font('Helvetica').fontSize(10).fillColor('#999').text('[obrázek nelze vložit]');
        }
      }

      pdf.moveDown(0.5).font('Helvetica').fontSize(9).fillColor('#000');
      pdf.text(`Dodavatel: ${d.dodavatel?.nazev || '—'}    IČO: ${d.dodavatel?.ico || '—'}    DIČ: ${d.dodavatel?.dic || '—'}`);
      pdf.text(`Typ: ${d.typ_dokladu || '—'}    VS: ${d.variabilni_symbol || '—'}`);
      pdf.text(`Zkontrolováno uživatelem: ${doc.reviewed ? 'ano' : 'ne'}`);
    });

    pdf.end();
  });
}
