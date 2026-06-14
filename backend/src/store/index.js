// Fasáda úložiště: vybere Postgres (když je DATABASE_URL), jinak JSON soubor.
// Veřejné API je async a stejné pro oba backendy.

import * as jsonStore from './json.js';
import { UPLOADS_DIR, EXPORTS_DIR } from '../paths.js';

const usePg = !!process.env.DATABASE_URL;
const impl = usePg ? await import('./pg.js') : jsonStore;

export const STORE_KIND = usePg ? 'postgres' : 'json';
export { UPLOADS_DIR, EXPORTS_DIR };

export const init = impl.init;
export const addDocument = impl.addDocument;
export const updateDocument = impl.updateDocument;
export const getDocument = impl.getDocument;
export const listByPeriod = impl.listByPeriod;
export const listPeriods = impl.listPeriods;
export const markPeriodSent = impl.markPeriodSent;
