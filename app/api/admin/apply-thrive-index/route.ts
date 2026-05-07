import { NextResponse } from "next/server";
import { getEntries, addEntry } from "@/lib/storage";
import {
  THRIVE_BATCH_2026_05_06,
  INDEX_BATCH_2026_05_06,
} from "@/lib/thrive-index-batch-seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

const ALL_ITEMS = [...THRIVE_BATCH_2026_05_06, ...INDEX_BATCH_2026_05_06];

/**
 * Combined apply endpoint for Thrive + Index portfolio batches (May 6 2026).
 *
 * Behavior:
 *   - Adds entries with status='targeting' and priority='low' (Secondary targets tier)
 *   - Existing primary targets (the a16z entries) are NOT touched
 *   - Idempotent — skips any whose normalized name is already in the DB
 *   - Adds-only — does not archive/demote anything
 */

/**
 * GET — dry run.
 */
export async function GET() {
  const entries = await getEntries();
  const existing = new Set(entries.map((e) => normalize(e.name)));

  const seenInBatch = new Set<string>();
  const wouldAdd: Array<{ name: string; source: string; domain: string }> = [];
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
        reason: "duplicate within batch",
      });
      continue;
    }
    seenInBatch.add(norm);
    wouldAdd.push({
      name: item.finalName,
      source: item.source,
      domain: item.domain,
    });
  }

  const thriveCount = wouldAdd.filter((w) => w.source === "thrive").length;
  const indexCount = wouldAdd.filter((w) => w.source === "index").length;
  const currentTargeting = entries.filter((e) => e.status === "targeting");
  const currentHigh = currentTargeting.filter(
    (e) => (e.priority ?? "high") === "high"
  );

  return NextResponse.json({
    dry_run: true,
    current_targeting_total: currentTargeting.length,
    current_targeting_primary: currentHigh.length,
    seed_total: ALL_ITEMS.length,
    thrive_seed_count: THRIVE_BATCH_2026_05_06.length,
    index_seed_count: INDEX_BATCH_2026_05_06.length,
    would_add_count: wouldAdd.length,
    would_add_thrive: thriveCount,
    would_add_index: indexCount,
    skipped_count: skipped.length,
    final_targeting_after: currentTargeting.length + wouldAdd.length,
    final_secondary_after: wouldAdd.length,
    sample_first_30: wouldAdd.slice(0, 30),
    skipped,
    instruction:
      "POST to apply. Adds all entries as 'targeting' with priority='low' (Secondary tier). " +
      "Does NOT touch existing primary targets. Idempotent.",
  });
}

/**
 * POST — applies both batches with priority='low'.
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

    const sourceLabel = item.source === "thrive" ? "Thrive" : "Index";
    await addEntry({
      name: item.finalName,
      status: "targeting",
      priority: "low",
      type: item.type,
      domain: item.domain,
      notes: `${sourceLabel} portfolio · May 6 2026 batch · secondary priority`,
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
      final_targeting_count: final.filter((e) => e.status === "targeting")
        .length,
      final_targeting_primary: final.filter(
        (e) =>
          e.status === "targeting" && (e.priority ?? "high") === "high"
      ).length,
      final_targeting_secondary: final.filter(
        (e) => e.status === "targeting" && e.priority === "low"
      ).length,
    },
    added_count: added.length,
    added_thrive: added.filter((a) => a.source === "thrive").length,
    added_index: added.filter((a) => a.source === "index").length,
    skipped_count: skipped.length,
    skipped,
  });
}
