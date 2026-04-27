import { Redis } from "@upstash/redis";
import type { Entry } from "./types";
import { SEED_ENTRIES } from "./seed";

const REDIS_KEY = "sourcing:entries:v1";

// In-memory fallback for local dev without Redis credentials
let memoryStore: Entry[] | null = null;

function getRedis(): Redis | null {
  // Vercel's Upstash Redis integration auto-injects either KV_* (legacy alias)
  // or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. Support both.
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function getEntries(): Promise<Entry[]> {
  const redis = getRedis();
  if (!redis) {
    if (memoryStore === null) {
      memoryStore = [...SEED_ENTRIES];
    }
    return memoryStore;
  }

  const stored = await redis.get<Entry[]>(REDIS_KEY);
  if (stored === null || stored === undefined) {
    // First run — seed it
    await redis.set(REDIS_KEY, SEED_ENTRIES);
    return SEED_ENTRIES;
  }
  return stored;
}

export async function saveEntries(entries: Entry[]): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memoryStore = entries;
    return;
  }
  await redis.set(REDIS_KEY, entries);
}

export async function addEntry(
  entry: Omit<Entry, "id" | "addedAt">
): Promise<Entry> {
  const entries = await getEntries();
  const newEntry: Entry = {
    ...entry,
    id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    addedAt: Date.now(),
  };
  entries.push(newEntry);
  await saveEntries(entries);
  return newEntry;
}

export async function updateEntry(
  id: string,
  patch: Partial<Omit<Entry, "id">>
): Promise<Entry | null> {
  const entries = await getEntries();
  const idx = entries.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...patch };
  await saveEntries(entries);
  return entries[idx];
}

export async function deleteEntry(id: string): Promise<boolean> {
  const entries = await getEntries();
  const filtered = entries.filter((x) => x.id !== id);
  if (filtered.length === entries.length) return false;
  await saveEntries(filtered);
  return true;
}

export async function resetToSeed(): Promise<void> {
  await saveEntries([...SEED_ENTRIES]);
}
