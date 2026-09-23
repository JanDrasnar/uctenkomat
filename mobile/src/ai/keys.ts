// Návody pro získání API klíče, rozpoznání poskytovatele z klíče a ověření,
// že klíč opravdu funguje (včetně kreditu na účtu). Texty jsou psané pro
// netechnické uživatele — žádné „tokeny“ ani „endpointy“.
import type { AiProvider } from '../settings';

export interface ProviderGuide {
  id: AiProvider;
  name: string;
  tagline: string;
  price: string;
  badge?: string;
  keyUrl: string;
  keyUrlLabel: string;
  billingUrl?: string;
  billingLabel?: string;
  steps: string[];
}

export const PROVIDER_GUIDES: ProviderGuide[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    tagline: 'Nejjednodušší — stačí váš Google účet, bez platební karty.',
    price: 'Zdarma v rámci denního limitu, na běžné množství dokladů stačí.',
    badge: 'Doporučeno pro začátek',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyUrlLabel: 'Otevřít Google AI Studio',
    steps: [
      'Klepněte na „Otevřít Google AI Studio“ níže. Otevře se prohlížeč — přihlaste se stejným Google účtem.',
      'Pokud se objeví podmínky použití, zaškrtněte souhlas a pokračujte.',
      'Klepněte na modré tlačítko „Create API key“ (Vytvořit klíč) a potvrďte.',
      'U nového klíče klepněte na ikonu kopírování (dva čtverečky).',
      'Vraťte se sem do aplikace a klepněte na „Vložit zkopírovaný klíč“.',
    ],
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    tagline: 'Nejpřesnější čtení i u špatně čitelných účtenek.',
    price: 'Placené předem kreditem (min. 5 USD); jeden doklad stojí zlomek koruny.',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyUrlLabel: 'Otevřít stránku s klíči',
    billingUrl: 'https://console.anthropic.com/settings/billing',
    billingLabel: 'Otevřít dobití kreditu',
    steps: [
      'Klepněte na „Otevřít dobití kreditu“ níže a zaregistrujte se (e-mailem nebo Google účtem).',
      'Na stránce Billing přidejte platební kartu a dobijte kredit (stačí 5 USD).',
      'Klepněte na „Otevřít stránku s klíči“ a potom na „Create Key“. Jako název napište Účtenkomat.',
      'Klepněte na „Copy“. Pozor — klíč se zobrazí jen jednou.',
      'Vraťte se sem a klepněte na „Vložit zkopírovaný klíč“.',
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    tagline: 'Pokud už máte účet u OpenAI.',
    price: 'Placené předem kreditem (min. 5 USD). Předplatné ChatGPT Plus se nepočítá.',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyUrlLabel: 'Otevřít stránku s klíči',
    billingUrl: 'https://platform.openai.com/settings/organization/billing/overview',
    billingLabel: 'Otevřít dobití kreditu',
    steps: [
      'Klepněte na „Otevřít dobití kreditu“ níže a přihlaste se (stejný účet jako do ChatGPT).',
      'Klepněte na „Add payment details“, přidejte kartu a dobijte kredit (stačí 5 USD).',
      'Klepněte na „Otevřít stránku s klíči“ a potom na „Create new secret key“. Název: Účtenkomat.',
      'Klepněte na „Copy“. Pozor — klíč se zobrazí jen jednou.',
      'Vraťte se sem a klepněte na „Vložit zkopírovaný klíč“.',
    ],
  },
];

export function guideFor(p: AiProvider): ProviderGuide {
  return PROVIDER_GUIDES.find((g) => g.id === p)!;
}

/** Podle začátku klíče pozná, ke komu patří (uživatel často vybere špatnou kartu). */
export function detectProvider(key: string): AiProvider | null {
  const k = key.trim();
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('AIza')) return 'gemini';
  if (k.startsWith('sk-')) return 'openai';
  return null;
}

/** Očistí vložený text (mezery, uvozovky, zalomení řádku z kopírování). */
export function cleanKey(raw: string): string {
  return raw.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, '');
}

export type KeyCheck = { ok: true } | { ok: false; message: string };

function friendly(status: number, body: string, g: ProviderGuide): string {
  const b = body.toLowerCase();
  if (status === 401 || status === 403 || b.includes('api key not valid') || b.includes('invalid x-api-key')) {
    return 'Klíč není platný. Zkontrolujte, že jste zkopírovali celý klíč, případně vytvořte nový.';
  }
  if (b.includes('credit balance') || b.includes('insufficient_quota') || b.includes('billing')) {
    return `Klíč je v pořádku, ale na účtu ${g.name} chybí kredit. Dobijte ho a zkuste to znovu.`;
  }
  if (status === 429) {
    return 'Služba je právě přetížená nebo jste vyčerpali limit. Zkuste to za chvíli.';
  }
  if (status === 404) {
    return 'Zvolený model neexistuje. V Nastavení nechte pole Model prázdné (použije se výchozí).';
  }
  return `Ověření se nepovedlo (${status}). ${body.slice(0, 160)}`;
}

/**
 * Pošle minimální požadavek (pár tokenů, prakticky zdarma). Ověří tak klíč,
 * kredit na účtu i název modelu najednou.
 */
export async function checkApiKey(provider: AiProvider, key: string, model: string): Promise<KeyCheck> {
  const g = guideFor(provider);
  let res: Response;
  try {
    if (provider === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }),
      });
    } else if (provider === 'openai') {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, max_completion_tokens: 16, messages: [{ role: 'user', content: 'ok' }] }),
      });
    } else {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'ok' }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        },
      );
    }
  } catch {
    return { ok: false, message: 'Nepodařilo se spojit se službou. Zkontrolujte připojení k internetu.' };
  }
  if (res.ok) return { ok: true };
  return { ok: false, message: friendly(res.status, await res.text(), g) };
}
