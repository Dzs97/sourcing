import { Redis } from "@upstash/redis";
import type {
  TargetingCohort,
  Status,
  EntryType,
  Domain,
} from "./types";

const HISTORY_KEY = "sourcing:targeting-history:v1";

let memoryHistory: TargetingCohort[] | null = null;
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

export async function getHistory(): Promise<TargetingCohort[]> {
  const redis = getRedis();
  if (!redis) {
    if (memoryHistory === null) memoryHistory = [];
    return memoryHistory;
  }
  const stored = await redis.get<TargetingCohort[]>(HISTORY_KEY);
  return stored ?? [];
}

async function saveHistory(history: TargetingCohort[]): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memoryHistory = history;
    return;
  }
  await redis.set(HISTORY_KEY, history);
}

export async function appendCohort(cohort: TargetingCohort): Promise<void> {
  const current = await getHistory();
  await saveHistory([...current, cohort]);
}

export async function clearHistory(): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memoryHistory = null;
    return;
  }
  await redis.del(HISTORY_KEY);
}

/** Today's date as a UTC day key, e.g. "2026-04-27" */
function todayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export interface DailyAction {
  name: string;
  type: EntryType;
  domain: Domain;
  fromStatus: Status;
  toStatus: Status;
}

/**
 * Append an individual status change to today's daily-activity cohort.
 * Creates a new daily cohort if none exists yet for today.
 *
 * Concurrency note: this does a read-modify-write. For a 1-3 person team
 * this is fine; rapid-fire clicks could in theory race but the worst case
 * is one click being momentarily lost from the log (the entry's actual
 * status still updates correctly because that's a separate write path).
 */
export async function logDailyAction(action: DailyAction): Promise<void> {
  const now = Date.now();
  const dayKey = todayKey(now);

  const history = await getHistory();
  const idx = history.findIndex(
    (c) => c.kind === "daily-activity" && c.dayKey === dayKey
  );

  const newAction = { ...action, at: now };

  if (idx === -1) {
    // First action of the day — create a new cohort
    const cohort: TargetingCohort = {
      id: `daily-${dayKey}`,
      archivedAt: now,
      kind: "daily-activity",
      dayKey,
      entries: [],
      actions: [newAction],
    };
    await saveHistory([...history, cohort]);
  } else {
    // Append to today's existing cohort
    const updated = [...history];
    const existing = updated[idx];
    updated[idx] = {
      ...existing,
      actions: [...(existing.actions ?? []), newAction],
    };
    await saveHistory(updated);
  }
}
