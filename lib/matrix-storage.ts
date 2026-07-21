import { Redis } from "@upstash/redis";

const KEY = "sourcing:matrix-additions:v1";

/**
 * A delta of user-added items on top of the base matrix JSON. Keyed by
 * `<function>::<role>::<groupLabel>`. Each value is a de-duped list of
 * items appended to that group at render time. Add-only — the sync
 * button never removes entries the user hasn't explicitly deleted.
 */
export interface MatrixAdditions {
  additions: Record<string, string[]>;
  updated_at: number;
}

let memoryAdds: MatrixAdditions | null = null;
let redisInstance: Redis | null | undefined = undefined;

function getRedis(): Redis | null {
  if (redisInstance !== undefined) return redisInstance;
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

const EMPTY: MatrixAdditions = { additions: {}, updated_at: 0 };

export async function getAdditions(): Promise<MatrixAdditions> {
  const redis = getRedis();
  if (!redis) return memoryAdds ?? EMPTY;
  try {
    const val = (await redis.get(KEY)) as MatrixAdditions | null;
    return val ?? EMPTY;
  } catch {
    return memoryAdds ?? EMPTY;
  }
}

export function groupKey(
  fn: string,
  role: string,
  group: string
): string {
  return `${fn}::${role}::${group}`;
}

export async function addItems(
  fn: string,
  role: string,
  group: string,
  items: string[]
): Promise<MatrixAdditions> {
  const clean = items
    .map((i) => (i || "").trim())
    .filter(Boolean);
  if (clean.length === 0) return getAdditions();
  const current = await getAdditions();
  const key = groupKey(fn, role, group);
  const existing = new Set((current.additions[key] ?? []).map((x) => x.toLowerCase()));
  const next = [...(current.additions[key] ?? [])];
  for (const it of clean) {
    if (!existing.has(it.toLowerCase())) {
      next.push(it);
      existing.add(it.toLowerCase());
    }
  }
  const updated: MatrixAdditions = {
    additions: { ...current.additions, [key]: next },
    updated_at: Date.now(),
  };
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(KEY, updated);
    } catch {
      memoryAdds = updated;
    }
  } else {
    memoryAdds = updated;
  }
  return updated;
}

export async function removeItem(
  fn: string,
  role: string,
  group: string,
  item: string
): Promise<MatrixAdditions> {
  const current = await getAdditions();
  const key = groupKey(fn, role, group);
  const existing = current.additions[key] ?? [];
  const next = existing.filter(
    (x) => x.toLowerCase() !== item.toLowerCase()
  );
  const updated: MatrixAdditions = {
    additions: { ...current.additions, [key]: next },
    updated_at: Date.now(),
  };
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(KEY, updated);
    } catch {
      memoryAdds = updated;
    }
  } else {
    memoryAdds = updated;
  }
  return updated;
}
