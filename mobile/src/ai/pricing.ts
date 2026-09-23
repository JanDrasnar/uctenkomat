// Ceník AI modelů (USD za 1 milion tokenů) a přepočet na Kč kurzem ČNB.
// Ceny se mění — při změně stačí upravit tabulku. Neznámý model = cena se
// nespočítá, zobrazí se jen tokeny.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AiUsage } from './extract';

interface Price { input: number; output: number }

// Delší prefix má přednost (např. claude-opus-5-5 před claude-opus-5).
const PRICES: [prefix: string, price: Price][] = [
  // Anthropic
  ['claude-fable-5', { input: 10, output: 50 }],
  ['claude-opus-5-5', { input: 4, output: 20 }],
  ['claude-opus-5', { input: 5, output: 25 }],
  ['claude-opus-4', { input: 5, output: 25 }],
  ['claude-sonnet-5', { input: 2, output: 10 }],
  ['claude-sonnet-4', { input: 3, output: 15 }],
  ['claude-haiku-4-5', { input: 1, output: 5 }],
  // Google (placená úroveň; na free tieru je zdarma)
  ['gemini-2.5-flash-lite', { input: 0.1, output: 0.4 }],
  ['gemini-2.5-flash', { input: 0.3, output: 2.5 }],
  ['gemini-2.5-pro', { input: 1.25, output: 10 }],
  // OpenAI
  ['gpt-5-nano', { input: 0.05, output: 0.4 }],
  ['gpt-5-mini', { input: 0.25, output: 2 }],
  ['gpt-5', { input: 1.25, output: 10 }],
  ['gpt-4.1-mini', { input: 0.4, output: 1.6 }],
  ['gpt-4.1', { input: 2, output: 8 }],
];

function priceFor(model: string): Price | null {
  const m = model.toLowerCase();
  let best: [string, Price] | null = null;
  for (const entry of PRICES) {
    if (m.startsWith(entry[0]) && (!best || entry[0].length > best[0].length)) best = entry;
  }
  return best ? best[1] : null;
}

export function costUsd(model: string, usage: AiUsage): number | null {
  const p = priceFor(model);
  if (!p) return null;
  return (usage.inputTokens * p.input + usage.outputTokens * p.output) / 1_000_000;
}

// ---------------------------------------------------------------------------
// Kurz USD/CZK z denního kurzovního lístku ČNB (veřejný, bez registrace),
// uložený na den. Když ČNB není dostupná, použije se poslední známý kurz.

const CNB_URL =
  'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt';
const RATE_KEY = 'uctenkomat.kurzUsd';
const FALLBACK_RATE = 23;

/** Z lístku typu „USA|dolar|1|USD|22,845“ vytáhne kurz za 1 USD. */
export function parseCnbUsd(text: string): number | null {
  for (const line of text.split('\n')) {
    const cols = line.trim().split('|');
    if (cols[3] === 'USD') {
      const amount = Number(cols[2]);
      const rate = Number(cols[4]?.replace(',', '.'));
      if (amount > 0 && rate > 0) return rate / amount;
    }
  }
  return null;
}

export async function usdCzkRate(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  let cached: { date: string; rate: number } | null = null;
  try {
    cached = JSON.parse((await AsyncStorage.getItem(RATE_KEY)) ?? 'null');
  } catch {
    cached = null;
  }
  if (cached?.date === today) return cached.rate;
  try {
    const res = await fetch(CNB_URL);
    const rate = res.ok ? parseCnbUsd(await res.text()) : null;
    if (rate) {
      await AsyncStorage.setItem(RATE_KEY, JSON.stringify({ date: today, rate }));
      return rate;
    }
  } catch {
    // offline — použij poslední známý kurz
  }
  return cached?.rate ?? FALLBACK_RATE;
}

/** 0.3123 → „0,31 Kč“; malé částky s víc desetinnými místy. */
export function fmtCzkSmall(czk: number | null | undefined): string {
  if (czk == null) return '—';
  const digits = czk < 0.1 ? 3 : 2;
  return `${czk.toLocaleString('cs-CZ', { minimumFractionDigits: digits, maximumFractionDigits: digits })} Kč`;
}
