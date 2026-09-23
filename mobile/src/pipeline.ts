// Zpracování dokladu přímo v telefonu:
//   fotka → AI extrakce (klíč uživatele) → ARES → Google Drive (fotka)
//   → Google Sheets (řádek) → [per_photo] e-mail účetní → notifikace.
//
// Každý krok si výsledek uloží do záznamu, takže přerušené zpracování
// (zavřená aplikace, výpadek sítě) lze bezpečně navázat tam, kde skončilo.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { Doklad, DokladData } from './types';
import { extractDoklad } from './ai/extract';
import { lookupIco } from './ares';
import {
  appendRow, getSetup, sendMail, shareFolderWith, updateHeader, updateRow, uploadPhoto, type SheetCell,
} from './google';
import { costUsd, usdCzkRate } from './ai/pricing';
import { addDoklad, getDoklad, listDoklady, updateDoklad } from './store';
import { getApiKey, getSettings, modelFor } from './settings';
import { periodKey, periodLabel } from './period';
import { asciiName, utf8ToBase64 } from './encoding';
import { buildCsv, dph } from './csv';
import { notify } from './notify';
import { fmtKc } from './theme';

const PHOTO_DIR = new Directory(Paths.document, 'doklady');
// Rozumná velikost pro AI (Claude i tak zmenšuje nad ~1568 px delší strany).
const AI_MAX_EDGE = 1600;
// Gmail povolí 35 MB zprávu; base64 přidává ~33 %.
const MAX_ATTACH_BYTES = 18 * 1024 * 1024;

const running = new Set<string>();

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Uloží fotku z kamery, založí záznam a spustí zpracování na pozadí. */
export async function addPhoto(uri: string, width?: number, height?: number): Promise<string> {
  if (!PHOTO_DIR.exists) PHOTO_DIR.create({ intermediates: true, idempotent: true });
  const id = newId();
  const dest = new File(PHOTO_DIR, `${id}.jpg`);
  await new File(uri).copy(dest);

  await addDoklad({
    id,
    createdAt: new Date().toISOString(),
    photoUri: dest.uri,
    photoWidth: width,
    photoHeight: height,
    status: 'zpracovava',
    step: 'Čeká na zpracování',
    period: 'neurceno',
    data: null,
    reviewed: false,
  });
  processDoklad(id); // záměrně bez await — uživatel může hned fotit další
  return id;
}

// Zvyš při každé změně sloupců/formátu tabulky — při startu se pak přepíše
// hlavička i všechny řádky. v2: čisté URL ve Foto (dřív HYPERLINK → #ERROR!
// v české tabulce), v3: sloupce se spotřebou a cenou AI.
const SHEET_VERSION = 3;
const SHEET_VERSION_KEY = 'uctenkomat.sheetVersion';

export async function migrateSheet() {
  if (Number(await AsyncStorage.getItem(SHEET_VERSION_KEY)) >= SHEET_VERSION) return;
  try {
    if (!(await getSetup())) return; // tabulka ještě neexistuje — vznikne rovnou nová
    await updateHeader();
    for (const d of await listDoklady()) {
      if (d.sheetRow && d.data) await updateRow(d.sheetRow, sheetRowValues(d));
    }
    await AsyncStorage.setItem(SHEET_VERSION_KEY, String(SHEET_VERSION));
  } catch {
    // nepřihlášen / offline — zkusí se při dalším startu
  }
}

/** Naváže zpracování všech nedokončených dokladů (po startu aplikace). */
export async function resumePending() {
  for (const d of await listDoklady()) {
    if (d.status === 'zpracovava') processDoklad(d.id);
  }
}

async function aiImageBase64(doc: Doklad): Promise<string> {
  const landscape = (doc.photoWidth ?? 0) > (doc.photoHeight ?? 0);
  const ctx = ImageManipulator.manipulate(doc.photoUri);
  ctx.resize(landscape ? { width: AI_MAX_EDGE, height: null } : { width: null, height: AI_MAX_EDGE });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!out.base64) throw new Error('Nepodařilo se připravit obrázek pro AI.');
  return out.base64;
}

function photoName(doc: Doklad): string {
  const d = doc.data;
  return `${d?.datum_vystaveni ?? 'bez-data'}_${asciiName(d?.dodavatel?.nazev ?? 'doklad')}_${doc.id}.jpg`;
}

export function sheetRowValues(doc: Doklad): SheetCell[] {
  const d = doc.data!;
  // Apostrof = text (jinak by Sheets z IČO "01234567" udělal číslo 1234567).
  const txt = (v: string | null | undefined) => (v ? `'${v}` : '');
  // Čistá URL — Sheets ji sám zobrazí jako odkaz. (Vzorec HYPERLINK by závisel
  // na národním prostředí tabulky: v cs_CZ se argumenty oddělují středníkem.)
  const photo = doc.driveLink ?? '';
  return [
    doc.id, doc.createdAt.slice(0, 10), d.typ_dokladu, d.datum_vystaveni, d.datum_splatnosti ?? '',
    txt(d.cislo_dokladu), d.dodavatel?.nazev ?? '', txt(d.dodavatel?.ico), d.dodavatel?.dic ?? '',
    d.dodavatel?.adresa ?? '', txt(d.variabilni_symbol), d.mena,
    dph(doc, 21, 'zaklad'), dph(doc, 21, 'dph'), dph(doc, 12, 'zaklad'), dph(doc, 12, 'dph'),
    dph(doc, 0, 'zaklad'), d.castka_celkem, d.pole_ke_kontrole.join(', '),
    d.ares_overeno ? 'ano' : 'ne', photo, doc.sentAt ? doc.sentAt.slice(0, 16).replace('T', ' ') : '',
    periodLabel(doc.period), doc.aiProvider ?? '',
    doc.aiUsage?.inputTokens ?? '', doc.aiUsage?.outputTokens ?? '', doc.aiUsage?.costCzk ?? '',
  ];
}

function summary(d: DokladData): string {
  const dphLines = d.dph_rozpis.map((r) => `  ${r.sazba} %: základ ${r.zaklad}, DPH ${r.dph}`).join('\n');
  return [
    `Dodavatel: ${d.dodavatel?.nazev ?? '—'}`,
    `IČO: ${d.dodavatel?.ico ?? '—'}   DIČ: ${d.dodavatel?.dic ?? '—'}`,
    `Typ: ${d.typ_dokladu}`,
    `Číslo dokladu: ${d.cislo_dokladu ?? '—'}`,
    `Datum vystavení / DUZP: ${d.datum_vystaveni ?? '—'}`,
    d.datum_splatnosti ? `Splatnost: ${d.datum_splatnosti}` : null,
    d.variabilni_symbol ? `VS: ${d.variabilni_symbol}` : null,
    `Celkem: ${d.castka_celkem ?? '—'} ${d.mena}`,
    dphLines ? `DPH:\n${dphLines}` : 'DPH: neuvedeno',
    d.pole_ke_kontrole.length ? `Ke kontrole: ${d.pole_ke_kontrole.join(', ')}` : null,
  ].filter(Boolean).join('\n');
}

/** Sdílení složky nesmí zablokovat odeslání — fotka je i v příloze e-mailu. */
async function shareWithAccountant(email: string) {
  try {
    await shareFolderWith(email);
  } catch (e) {
    console.warn('Sdílení složky s účetní selhalo:', e);
  }
}

/** Odešle jeden doklad účetní (fotka v příloze + údaje v textu). */
export async function sendSingle(doc: Doklad, to: string, correction = false): Promise<Doklad> {
  const d = doc.data!;
  await shareWithAccountant(to);
  const photo = await new File(doc.photoUri).base64();
  await sendMail({
    to,
    subject: `${correction ? 'Oprava: ' : ''}Doklad ${d.dodavatel?.nazev ?? ''} ${d.datum_vystaveni ?? ''} – ${fmtKc(d.castka_celkem)}`.trim(),
    text: `Dobrý den,\n\nv příloze posílám ${correction ? 'opravený ' : ''}doklad.\n\n${summary(d)}\n\n` +
      (doc.driveLink ? `Originál na Google Disku: ${doc.driveLink}\n\n` : '') +
      'Odesláno z aplikace Účtenkomat.',
    attachments: [{ filename: photoName(doc), mimeType: 'image/jpeg', base64: photo }],
  });
  const sent = (await updateDoklad(doc.id, { sentAt: new Date().toISOString() }))!;
  if (sent.sheetRow) await updateRow(sent.sheetRow, sheetRowValues(sent));
  return sent;
}

export async function processDoklad(id: string): Promise<void> {
  if (running.has(id)) return;
  running.add(id);
  const step = (s: string) => updateDoklad(id, { status: 'zpracovava', step: s, error: undefined });
  try {
    const settings = await getSettings();
    let doc = (await getDoklad(id))!;

    if (!doc.data) {
      await step('Čtu doklad pomocí AI…');
      const apiKey = await getApiKey(settings.aiProvider);
      const model = modelFor(settings);
      const { data, usage } = await extractDoklad(settings.aiProvider, apiKey, model, await aiImageBase64(doc));
      const usd = costUsd(model, usage);
      const rate = await usdCzkRate();

      const ares = await lookupIco(data.dodavatel.ico);
      if (ares) {
        data.dodavatel.nazev = ares.nazev || data.dodavatel.nazev;
        data.dodavatel.dic = ares.dic || data.dodavatel.dic;
        data.dodavatel.adresa = ares.adresa;
        data.ares_overeno = true;
      }
      doc = (await updateDoklad(id, {
        data,
        period: periodKey(data.datum_vystaveni, settings.periodType),
        aiProvider: `${settings.aiProvider}/${model}`,
        aiUsage: {
          ...usage,
          costUsd: usd,
          costCzk: usd == null ? null : Math.round(usd * rate * 1000) / 1000,
          usdCzk: rate,
        },
      }))!;
    }

    if (!doc.driveFileId) {
      await step('Nahrávám fotku na Google Disk…');
      const f = await uploadPhoto(photoName(doc), await new File(doc.photoUri).base64());
      doc = (await updateDoklad(id, { driveFileId: f.id, driveLink: f.webViewLink }))!;
    }

    if (!doc.sheetRow) {
      await step('Zapisuji do Google tabulky…');
      const row = await appendRow(sheetRowValues(doc));
      doc = (await updateDoklad(id, { sheetRow: row }))!;
    }

    const perPhoto = settings.sendMode === 'per_photo';
    if (perPhoto && !doc.sentAt) {
      if (!settings.accountantEmail) throw new Error('Chybí e-mail účetní — doplňte ho v Nastavení.');
      await step('Odesílám účetní…');
      doc = await sendSingle(doc, settings.accountantEmail);
    }

    await updateDoklad(id, { status: 'hotovo', step: undefined, error: undefined });
    const d = doc.data!;
    const what = `${d.dodavatel?.nazev ?? 'Doklad'} · ${fmtKc(d.castka_celkem)}`;
    const check = d.pole_ke_kontrole.length ? ' Některá pole doporučujeme zkontrolovat.' : '';
    await notify(
      perPhoto ? 'Doklad zpracován a odeslán účetní ✓' : 'Doklad zpracován ✓',
      perPhoto
        ? `${what} — zapsáno do tabulky a odesláno na ${settings.accountantEmail}.${check}`
        : `${what} — zapsáno do tabulky, odešle se souhrnně za ${periodLabel(doc.period)}.${check}`,
    );
  } catch (e: any) {
    const message = String(e?.message ?? e);
    await updateDoklad(id, { status: 'chyba', step: undefined, error: message });
    await notify('Zpracování dokladu selhalo', `${message} Klepněte na doklad a zkuste to znovu.`);
  } finally {
    running.delete(id);
  }
}

/** Souhrnné odeslání: jeden e-mail za období se všemi neodeslanými doklady. */
export async function sendPeriod(period: string): Promise<number> {
  const settings = await getSettings();
  if (!settings.accountantEmail) throw new Error('Chybí e-mail účetní — doplňte ho v Nastavení.');
  const docs = (await listDoklady())
    .filter((d) => d.period === period && d.status === 'hotovo' && !d.sentAt)
    .reverse();
  if (!docs.length) return 0;
  await shareWithAccountant(settings.accountantEmail);

  const attachments = [];
  const linksOnly: Doklad[] = [];
  let bytes = 0;
  for (const doc of docs) {
    const file = new File(doc.photoUri);
    if (bytes + (file.size ?? 0) > MAX_ATTACH_BYTES) {
      linksOnly.push(doc);
      continue;
    }
    bytes += file.size ?? 0;
    attachments.push({ filename: photoName(doc), mimeType: 'image/jpeg', base64: await file.base64() });
  }
  attachments.unshift({
    filename: `doklady_${period}.csv`,
    mimeType: 'text/csv',
    base64: utf8ToBase64(buildCsv(docs)),
  });

  const total = docs.reduce((s, d) => s + (d.data?.castka_celkem ?? 0), 0);
  await sendMail({
    to: settings.accountantEmail,
    subject: `Doklady za ${periodLabel(period)} (${docs.length})`,
    text: `Dobrý den,\n\nposílám doklady za ${periodLabel(period)}: ${docs.length} ks, celkem ${fmtKc(total)}.\n` +
      'Přehled je v přiloženém CSV, fotky dokladů jsou v přílohách.\n' +
      (linksOnly.length
        ? `\nNěkteré fotky se nevešly do přílohy, jsou na Google Disku:\n${linksOnly.map((d) => `- ${d.data?.dodavatel?.nazev ?? d.id}: ${d.driveLink}`).join('\n')}\n`
        : '') +
      '\nOdesláno z aplikace Účtenkomat.',
    attachments,
  });

  const sentAt = new Date().toISOString();
  for (const doc of docs) {
    const updated = (await updateDoklad(doc.id, { sentAt }))!;
    if (updated.sheetRow) await updateRow(updated.sheetRow, sheetRowValues(updated)).catch(() => undefined);
  }
  await notify('Doklady odeslány účetní ✓', `${docs.length} dokladů za ${periodLabel(period)} odesláno na ${settings.accountantEmail}.`);
  return docs.length;
}
