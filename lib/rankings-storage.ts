import { Redis } from "@upstash/redis";
import type { RankingsBundle } from "./rankings-types";
import { SEED_RANKINGS } from "./seed-rankings";

const RANKINGS_KEY = "sourcing:rankings:v1";

let memoryRankings: RankingsBundle | null = null;
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

function withTimestamp(bundle: RankingsBundle): RankingsBundle {
  // Seed has uploaded_at: 0 — patch in the current time when first served
  if (bundle.uploaded_at === 0) {
    return { ...bundle, uploaded_at: Date.now() };
  }
  return bundle;
}

export async function getRankings(): Promise<RankingsBundle | null> {
  const redis = getRedis();
  if (!redis) {
    if (memoryRankings === null) {
      memoryRankings = withTimestamp(SEED_RANKINGS);
    }
    return memoryRankings;
  }

  const stored = await redis.get<RankingsBundle>(RANKINGS_KEY);
  if (stored === null || stored === undefined) {
    // First run — seed it from the bundled snapshot
    const seeded = withTimestamp(SEED_RANKINGS);
    await redis.set(RANKINGS_KEY, seeded);
    return seeded;
  }
  return stored;
}

export async function saveRankings(bundle: RankingsBundle): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memoryRankings = bundle;
    return;
  }
  await redis.set(RANKINGS_KEY, bundle);
}

export async function clearRankings(): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memoryRankings = null;
    return;
  }
  await redis.del(RANKINGS_KEY);
}
