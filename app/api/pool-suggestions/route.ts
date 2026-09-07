import { NextResponse } from "next/server";
import { parseCsv, toCsvExportUrl } from "@/lib/sheet-csv";
import { rowsFromCsv, computeYields } from "@/lib/pool-yield";
import { getRankings } from "@/lib/rankings-storage";
import type { Ranking } from "@/lib/rankings-types";
import { fuzzyName } from "@/lib/name-normalize";
import {
  getCached,
  saveCache,
  clearCache,
  pickTopPools,
  generateSuggestions,
  SEED_SUGGESTIONS,
  type SuggestionsBundle,
} from "@/lib/pool-suggestions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET  /api/pool-suggestions             → return cached, or generate if empty
 * GET  /api/pool-suggestions?refresh=1   → force regenerate + save
 *
 * The generation call pulls the sheet's pools + the calibration rankings,
 * picks the top-signal pools as the "success pattern", and asks Claude
 * Sonnet 5 for 5 new adjacent pools the team hasn't sourced yet.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";

  if (!refresh) {
    const cached = await getCached();
    if (cached) {
      return NextResponse.json({ ok: true, cached: true, ...cached });
    }
  }

  // No API key yet → serve the hand-authored first pass so the strip is
  // useful from the moment the tab loads. Cache it too, so refresh always
  // pulls the exact same seed until an API key is configured.
  if (!process.env.ANTHROPIC_API_KEY) {
    const seed: SuggestionsBundle = {
      generated_at: Date.now(),
      model: "seed",
      count: SEED_SUGGESTIONS.length,
      suggestions: SEED_SUGGESTIONS,
    };
    await saveCache(seed);
    return NextResponse.json({ ok: true, cached: false, ...seed });
  }

  const sheetUrl = process.env.NEXT_PUBLIC_HANDOFF_SHEET_URL || "";
  if (!sheetUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "Sheet URL not configured.",
        missing: "NEXT_PUBLIC_HANDOFF_SHEET_URL",
      },
      { status: 400 }
    );
  }

  let pools;
  let excludeSet: Set<string>;
  try {
    const csvUrl = toCsvExportUrl(sheetUrl);
    const res = await fetch(csvUrl, { redirect: "follow", cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Sheet fetch returned ${res.status}. Is it link-viewable?`,
        },
        { status: 502 }
      );
    }
    const text = await res.text();
    if (text.startsWith("<") || text.includes("<html")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Sheet returned HTML, not CSV. Change share setting to "Anyone with the link → Viewer" and try again.',
        },
        { status: 403 }
      );
    }
    const cells = parseCsv(text);
    const rows = rowsFromCsv(cells);
    pools = computeYields(rows);
    excludeSet = new Set(pools.map((p) => p.tag));
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }

  const bundle = await getRankings();
  const rankingByKey = new Map<string, Ranking>();
  if (bundle?.rankings) {
    for (const r of bundle.rankings) rankingByKey.set(fuzzyName(r.company), r);
  }

  const top = pickTopPools(pools, rankingByKey, fuzzyName, 25);
  if (top.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No high-signal pools yet — need at least a few with calibration data before suggesting adjacent ones.",
      },
      { status: 400 }
    );
  }

  let suggestions;
  try {
    suggestions = await generateSuggestions(top, excludeSet, fuzzyName);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }

  const out: SuggestionsBundle = {
    generated_at: Date.now(),
    model: "claude-sonnet-5",
    count: suggestions.length,
    suggestions,
  };
  await saveCache(out);
  return NextResponse.json({ ok: true, cached: false, ...out });
}

/**
 * DELETE clears the cache so the next GET regenerates. Same effect as
 * `GET ?refresh=1` but leaves whatever was cached in place until the next
 * fetch triggers regeneration.
 */
export async function DELETE() {
  await clearCache();
  return NextResponse.json({ ok: true });
}
