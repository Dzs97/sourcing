/**
 * Auto-backfill: when Rankings data lands in Redis, ensure every company
 * with meaningful calibration signal (≥ MIN_VOTES votes) also has a
 * tracker Entry. Prevents the Home tab's "not in tracker" queue from
 * surfacing companies Diego has clearly already sourced from — since
 * having calibration votes on a company IS evidence of sourcing.
 *
 * New entries land as status=tried (default), type=company, with a
 * "backfilled from rankings" note. Diego can promote to targeting or
 * blacklist them as usual.
 */

import type { RankingsBundle } from "./rankings-types";
import { getEntries, addEntry } from "./storage";
import { fuzzyName } from "./name-normalize";
import { canonicalPoolName } from "./pool-aliases";
import { POOL_CATEGORIES } from "./pool-categories";
import type { Domain } from "./types";

const MIN_VOTES = 5;

/** Category → app Domain enum. Best-effort mapping so backfilled entries
 * carry a sensible domain instead of falling to "other". */
const CATEGORY_TO_DOMAIN: Record<string, Domain> = {
  "foundation-lab": "frontier-ai",
  "big-tech": "other",
  "ai-startup": "frontier-ai",
  "data-infra": "infra-devtools",
  "devtools": "infra-devtools",
  "fintech": "fintech",
  "trading": "fintech",
  "robotics": "defense",
  "defense": "defense",
  "research-lab": "research-lab",
  "university": "cs-school",
  "consumer": "vertical-saas",
  "healthtech": "bio-ai",
  "other": "other",
};

/** Skip obvious VC / program / noise names — these show up in some
 * ranking exports but aren't real target companies. */
const SKIP_EXACT = new Set([
  "Kleiner Perkins","Sutter Hill Ventures","Sequoia Capital","a16z",
  "Andreessen Horowitz","Menlo","BCV","South Park Commons","-",
  "Software Engineer","IVP","NEA","Neo","8VC","Khosla","Lightspeed",
  "Coatue","Redpoint","Tiger","Chemistry","GC","GV","Battery",
  "Insight","General Catalyst","Bessemer","Founders Fund","Iconiq",
]);
const SKIP_PATTERN = /\b(Capital|Partners|Ventures|Fund|Fellowship|Fellows)\b/i;

export interface BackfillResult {
  scanned: number;
  eligible: number;
  added: number;
  skipped: number;
}

export async function backfillMissingRankedEntries(
  bundle: RankingsBundle
): Promise<BackfillResult> {
  const entries = await getEntries();
  const tracked = new Set(
    entries.map((e) => fuzzyName(canonicalPoolName(e.name)))
  );

  let scanned = 0;
  let eligible = 0;
  let added = 0;
  let skipped = 0;

  for (const r of bundle.rankings) {
    scanned++;
    if (r.total_votes < MIN_VOTES) continue;
    if (SKIP_EXACT.has(r.company) || SKIP_PATTERN.test(r.company)) {
      skipped++;
      continue;
    }
    eligible++;
    const key = fuzzyName(canonicalPoolName(r.company));
    if (tracked.has(key)) continue;
    const category = POOL_CATEGORIES[r.company] ?? "other";
    const domain = CATEGORY_TO_DOMAIN[category] ?? "other";
    await addEntry({
      name: r.company,
      status: "tried",
      type: "company",
      domain,
      notes: `Backfilled from rankings — ${r.total_votes} calibration votes, score ${r.total_score.toFixed(1)}`,
    });
    tracked.add(key); // avoid dup within this run
    added++;
  }

  return { scanned, eligible, added, skipped };
}
