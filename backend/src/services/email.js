// Odeslání balíku účetní. Pokud není nastaveno SMTP, jen vrátíme, že se nic neposlalo
// (uživatel si stáhne PDF/CSV přes vrácené odkazy). Nodemailer je volitelný.

import fs from 'node:fs';
import path from 'node:path';

export async function sendToAccountant({ period, pdfPath, csvPath }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ACCOUNTANT_EMAIL } = process.env;

  if (!SMTP_HOST || !ACCOUNTANT_EMAIL) {
    return { sent: false, reason: 'SMTP nebo e-mail účetní nenastaveno — soubory ke stažení.' };
  }

  // Dynamický import, aby backend běžel i bez nainstalovaného nodemaileru.
  let nodemailer;
  try {
    ({ default: nodemailer } = await import('nodemailer'));
  } catch {
    return { sent: false, reason: 'Balíček nodemailer není nainstalován (npm i nodemailer).' };
  }

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  await transport.sendMail({
    from: SMTP_USER,
    to: ACCOUNTANT_EMAIL,
    subject: `Účtenkomat — doklady za období ${period}`,
    text: `V příloze najdete doklady za období ${period} (PDF se souhrnem a fotkami + CSV).`,
    attachments: [
      { filename: path.basename(pdfPath), content: fs.createReadStream(pdfPath) },
      { filename: path.basename(csvPath), content: fs.createReadStream(csvPath) },
    ],
  });

  return { sent: true, to: ACCOUNTANT_EMAIL };
}
