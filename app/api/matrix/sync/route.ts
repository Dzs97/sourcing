import { NextRequest, NextResponse } from "next/server";
import { getRankings } from "@/lib/rankings-storage";
import { getEntries } from "@/lib/storage";
import { addItems } from "@/lib/matrix-storage";
import { fuzzyName } from "@/lib/name-normalize";

export const dynamic = "force-dynamic";

/**
 * Sync fresh sourcing signal into the Matrix. Two modes:
 *
 *  mode=rankings  → append the top-N ranked companies (by superstar
 *                   count, then total score) that AREN'T already in
 *                   the tracker, into
 *                   Engineering :: Product / Founding Engineer ::
 *                   "Ranked but untracked (top N)".
 *
 *  mode=historical → append all tracker entries in eng-relevant
 *                   domains into a per-domain group under the same
 *                   role. Same behaviour as the live merge in
 *                   MatrixPanel, but persisted so it survives
 *                   render-only changes.
 *
 * Both modes are ADD-ONLY. Existing group items are never removed.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode: "rankings" | "historical" = body?.mode ?? "rankings";
  const topN: number = Math.max(5, Math.min(200, body?.topN ?? 50));

  const [entries, bundle] = await Promise.all([getEntries(), getRankings()]);
  const dbNames = new Set(entries.map((e) => fuzzyName(e.name)));

  if (mode === "rankings") {
    const rk = (bundle?.rankings ?? []).slice();
    rk.sort((a, b) => {
      if ((b.superstar ?? 0) !== (a.superstar ?? 0))
        return (b.superstar ?? 0) - (a.superstar ?? 0);
      return b.total_score - a.total_score;
    });
    const additions: string[] = [];
    for (const r of rk) {
      if (additions.length >= topN) break;
      if (dbNames.has(fuzzyName(r.company))) continue;
      additions.push(r.company);
    }
    const updated = await addItems(
      "Engineering",
      "Product / Founding Engineer",
      `Ranked but untracked (top ${topN})`,
      additions
    );
    return NextResponse.json({
      mode,
      added: additions.length,
      updated_at: updated.updated_at,
    });
  }

  // Historical: append all eng-domain tracker entries into per-domain
  // groups. The MatrixPanel already merges this live, but persisting
  // makes the additions searchable via the /api/matrix GET.
  const ENG_DOMAINS = new Set([
    "frontier-ai",
    "infra-devtools",
    "defense",
    "bio-ai",
    "research-lab",
    "fintech",
    "vertical-saas",
    "cs-school",
    "elite-hs",
    "fellowship",
    "olympiad",
    "open-source",
    "neos-portco",
  ]);
  const byDomain = new Map<string, string[]>();
  for (const e of entries) {
    if (!ENG_DOMAINS.has(e.domain)) continue;
    const arr = byDomain.get(e.domain) ?? [];
    arr.push(e.name);
    byDomain.set(e.domain, arr);
  }
  let totalAdded = 0;
  for (const [domain, names] of byDomain) {
    const before = names.length;
    await addItems(
      "Engineering",
      "Product / Founding Engineer",
      `Historical tracker sync — ${domain}`,
      names
    );
    totalAdded += before;
  }
  return NextResponse.json({ mode, added: totalAdded });
}
