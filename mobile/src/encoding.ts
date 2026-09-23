// Base64 / MIME pomocníci. Hermes má btoa jen pro latin1, proto vlastní
// UTF-8 → base64 kódování (potřebujeme ho pro e-maily s diakritikou).

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    let c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else {
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
  }
  return out;
}

export function utf8ToBase64(s: string): string {
  const b = utf8Bytes(s);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < b.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < b.length ? B64[n & 63] : '=';
  }
  return out;
}

/** Zalomí base64 na řádky po 76 znacích (RFC 2045). */
function wrap76(b64: string): string {
  return b64.replace(/(.{76})/g, '$1\r\n');
}

/** Bezpečný ASCII název souboru (bez diakritiky a zvláštních znaků). */
export function asciiName(s: string): string {
  let t = s;
  try {
    t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    // normalize nemusí být dostupné — nevadí
  }
  return t.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 60) || 'doklad';
}

export interface MailAttachment {
  filename: string;
  mimeType: string;
  base64: string;
}

/** Sestaví RFC 822 zprávu (multipart/mixed) čistě v ASCII — vše je base64. */
export function buildMime(opts: {
  to: string;
  subject: string;
  text: string;
  attachments: MailAttachment[];
}): string {
  const boundary = `uctenkomat_${Date.now().toString(36)}`;
  const lines = [
    `To: ${opts.to}`,
    `Subject: =?UTF-8?B?${utf8ToBase64(opts.subject)}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(utf8ToBase64(opts.text)),
  ];
  for (const a of opts.attachments) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${a.mimeType}; name="${a.filename}"`,
      `Content-Disposition: attachment; filename="${a.filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(a.base64),
    );
  }
  lines.push(`--${boundary}--`, '');
  return lines.join('\r\n');
}
