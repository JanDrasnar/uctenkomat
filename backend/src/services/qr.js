// Dekódování QR Platby (SPAYD) přímo z fotky dokladu.
// jimp načte pixely, jsqr v nich najde QR kód, parseSpayd ho rozparsuje.

import { Jimp } from 'jimp';
import jsQR from 'jsqr';
import { parseSpayd } from './spayd.js';

/**
 * Pokusí se najít a naparsovat QR Platbu v obrázku.
 * @param {Buffer} imageBuffer
 * @returns {Promise<{acc?:string,am?:number,cc?:string,vs?:string,msg?:string}|null>}
 */
export async function decodeSpaydFromImage(imageBuffer) {
  try {
    const image = await Jimp.read(imageBuffer);
    const { data, width, height } = image.bitmap;
    const code = jsQR(new Uint8ClampedArray(data), width, height);
    if (!code) return null;
    return parseSpayd(code.data); // null pokud QR není SPAYD (např. jiný QR)
  } catch {
    return null;
  }
}
