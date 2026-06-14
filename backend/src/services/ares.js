// ARES — veřejný registr ekonomických subjektů (MF ČR). Bez autentizace.
// Viz docs/ares.md

const ARES_BASE =
  'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';

/**
 * Ověří IČO v ARES a vrátí oficiální údaje, nebo null pokud subjekt neexistuje.
 * @param {string|null} ico
 * @returns {Promise<{ico:string,nazev:string,adresa:string,dic:string|null}|null>}
 */
export async function lookupIco(ico) {
  if (!ico || !/^\d{8}$/.test(ico)) return null;

  try {
    const res = await fetch(`${ARES_BASE}/${ico}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ico: data.ico,
      nazev: data.obchodniJmeno ?? null,
      adresa: data.sidlo?.textovaAdresa ?? null,
      dic: data.dic ?? null,
    };
  } catch {
    // ARES nedostupný — nevadí, jen nepotvrdíme
    return null;
  }
}
