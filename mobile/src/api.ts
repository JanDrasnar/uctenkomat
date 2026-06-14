import type { Doklad, PeriodSummary } from './types';

// Produkční backend na Railway. Pro lokální vývoj přepiš na IP adresu počítače
// s backendem (např. 'http://192.168.1.10:3000') — localhost funguje jen v simulátoru/webu.
export const API_BASE_URL = 'https://uctenkomat-production.up.railway.app';

/** Nahraje fotku dokladu, backend ji extrahuje a vrátí rozpoznaný doklad. */
export async function uploadDoklad(imageUri: string): Promise<Doklad> {
  const form = new FormData();
  const name = imageUri.split('/').pop() || 'doklad.jpg';
  // React Native FormData přijímá { uri, name, type }
  form.append('photo', { uri: imageUri, name, type: 'image/jpeg' } as any);

  const res = await fetch(`${API_BASE_URL}/api/documents`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`Nahrání selhalo (${res.status})`);
  return res.json();
}

/** Uloží opravy z kontrolní obrazovky. */
export async function saveDoklad(id: string, data: Doklad['data']): Promise<Doklad> {
  const res = await fetch(`${API_BASE_URL}/api/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, reviewed: true }),
  });
  if (!res.ok) throw new Error(`Uložení selhalo (${res.status})`);
  return res.json();
}

export async function getPeriods(): Promise<PeriodSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/periods`);
  if (!res.ok) throw new Error('Nepodařilo se načíst období');
  return res.json();
}

export async function getPeriod(period: string): Promise<{ period: string; label: string; documents: Doklad[] }> {
  const res = await fetch(`${API_BASE_URL}/api/periods/${period}`);
  if (!res.ok) throw new Error('Nepodařilo se načíst období');
  return res.json();
}

export async function sendPeriod(period: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/periods/${period}/send`, { method: 'POST' });
  if (!res.ok) throw new Error('Odeslání selhalo');
  return res.json();
}
