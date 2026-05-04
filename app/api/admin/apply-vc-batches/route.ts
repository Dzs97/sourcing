import { NextResponse } from "next/server";
import { getEntries, addEntry } from "@/lib/storage";
import { SEQUOIA_BATCH_2026_05_01 } from "@/lib/sequoia-batch-seed";
import { A16Z_BATCH_2026_05_04 } from "@/lib/a16z-batch-seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Combined endpoint that applies BOTH the Sequoia portfolio batch (May 1)
 * and the a16z portfolio batch (May 4) in a single push.
 *
 * Behavior is additive only:
 *   - Does NOT archive current targeting cohort
 *   - Does NOT demote current targeting → tried
 *   - Just *adds* the new entries with status='targeting' and today's date
 *   - Idempotent: skips any whose normalized name is already in the DB
 *
 * Designed for the case where the user wants to dramatically expand their
 * targeting pool with VC portfolio companies they haven't yet considered.
 */

const ALL_ITEMS = [
  ...SEQUOIA_BATCH_2026_05_01.map((item) => ({ ...item, source: "sequoia" as const })),
  ...A16Z_BATCH_2026_05_04.map((item) => ({ ...item, source: "a16z" as const })),
];

/**
 * GET — dry run.
 */
export async function GET() {
  const entries = await getEntries();
  const existing = new Set(entries.map((e) => normalize(e.name)));

  // Also dedup within ALL_ITEMS in case Sequoia and a16z have shared names
  const seenInBatch = new Set<string>();
  const wouldAdd: Array<{ name: string; source: string }> = [];
  const skipped: Array<{ name: string; source: string; reason: string }> = [];

  for (const item of ALL_ITEMS) {
    const norm = normalize(item.finalName);

    if (existing.has(norm)) {
      skipped.push({
        name: item.finalName,
        source: item.source,
        reason: "already in tracker",
      });
      continue;
    }
    if (seenInBatch.has(norm)) {
      skipped.push({
        name: item.finalName,
        source: item.source,
        reason: "duplicate within batch (other VC has same company)",
      });
      continue;
    }
    seenInBatch.add(norm);
    wouldAdd.push({ name: item.finalName, source: item.source });
  }

  const sequoiaCount = wouldAdd.filter((w) => w.source === "sequoia").length;
  const a16zCount = wouldAdd.filter((w) => w.source === "a16z").length;
  const currentTargeting = entries.filter((e) => e.status === "targeting");

  return NextResponse.json({
    dry_run: true,
    current_targeting_count: currentTargeting.length,
    seed_total: ALL_ITEMS.length,
    sequoia_seed_count: SEQUOIA_BATCH_2026_05_01.length,
    a16z_seed_count: A16Z_BATCH_2026_05_04.length,
    would_add_count: wouldAdd.length,
    would_add_sequoia: sequoiaCount,
    would_add_a16z: a16zCount,
    skipped_count: skipped.length,
    final_targeting_after: currentTargeting.length + wouldAdd.length,
    sample_first_30: wouldAdd.slice(0, 30),
    skipped,
    instruction:
      "POST to apply both batches. Adds all entries as 'targeting' status. " +
      "Does NOT archive or demote current targeting. Idempotent.",
    warning: `This will add ${wouldAdd.length} entries to your targeting list.`,
  });
}

/**
 * POST — applies both batches.
 */
export async function POST() {
  const now = Date.now();
  const initialEntries = await getEntries();
  const existing = new Set(initialEntries.map((e) => normalize(e.name)));

  const added: Array<{ name: string; source: string }> = [];
  const skipped: Array<{ name: string; source: string }> = [];

  for (const item of ALL_ITEMS) {
    const norm = normalize(item.finalName);

    if (existing.has(norm)) {
      skipped.push({ name: item.finalName, source: item.source });
      continue;
    }

    const sourceLabel = item.source === "sequoia" ? "Sequoia" : "a16z";
    await addEntry({
      name: item.finalName,
      status: "targeting",
      type: item.type,
      domain: item.domain,
      notes:
        item.note ?? `${sourceLabel} portfolio · ${item.source === "sequoia" ? "May 1" : "May 4"} 2026 batch`,
      targetedAt: now,
    });
    added.push({ name: item.finalName, source: item.source });
    existing.add(norm);
  }

  const final = await getEntries();
  return NextResponse.json({
    ok: true,
    summary: {
      final_total: final.length,
      final_targeting_count: final.filter((e) => e.status === "targeting").length,
    },
    added_count: added.length,
    added_sequoia: added.filter((a) => a.source === "sequoia").length,
    added_a16z: added.filter((a) => a.source === "a16z").length,
    skipped_count: skipped.length,
    skipped,
  });
}
