import { Redis } from "@upstash/redis";
import type { TargetingCohort } from "./types";

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

export async function appendCohort(cohort: TargetingCohort): Promise<void> {
  const current = await getHistory();
  const next = [...current, cohort];
  const redis = getRedis();
  if (!redis) {
    memoryHistory = next;
    return;
  }
  await redis.set(HISTORY_KEY, next);
}

export async function clearHistory(): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memoryHistory = null;
    return;
  }
  await redis.del(HISTORY_KEY);
}
