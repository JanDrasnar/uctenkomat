// JSON úložiště (zero-config fallback pro vývoj a testování na telefonu).
// Metadata v data/db.json, obrázky na disku v uploads/.

import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../paths.js';

const DB_FILE = path.join(DATA_DIR, 'db.json');

function load() {
  if (!fs.existsSync(DB_FILE)) return { documents: [], sentPeriods: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function save(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

export async function init() {
  if (!fs.existsSync(DB_FILE)) save({ documents: [], sentPeriods: [] });
}

export async function addDocument(doc) {
  const db = load();
  db.documents.push(doc);
  save(db);
  return doc;
}

export async function updateDocument(id, patch) {
  const db = load();
  const doc = db.documents.find((d) => d.id === id);
  if (!doc) return null;
  Object.assign(doc, patch);
  save(db);
  return doc;
}

export async function getDocument(id) {
  return load().documents.find((d) => d.id === id) ?? null;
}

export async function listByPeriod(period) {
  return load().documents.filter((d) => d.period === period);
}

export async function listPeriods() {
  const db = load();
  const map = new Map();
  for (const d of db.documents) {
    const entry = map.get(d.period) ?? { period: d.period, count: 0, total: 0 };
    entry.count += 1;
    entry.total += d.data?.castka_celkem ?? 0;
    map.set(d.period, entry);
  }
  return [...map.values()].map((e) => ({ ...e, sent: db.sentPeriods.includes(e.period) }));
}

export async function markPeriodSent(period) {
  const db = load();
  if (!db.sentPeriods.includes(period)) db.sentPeriods.push(period);
  save(db);
}
