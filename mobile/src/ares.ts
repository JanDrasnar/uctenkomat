// ARES — veřejný registr ekonomických subjektů (MF ČR). Bez autentizace.
// Viz docs/ares.md

const ARES_BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';

export interface AresSubjekt {
  ico: string;
  nazev: string | null;
  adresa: string | null;
  dic: string | null;
}

/** Ověří IČO v ARES; null pokud subjekt neexistuje nebo ARES nedostupný. */
export async function lookupIco(ico: string | null | undefined): Promise<AresSubjekt | null> {
  if (!ico || !/^\d{8}$/.test(ico)) return null;
  try {
    const res = await fetch(`${ARES_BASE}/${ico}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ico: data.ico,
      nazev: data.obchodniJmeno ?? null,
      adresa: data.sidlo?.textovaAdresa ?? null,
      dic: data.dic ?? null,
    };
  } catch {
    return null;
  }
}
