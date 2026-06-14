// Odeslání balíku účetní. Stejná víceúrovňová logika jako u propadmin.cz:
// Resend → SendGrid → Gmail SMTP → obecné SMTP. Použijí se stejné názvy env
// proměnných, takže lze nasdílet stejné hodnoty jako v propadmin.
//
// Pokud není nakonfigurován žádný provider, nic se neodešle a vrátí se
// strukturovaná chyba — uživatel si stáhne PDF/CSV přes vrácené odkazy.

import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';

/**
 * Pošle e-mail prvním dostupným providerem. Nevyhazuje výjimku — vrací
 * strukturovaný výsledek, aby volající mohl stav zalogovat/zobrazit.
 */
async function sendEmail(to, subject, html, attachments = []) {
  const from = process.env.EMAIL_FROM || 'noreply@propadmin.cz';
  const fromName = process.env.EMAIL_FROM_NAME || 'Účtenkomat';

  const resendAttachments = attachments.map((a) => ({
    filename: a.filename,
    content: Buffer.from(a.content).toString('base64'),
    content_type: a.contentType,
  }));
  const sendgridAttachments = attachments.map((a) => ({
    filename: a.filename,
    content: Buffer.from(a.content).toString('base64'),
    type: a.contentType || 'application/octet-stream',
    disposition: 'attachment',
  }));
  const nodemailerAttachments = attachments.map((a) => ({
    filename: a.filename,
    content: Buffer.from(a.content),
    contentType: a.contentType,
  }));

  // ── 1: Resend HTTP API ────────────────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${fromName} <${from}>`,
          to: [to],
          subject,
          html,
          ...(resendAttachments.length > 0 && { attachments: resendAttachments }),
        }),
      });
      if (!res.ok) {
        const error = await res.text();
        return { ok: false, provider: 'resend', status: res.status, error };
      }
      const body = await res.json().catch(() => ({}));
      return { ok: true, provider: 'resend', messageId: body?.id };
    } catch (e) {
      return { ok: false, provider: 'resend', error: e?.message || String(e) };
    }
  }

  // ── 2: SendGrid HTTP API ──────────────────────────────────────────────────
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from, name: fromName },
          subject,
          content: [{ type: 'text/html', value: html }],
          ...(sendgridAttachments.length > 0 && { attachments: sendgridAttachments }),
        }),
      });
      if (!res.ok) {
        const error = await res.text();
        return { ok: false, provider: 'sendgrid', status: res.status, error };
      }
      return { ok: true, provider: 'sendgrid', messageId: res.headers.get('x-message-id') || undefined };
    } catch (e) {
      return { ok: false, provider: 'sendgrid', error: e?.message || String(e) };
    }
  }

  // ── 3: Gmail SMTP ─────────────────────────────────────────────────────────
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });
      const info = await transporter.sendMail({
        from: `"${fromName}" <${gmailUser}>`,
        to, subject, html,
        ...(nodemailerAttachments.length > 0 && { attachments: nodemailerAttachments }),
      });
      return { ok: true, provider: 'gmail', messageId: info.messageId };
    } catch (e) {
      return { ok: false, provider: 'gmail', error: e?.message || String(e) };
    }
  }

  // ── 4: Obecné SMTP ────────────────────────────────────────────────────────
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: smtpUser, pass: smtpPass },
      });
      const info = await transporter.sendMail({
        from: `"${fromName}" <${from}>`,
        to, subject, html,
        ...(nodemailerAttachments.length > 0 && { attachments: nodemailerAttachments }),
      });
      return { ok: true, provider: 'smtp', messageId: info.messageId };
    } catch (e) {
      return { ok: false, provider: 'smtp', error: e?.message || String(e) };
    }
  }

  return { ok: false, provider: 'none', error: 'Žádný e-mailový provider není nakonfigurován.' };
}

/**
 * Odešle balík dokladů (PDF + CSV) účetní na ACCOUNTANT_EMAIL.
 * @returns {Promise<{sent:boolean, provider?:string, to?:string, reason?:string}>}
 */
export async function sendToAccountant({ period, pdfPath, csvPath, to }) {
  // E-mail účetní z aplikace (nastavení) má přednost; ACCOUNTANT_EMAIL je fallback.
  const recipient = to || process.env.ACCOUNTANT_EMAIL;
  if (!recipient) {
    return { sent: false, reason: 'E-mail účetní není nastaven — soubory ke stažení.' };
  }

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f5f5f5;padding:40px 0">
  <div style="max-width:480px;margin:0 auto;background:white;border-radius:12px;padding:40px;border:1px solid #e5e7eb">
    <h1 style="color:#1D6FE0;font-size:22px;margin-bottom:8px">Účtenkomat</h1>
    <h2 style="font-size:18px;margin-bottom:16px">Doklady za období ${period}</h2>
    <p style="color:#374151;font-size:14px">V příloze najdete PDF se souhrnem a fotkami dokladů a CSV pro import.</p>
    <p style="color:#9ca3af;font-size:12px;margin-top:32px">Odesláno aplikací Účtenkomat</p>
  </div></body></html>`;

  const attachments = [
    { filename: path.basename(pdfPath), content: fs.readFileSync(pdfPath), contentType: 'application/pdf' },
    { filename: path.basename(csvPath), content: fs.readFileSync(csvPath), contentType: 'text/csv' },
  ];

  const result = await sendEmail(recipient, `Účtenkomat — doklady za období ${period}`, html, attachments);
  if (result.ok) return { sent: true, provider: result.provider, to: recipient };
  return { sent: false, provider: result.provider, reason: result.error };
}
