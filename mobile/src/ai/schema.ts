// Extrakční schéma a prompt — sdílené všemi AI poskytovateli, aby výstup měl
// vždy stejný tvar. Referenční kopie: docs/extraction-schema.json.

type Json = Record<string, any>;

export const DOKLAD_SCHEMA: Json = {
  type: 'object',
  properties: {
    typ_dokladu: {
      type: 'string',
      enum: ['faktura', 'paragon', 'neurceno'],
      description: 'Faktura má obvykle IČO, splatnost, VS. Paragon je účtenka z prodejny.',
    },
    dodavatel: {
      type: 'object',
      properties: {
        nazev: { type: ['string', 'null'] },
        ico: { type: ['string', 'null'], description: 'Přesně 8 číslic, bez mezer. null pokud nečitelné.' },
        dic: { type: ['string', 'null'], description: 'Formát CZ + číslice, např. CZ12345678. null pokud chybí.' },
      },
      required: ['nazev', 'ico', 'dic'],
    },
    datum_vystaveni: {
      type: ['string', 'null'],
      description: 'ISO formát YYYY-MM-DD. Toto datum určuje účetní období.',
    },
    datum_splatnosti: { type: ['string', 'null'], description: 'ISO YYYY-MM-DD. Obvykle jen u faktur.' },
    cislo_dokladu: { type: ['string', 'null'], description: 'Číslo faktury / účtenky.' },
    variabilni_symbol: { type: ['string', 'null'] },
    mena: {
      type: 'string',
      enum: ['CZK', 'EUR', 'USD', 'jine'],
      description: 'Pokud není uvedeno, předpokládej CZK.',
    },
    castka_celkem: { type: ['number', 'null'], description: 'Celková částka k úhradě včetně DPH.' },
    dph_rozpis: {
      type: 'array',
      description: 'Rozpis DPH po sazbách. Prázdné pole pokud doklad není daňový nebo není čitelné.',
      items: {
        type: 'object',
        properties: {
          sazba: { type: 'number', description: 'Sazba v procentech: 21, 12 nebo 0.' },
          zaklad: { type: 'number' },
          dph: { type: 'number' },
        },
        required: ['sazba', 'zaklad', 'dph'],
      },
    },
    qr_platba_nalezena: { type: 'boolean', description: 'True pokud je na dokladu QR Platba (SPAYD) kód.' },
    pole_ke_kontrole: {
      type: 'array',
      items: { type: 'string' },
      description: "Názvy polí, kde si nejsi jistý čitelností. Např. ['castka_celkem','ico'].",
    },
    poznamka_extrakce: {
      type: ['string', 'null'],
      description: 'Krátká poznámka pokud je doklad rozmazaný, oříznutý apod.',
    },
  },
  required: [
    'typ_dokladu', 'dodavatel', 'datum_vystaveni', 'mena', 'castka_celkem',
    'dph_rozpis', 'qr_platba_nalezena', 'pole_ke_kontrole',
  ],
};

export const SYSTEM_PROMPT = `Jsi asistent pro zpracování českých účetních dokladů — faktur a paragonů (účtenek).
Z přiloženého obrázku přečteš údaje a vrátíš je ve strukturované podobě podle schématu.

Zásady:
- Pokud údaj nedokážeš spolehlivě přečíst, vrať null — NEHÁDEJ. Raději null než vymyšlená hodnota.
- Každé pole, u kterého si nejsi jistý čitelností, přidej do \`pole_ke_kontrole\`.
- Datumy převeď do formátu YYYY-MM-DD. Český formát je obvykle DD.MM.YYYY.
- Částky vracej jako čísla bez měny a bez mezer (1 250,50 → 1250.50). Desetinný oddělovač v ČR je čárka — převeď na tečku.
- IČO má přesně 8 číslic. Pokud čteš jiný počet, dej ico=null a přidej do kontroly.
- Platné sazby DPH v ČR od roku 2024: 21 %, 12 %, 0 %. Sazby 15 % a 10 % už neplatí — pokud je vidíš na starším dokladu, přečti je tak jak jsou.
- Pokud je na dokladu QR Platba (SPAYD), nastav qr_platba_nalezena=true.
- DUZP (datum uskutečnění zdanitelného plnění), pokud je uvedeno odlišně od data vystavení, použij pro datum_vystaveni hodnotu DUZP — je rozhodující pro DPH.`;

/** OpenAI strict mode: všechna pole required + additionalProperties:false. */
export function toOpenAiStrict(schema: Json): Json {
  if (schema.type === 'object' || (Array.isArray(schema.type) && schema.type.includes('object'))) {
    const props: Json = {};
    for (const [k, v] of Object.entries(schema.properties ?? {})) props[k] = toOpenAiStrict(v as Json);
    return { ...schema, properties: props, required: Object.keys(props), additionalProperties: false };
  }
  if (schema.type === 'array') return { ...schema, items: toOpenAiStrict(schema.items) };
  return schema;
}

/** Gemini: podmnožina OpenAPI — místo ['string','null'] používá nullable. */
export function toGeminiSchema(schema: Json): Json {
  const out: Json = {};
  let type = schema.type;
  if (Array.isArray(type)) {
    out.nullable = type.includes('null');
    type = type.find((t: string) => t !== 'null');
  }
  out.type = String(type).toUpperCase();
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.properties) {
    out.properties = {};
    for (const [k, v] of Object.entries(schema.properties)) out.properties[k] = toGeminiSchema(v as Json);
    out.propertyOrdering = Object.keys(schema.properties);
  }
  if (schema.required) out.required = schema.required;
  if (schema.items) out.items = toGeminiSchema(schema.items);
  return out;
}
