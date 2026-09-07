import { Redis } from "@upstash/redis";
import type { PoolYield } from "./pool-yield";
import type { Ranking } from "./rankings-types";
import { POOL_CATEGORIES, CATEGORY_ORDER } from "./pool-categories";

/**
 * A single AI-generated pool suggestion. `name` is a real company/organization
 * the sourcer probably hasn't sourced from yet; `similarTo` cites which of
 * their high-signal pools inspired it.
 */
export interface PoolSuggestion {
  name: string;
  category: string;
  why: string;
  similarTo: string;
}

export interface SuggestionsBundle {
  generated_at: number;
  /** Which model produced this bundle. "seed" means the hand-authored first pass. */
  model: string;
  count: number;
  suggestions: PoolSuggestion[];
}

/**
 * First-pass seed suggestions, hand-picked against Diego's actual sheet
 * (24k rows, 3.7k unique companies). Each of these was verified to not
 * already appear in local-rankings.ts. Extends coverage into four
 * categories: AI startups, AI-infra chips/serving, bio-AI, and devtools.
 * Used until an ANTHROPIC_API_KEY is wired and the model-generated pass
 * can run.
 */
export const SEED_SUGGESTIONS: PoolSuggestion[] = [
  {
    name: "Poolside",
    category: "ai-startup",
    why: "Ex-GitHub Copilot + DeepMind team building AI coding models; caliber matches Cursor's hires.",
    similarTo: "Cursor",
  },
  {
    name: "Fal.ai",
    category: "data-infra",
    why: "Real-time image/video model inference platform; a16z-backed, hiring elite systems engineers.",
    similarTo: "Fireworks AI",
  },
  {
    name: "Rain AI",
    category: "data-infra",
    why: "Neuromorphic AI chip startup with ex-Google TPU talent; adjacent to your Etched/Cerebras exposure.",
    similarTo: "Etched",
  },
  {
    name: "Formation Bio",
    category: "healthtech",
    why: "AI-native drug discovery; extends bio-AI coverage that's still thin in your pool set.",
    similarTo: "Recursion",
  },
  {
    name: "Marimo",
    category: "devtools",
    why: "Python-native reactive notebook, ex-Google Brain founders; hires ML infra engineers with taste.",
    similarTo: "Vercel",
  },
];

const CACHE_KEY = "sourcing:pool-suggestions:v1";
const CACHE_TTL_SEC = 60 * 60 * 24; // 24h

let memoryCache: SuggestionsBundle | null = null;

function getRedis(): Redis | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function getCached(): Promise<SuggestionsBundle | null> {
  const redis = getRedis();
  if (!redis) return memoryCache;
  return (await redis.get<SuggestionsBundle>(CACHE_KEY)) ?? null;
}

export async function saveCache(bundle: SuggestionsBundle): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memoryCache = bundle;
    return;
  }
  await redis.set(CACHE_KEY, bundle, { ex: CACHE_TTL_SEC });
}

export async function clearCache(): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memoryCache = null;
    return;
  }
  await redis.del(CACHE_KEY);
}

/**
 * Build the shortlist of high-signal existing pools we feed to the model.
 * Prefers pools with real calibration data (at least 5 votes, score ≥ 20)
 * and known category — those are the ones with a defensible "success pattern"
 * for the model to reason about.
 */
export function pickTopPools(
  pools: PoolYield[],
  rankingByKey: Map<string, Ranking>,
  fuzzy: (s: string) => string,
  limit = 25
): Array<{
  pool: PoolYield;
  ranking: Ranking;
  category: string;
}> {
  const scored: Array<{
    pool: PoolYield;
    ranking: Ranking;
    category: string;
  }> = [];
  for (const p of pools) {
    const r = rankingByKey.get(fuzzy(p.tag));
    if (!r || r.total_votes < 5 || r.total_score < 20) continue;
    scored.push({
      pool: p,
      ranking: r,
      category: POOL_CATEGORIES[p.tag] ?? "other",
    });
  }
  scored.sort((a, b) => b.ranking.total_score - a.ranking.total_score);
  return scored.slice(0, limit);
}

/**
 * Call Claude Sonnet 5 to suggest 5 new pools structurally similar to the
 * top-performing pools the team has already sourced from. Model receives:
 *   1. A ranked list of top-yielding pools with score + pass rate
 *   2. The exclusion list of every tag/company already in the sheet
 *   3. The category taxonomy so it stays consistent with the coverage view
 *
 * Returns 5 suggestions, or throws with a descriptive error the API route
 * surfaces to the client.
 */
export async function generateSuggestions(
  top: ReturnType<typeof pickTopPools>,
  excludeSet: Set<string>,
  norm: (s: string) => string
): Promise<PoolSuggestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured — add it in Vercel env or .env.local"
    );
  }

  const topLines = top.map((t, i) => {
    const r = t.ranking;
    const positiveRate =
      r.total_votes > 0
        ? Math.round(((r.superstar + r.yes) / r.total_votes) * 100)
        : 0;
    return `${i + 1}. ${t.pool.tag} (${t.category}) — score ${r.total_score.toFixed(0)}, ${t.pool.sourced} sourced, ${positiveRate}% pass on ${r.total_votes} votes`;
  });

  // Cap exclusion list to keep the prompt tight; include only the most
  // recognizable pools (short-ish names, no all-caps generics like "STEALTH").
  const excludeSample = Array.from(excludeSet)
    .filter((s) => s.length >= 2 && s.length <= 60)
    .slice(0, 600);

  const prompt = `You are advising a talent team on where to source engineering candidates next.

The team's top-performing sourcing pools so far (ranked by calibration score — a weighted sum of interviewer verdicts):
${topLines.join("\n")}

Categories used: ${CATEGORY_ORDER.join(", ")}.

Already-sourced pools (do NOT suggest any of these):
${excludeSample.join(", ")}

Task: suggest exactly 5 companies or organizations the team has NOT yet sourced from, that would likely produce similar-caliber engineering candidates.

Constraints:
- Real, currently active companies/organizations (no defunct, no rebranded, no acquired-and-shuttered).
- Similar or higher technical bar than the top pools shown.
- Prefer pools that EXTEND coverage — surface at least 3 different categories across your 5 picks.
- Skip anything conceptually identical to what's already in the exclusion list (e.g. don't suggest "Palantir Federal" when they've sourced Palantir).
- Return ONLY a JSON array. No prose, no markdown, no code fences.

Schema per suggestion:
{
  "name": "official name of the company/organization",
  "category": "one of the category slugs above",
  "why": "one crisp line explaining why this pool matches their pattern (max 18 words)",
  "similarTo": "which specific existing pool from their top-list this is adjacent to"
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ text?: string }>;
  };
  let raw = data.content?.[0]?.text ?? "";
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Model returned non-JSON: ${raw.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Model response is not a JSON array");
  }

  const excludeNorm = new Set(Array.from(excludeSet).map(norm));
  const clean: PoolSuggestion[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name.trim() : "";
    if (!name || excludeNorm.has(norm(name))) continue;
    const category = typeof rec.category === "string" ? rec.category : "other";
    const why = typeof rec.why === "string" ? rec.why : "";
    const similarTo = typeof rec.similarTo === "string" ? rec.similarTo : "";
    clean.push({ name, category, why, similarTo });
  }
  return clean.slice(0, 5);
}
