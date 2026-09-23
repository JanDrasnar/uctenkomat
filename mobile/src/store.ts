// Lokální seznam dokladů (AsyncStorage) s jednoduchým odběrem změn pro UI.
// Zápisy jsou serializované, protože souběžně může běžet víc zpracování.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Doklad } from './types';

const KEY = 'uctenkomat.doklady';
let cache: Doklad[] | null = null;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<(docs: Doklad[]) => void>();

async function load(): Promise<Doklad[]> {
  if (!cache) {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : [];
  }
  return cache!;
}

function mutate(fn: (docs: Doklad[]) => Doklad[]): Promise<Doklad[]> {
  const run = queue.then(async () => {
    const next = fn(await load());
    cache = next;
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    listeners.forEach((l) => l(next));
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function listDoklady(): Promise<Doklad[]> {
  return load();
}

export async function getDoklad(id: string): Promise<Doklad | undefined> {
  return (await load()).find((d) => d.id === id);
}

export async function addDoklad(doc: Doklad): Promise<void> {
  await mutate((docs) => [doc, ...docs]);
}

export async function updateDoklad(id: string, patch: Partial<Doklad>): Promise<Doklad | undefined> {
  const docs = await mutate((all) => all.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  return docs.find((d) => d.id === id);
}

export function subscribe(fn: (docs: Doklad[]) => void): () => void {
  listeners.add(fn);
  load().then(fn);
  return () => listeners.delete(fn);
}
