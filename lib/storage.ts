import { Redis } from "@upstash/redis";
import type { Entry } from "./types";
import { SEED_ENTRIES } from "./seed";

const REDIS_KEY = "sourcing:entries:v1";

// In-memory fallback for local dev without Redis credentials
let memoryStore: Entry[] | null = null;

// Singleton Redis client — created once per Lambda cold start
let redisInstance: Redis | null | undefined = undefined;

function getRedis(): Redis | null {
  if (redisInstance !== undefined) return redisInstance;

  // Vercel's Upstash Redis integration auto-injects either KV_* (legacy alias)
  // or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. Support both.
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    redisInstance = null;
    return null;
  }
  redisInstance = new Redis({ url, token });
  return redisInstance;
}

/**
 * Read entries directly. Used by the public GET endpoint.
 * On first run with Upstash configured, this seeds the database.
 */
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

/**
 * Replace the entire entries blob.
 * For multi-user safety, prefer mutateEntries() over the raw save.
 */
export async function saveEntries(entries: Entry[]): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memoryStore = entries;
    return;
  }
  await redis.set(REDIS_KEY, entries);
}

/**
 * Read-modify-write helper that re-fetches the latest data right before
 * writing. This narrows the race window between concurrent users.
 *
 * NOT a true atomic transaction (Redis WATCH/MULTI on the REST API is a
 * larger lift) but for a small team mutating different entries concurrently
 * it dramatically reduces lost-update risk vs. caching the read.
 */
async function mutateEntries<T>(
  fn: (entries: Entry[]) => { next: Entry[]; result: T }
): Promise<T> {
  const current = await getEntries();
  const { next, result } = fn(current);
  await saveEntries(next);
  return result;
}

export async function addEntry(
  entry: Omit<Entry, "id" | "addedAt">
): Promise<Entry> {
  return mutateEntries((entries) => {
    const newEntry: Entry = {
      ...entry,
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      addedAt: Date.now(),
    };
    return { next: [...entries, newEntry], result: newEntry };
  });
}

export async function updateEntry(
  id: string,
  patch: Partial<Omit<Entry, "id">>
): Promise<Entry | null> {
  return mutateEntries((entries) => {
    const idx = entries.findIndex((x) => x.id === id);
    if (idx === -1) return { next: entries, result: null };
    const updated = { ...entries[idx], ...patch };
    const next = [...entries];
    next[idx] = updated;
    return { next, result: updated };
  });
}

export async function deleteEntry(id: string): Promise<boolean> {
  return mutateEntries((entries) => {
    const filtered = entries.filter((x) => x.id !== id);
    if (filtered.length === entries.length) {
      return { next: entries, result: false };
    }
    return { next: filtered, result: true };
  });
}

export async function resetToSeed(): Promise<void> {
  await saveEntries([...SEED_ENTRIES]);
}
