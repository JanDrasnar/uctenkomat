// Jednoduché trvalé úložiště pro MVP: metadata v data/db.json, obrázky v uploads/.
// TODO: nahradit databází + S3.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export const UPLOADS_DIR = path.join(ROOT, 'uploads');
export const EXPORTS_DIR = path.join(ROOT, 'exports');

for (const dir of [DATA_DIR, UPLOADS_DIR, EXPORTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function load() {
  if (!fs.existsSync(DB_FILE)) return { documents: [], sentPeriods: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function save(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

export function addDocument(doc) {
  const db = load();
  db.documents.push(doc);
  save(db);
  return doc;
}

export function updateDocument(id, patch) {
  const db = load();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) return null;
  Object.assign(doc, patch);
  save(db);
  return doc;
}

export function getDocument(id) {
  return load().documents.find((d) => d.id === id) ?? null;
}

export function listByPeriod(period) {
  return load().documents.filter((d) => d.period === period);
}

export function listPeriods() {
  const db = load();
  const map = new Map();
  for (const d of db.documents) {
    const entry = map.get(d.period) ?? { period: d.period, count: 0, total: 0 };
    entry.count += 1;
    entry.total += d.data?.castka_celkem ?? 0;
    map.set(d.period, entry);
  }
  return [...map.values()].map((e) => ({
    ...e,
    sent: db.sentPeriods.includes(e.period),
  }));
}

export function markPeriodSent(period) {
  const db = load();
  if (!db.sentPeriods.includes(period)) db.sentPeriods.push(period);
  save(db);
}
