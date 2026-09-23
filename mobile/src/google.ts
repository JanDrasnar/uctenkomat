// Google účet uživatele: přihlášení, Drive (fotky), Sheets (záznamy), Gmail
// (odeslání účetní). Každý uživatel má vlastní tabulku a složku ve svém Disku.
//
// Scopes:
//  - drive.file  → aplikace vidí jen soubory, které sama vytvořila (složka,
//                  fotky, tabulka). Pokrývá i Sheets API pro tuto tabulku.
//  - gmail.send  → odeslání e-mailu účetní z adresy uživatele.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { buildMime, type MailAttachment } from './encoding';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
];

const FOLDER_NAME = 'Účtenkomat';
const SHEET_TITLE = 'Účtenkomat – doklady';
const SHEET_TAB = 'Doklady';

export function configureGoogle() {
  GoogleSignin.configure({ scopes: GOOGLE_SCOPES });
}

export async function signInGoogle(): Promise<string | null> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const r = await GoogleSignin.signIn();
  return isSuccessResponse(r) ? r.data.user.email : null;
}

export async function signInGoogleSilently(): Promise<string | null> {
  try {
    const r = await GoogleSignin.signInSilently();
    return r.type === 'success' ? r.data.user.email : null;
  } catch {
    return null;
  }
}

export async function signOutGoogle() {
  await GoogleSignin.signOut();
}

export function currentGoogleEmail(): string | null {
  return GoogleSignin.getCurrentUser()?.user.email ?? null;
}

// ---------------------------------------------------------------------------
// HTTP s access tokenem (při 401 zahodí token z cache a zkusí to znovu)

async function accessToken(): Promise<string> {
  if (!GoogleSignin.getCurrentUser()) {
    const email = await signInGoogleSilently();
    if (!email) throw new Error('Nejste přihlášeni ke Google účtu — přihlaste se v Nastavení.');
  }
  return (await GoogleSignin.getTokens()).accessToken;
}

class GoogleApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function gfetch(url: string, init: RequestInit = {}): Promise<any> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await accessToken();
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 && attempt === 0) {
      await GoogleSignin.clearCachedAccessToken(token);
      continue;
    }
    const text = await res.text();
    if (!res.ok) {
      let msg = text;
      try {
        msg = JSON.parse(text).error?.message ?? text;
      } catch {
        // není JSON
      }
      throw new GoogleApiError(res.status, `Google ${res.status}: ${String(msg).slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : null;
  }
}

// ---------------------------------------------------------------------------
// Složka + tabulka (vytvoří se při prvním dokladu, pamatuje se per účet)

interface GoogleSetup {
  folderId: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  /** E-maily, se kterými už je složka sdílená (účetní). */
  sharedWith?: string[];
}

export const SHEET_HEADER = [
  'ID', 'Přidáno', 'Typ', 'Datum vystavení / DUZP', 'Splatnost', 'Číslo dokladu',
  'Dodavatel', 'IČO', 'DIČ', 'Adresa', 'VS', 'Měna',
  'Základ 21 %', 'DPH 21 %', 'Základ 12 %', 'DPH 12 %', 'Základ 0 %',
  'Celkem', 'Ke kontrole', 'ARES ověřeno', 'Foto', 'Odesláno účetní', 'Období', 'AI',
];

function columnLetter(n: number): string {
  let s = '';
  for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}
const LAST_COL = columnLetter(SHEET_HEADER.length);

const setupKey = (email: string) => `uctenkomat.google.${email}`;
let setupPromise: Promise<GoogleSetup> | null = null;

export async function getSetup(): Promise<GoogleSetup | null> {
  const email = currentGoogleEmail();
  if (!email) return null;
  const raw = await AsyncStorage.getItem(setupKey(email));
  return raw ? JSON.parse(raw) : null;
}

async function createSetup(): Promise<GoogleSetup> {
  const folder = await gfetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });

  const sheet = await gfetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: SHEET_TITLE, locale: 'cs_CZ' },
      sheets: [{
        properties: { title: SHEET_TAB, gridProperties: { frozenRowCount: 1 } },
        data: [{
          startRow: 0,
          startColumn: 0,
          rowData: [{
            values: SHEET_HEADER.map((h) => ({
              userEnteredValue: { stringValue: h },
              userEnteredFormat: { textFormat: { bold: true } },
            })),
          }],
        }],
      }],
    }),
  });

  // Přesuň tabulku do složky Účtenkomat (není kritické, když selže).
  try {
    await gfetch(
      `https://www.googleapis.com/drive/v3/files/${sheet.spreadsheetId}?addParents=${folder.id}&removeParents=root&fields=id`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    );
  } catch {
    // nevadí — tabulka zůstane v kořeni Disku
  }

  return { folderId: folder.id, spreadsheetId: sheet.spreadsheetId, spreadsheetUrl: sheet.spreadsheetUrl };
}

/** Vrátí složku + tabulku; při prvním použití je vytvoří. Souběžná volání sdílí jedno vytvoření. */
export async function ensureSetup(): Promise<GoogleSetup> {
  const existing = await getSetup();
  if (existing) return existing;
  if (!setupPromise) {
    setupPromise = (async () => {
      const s = await createSetup();
      await storeSetup(s);
      return s;
    })().finally(() => {
      setupPromise = null;
    });
  }
  return setupPromise;
}

async function storeSetup(s: GoogleSetup) {
  const email = currentGoogleEmail();
  if (email) await AsyncStorage.setItem(setupKey(email), JSON.stringify(s));
}

async function forgetSetup() {
  const email = currentGoogleEmail();
  if (email) await AsyncStorage.removeItem(setupKey(email));
}

/** Když uživatel tabulku/složku smazal (404), založí nové a zopakuje akci. */
async function withSetup<T>(fn: (s: GoogleSetup) => Promise<T>): Promise<T> {
  try {
    return await fn(await ensureSetup());
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 404) {
      await forgetSetup();
      return fn(await ensureSetup());
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Drive

export async function uploadPhoto(
  name: string, jpegBase64: string,
): Promise<{ id: string; webViewLink: string }> {
  return withSetup(async (s) => {
    const boundary = `uctenkomat_${Date.now().toString(36)}`;
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name, parents: [s.folderId], mimeType: 'image/jpeg' }),
      `--${boundary}`,
      'Content-Type: image/jpeg',
      'Content-Transfer-Encoding: base64',
      '',
      jpegBase64,
      `--${boundary}--`,
      '',
    ].join('\r\n');
    return gfetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
    );
  });
}

/**
 * Nasdílí složku Účtenkomat (fotky + tabulka) účetní jen pro čtení, aby jí
 * fungovaly odkazy na fotky z tabulky i z e-mailu. Každou adresu jen jednou.
 */
export async function shareFolderWith(accountantEmail: string): Promise<void> {
  const email = accountantEmail.trim().toLowerCase();
  if (!email) return;
  await withSetup(async (s) => {
    if (s.sharedWith?.includes(email)) return;
    await gfetch(
      `https://www.googleapis.com/drive/v3/files/${s.folderId}/permissions` +
        `?sendNotificationEmail=true&emailMessage=${encodeURIComponent('Sdílím s vámi složku s doklady z aplikace Účtenkomat.')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: email }),
      },
    );
    await storeSetup({ ...s, sharedWith: [...(s.sharedWith ?? []), email] });
  });
}

// ---------------------------------------------------------------------------
// Sheets

export type SheetCell = string | number | boolean | null;

/** Přidá řádek a vrátí jeho číslo. */
export async function appendRow(values: SheetCell[]): Promise<number> {
  return withSetup(async (s) => {
    const r = await gfetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${s.spreadsheetId}/values/${encodeURIComponent(`${SHEET_TAB}!A1:${LAST_COL}1`)}:append` +
        '?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [values.map((v) => v ?? '')] }),
      },
    );
    // např. "Doklady!A5:X5"
    const m = String(r.updates?.updatedRange ?? '').match(/![A-Z]+(\d+)/);
    if (!m) throw new Error('Nepodařilo se zjistit číslo řádku v tabulce.');
    return Number(m[1]);
  });
}

/** Přepíše celý řádek (po opravě údajů nebo po odeslání účetní). */
export async function updateRow(row: number, values: SheetCell[]): Promise<void> {
  const s = await ensureSetup();
  await gfetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${s.spreadsheetId}/values/${encodeURIComponent(`${SHEET_TAB}!A${row}:${LAST_COL}${row}`)}` +
      '?valueInputOption=USER_ENTERED',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [values.map((v) => v ?? '')] }),
    },
  );
}

// ---------------------------------------------------------------------------
// Gmail — odešle se z účtu uživatele, účetní tedy vidí jeho adresu a může odpovědět.

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  attachments: MailAttachment[];
}): Promise<void> {
  await gfetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media', {
    method: 'POST',
    headers: { 'Content-Type': 'message/rfc822' },
    body: buildMime(opts),
  });
}
