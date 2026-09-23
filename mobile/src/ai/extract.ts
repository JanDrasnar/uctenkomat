// Extrakce údajů z fotky dokladu — volá AI přímo z telefonu s klíčem
// uživatele. Každý poskytovatel dostane stejné schéma (DOKLAD_SCHEMA).
import type { DokladData } from '../types';
import type { AiProvider } from '../settings';
import { DOKLAD_SCHEMA, SYSTEM_PROMPT, toGeminiSchema, toOpenAiStrict } from './schema';

const USER_TEXT = 'Zpracuj tento doklad.';

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.error?.message ?? j.message ?? text;
    } catch {
      // není JSON — necháme text
    }
    throw new Error(`AI chyba ${res.status}: ${String(msg).slice(0, 300)}`);
  }
  return JSON.parse(text);
}

async function anthropic(apiKey: string, model: string, b64: string): Promise<unknown> {
  const msg = await postJson(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    {
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [{
        name: 'ulozit_doklad',
        description: 'Uloží strukturovaná data z účetního dokladu (faktura nebo paragon).',
        input_schema: DOKLAD_SCHEMA,
      }],
      tool_choice: { type: 'tool', name: 'ulozit_doklad' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
          { type: 'text', text: USER_TEXT },
        ],
      }],
    },
  );
  const toolUse = msg.content?.find((c: any) => c.type === 'tool_use');
  if (!toolUse) throw new Error('Claude nevrátil strukturovaná data.');
  return toolUse.input;
}

async function openai(apiKey: string, model: string, b64: string): Promise<unknown> {
  const r = await postJson(
    'https://api.openai.com/v1/chat/completions',
    { Authorization: `Bearer ${apiKey}` },
    {
      model,
      max_completion_tokens: 8000,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'doklad', strict: true, schema: toOpenAiStrict(DOKLAD_SCHEMA) },
      },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' } },
            { type: 'text', text: USER_TEXT },
          ],
        },
      ],
    },
  );
  const content = r.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI nevrátil data.');
  return JSON.parse(content);
}

async function gemini(apiKey: string, model: string, b64: string): Promise<unknown> {
  const r = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': apiKey },
    {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [{ inline_data: { mime_type: 'image/jpeg', data: b64 } }, { text: USER_TEXT }],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(DOKLAD_SCHEMA),
      },
    },
  );
  const text = r.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('');
  if (!text) throw new Error('Gemini nevrátil data.');
  return JSON.parse(text);
}

/** Doplní chybějící pole, aby zbytek aplikace mohl počítat s pevným tvarem. */
function normalize(raw: any): DokladData {
  const d = raw ?? {};
  return {
    typ_dokladu: d.typ_dokladu ?? 'neurceno',
    dodavatel: {
      nazev: d.dodavatel?.nazev ?? null,
      ico: d.dodavatel?.ico ? String(d.dodavatel.ico).replace(/\s/g, '') : null,
      dic: d.dodavatel?.dic ?? null,
    },
    datum_vystaveni: d.datum_vystaveni ?? null,
    datum_splatnosti: d.datum_splatnosti ?? null,
    cislo_dokladu: d.cislo_dokladu ?? null,
    variabilni_symbol: d.variabilni_symbol ?? null,
    mena: d.mena ?? 'CZK',
    castka_celkem: typeof d.castka_celkem === 'number' ? d.castka_celkem : null,
    dph_rozpis: Array.isArray(d.dph_rozpis) ? d.dph_rozpis : [],
    qr_platba_nalezena: !!d.qr_platba_nalezena,
    pole_ke_kontrole: Array.isArray(d.pole_ke_kontrole) ? d.pole_ke_kontrole : [],
    poznamka_extrakce: d.poznamka_extrakce ?? null,
  };
}

/**
 * Přečte údaje z fotky dokladu.
 * @param jpegBase64  zmenšená JPEG fotka v base64 (bez data: prefixu)
 */
export async function extractDoklad(
  provider: AiProvider, apiKey: string, model: string, jpegBase64: string,
): Promise<DokladData> {
  if (!apiKey) throw new Error('Chybí API klíč pro AI — doplňte ho v Nastavení.');
  const call = { anthropic, openai, gemini }[provider];
  return normalize(await call(apiKey, model, jpegBase64));
}
