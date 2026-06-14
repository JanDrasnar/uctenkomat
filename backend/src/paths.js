import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const DATA_DIR = path.join(ROOT, 'data');
export const UPLOADS_DIR = path.join(ROOT, 'uploads');
export const EXPORTS_DIR = path.join(ROOT, 'exports');

for (const dir of [DATA_DIR, UPLOADS_DIR, EXPORTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}
