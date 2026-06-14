// SPAYD (QR Platba) parser. Viz docs/spayd.md
// TODO: dekódování QR z obrázku (jimp + jsqr). Teď parsujeme jen řetězec.

/**
 * Naparsuje SPAYD řetězec na objekt s klíči.
 * @param {string} raw  např. "SPD*1.0*ACC:CZ55...*AM:1250.00*X-VS:123"
 * @returns {{acc?:string,am?:number,cc?:string,vs?:string,msg?:string}|null}
 */
export function parseSpayd(raw) {
  if (!raw || !raw.startsWith('SPD*')) return null;

  const parts = raw.split('*').slice(2); // přeskoč "SPD" a verzi
  const map = {};
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    map[part.slice(0, idx)] = part.slice(idx + 1);
  }

  return {
    acc: map.ACC,
    am: map.AM ? Number(map.AM) : undefined,
    cc: map.CC,
    vs: map['X-VS'],
    msg: map.MSG,
  };
}
