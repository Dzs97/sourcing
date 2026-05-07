import { NextResponse } from "next/server";
import { getEntries, addEntry, updateEntry } from "@/lib/storage";
import {
  GENERAL_CATALYST_BATCH_2026_05_07,
  ACCEL_BATCH_2026_05_07,
} from "@/lib/gc-accel-batch-seed";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

const ALL_ITEMS = [...GENERAL_CATALYST_BATCH_2026_05_07, ...ACCEL_BATCH_2026_05_07];

/**
 * Combined apply endpoint for GC + Accel portfolio batches (May 7 2026).
 *
 * Behavior:
 *   1. PROMOTES all current targeting entries with names ending in "(Thrive)" or
 *      "(Index)" from priority="low" → priority="high". They move from Secondary
 *      tier into Primary tier.
 *   2. ADDS all GC + Accel companies as priority="low" (Secondary targets), with
 *      "(General Catalyst)" and "(Accel)" name suffixes.
 *   3. Idempotent — skips any whose normalized name is already in the DB.
 *   4. Add-only for new entries — does not archive/demote anything else.
 */

/**
 * GET — dry run.
 */
export async function GET() {
  const entries = await getEntries();
  const existing = new Set(entries.map((e) => normalize(e.name)));

  // Identify Thrive/Index entries currently low-priority targeting that would be promoted
  const promotionCandidates = entries.filter(
    (e) =>
      e.status === "targeting" &&
      (e.priority ?? "high") === "low" &&
      (e.name.endsWith("(Thrive)") || e.name.endsWith("(Index)"))
  );

  // Identify add-candidates
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

  const gcCount = wouldAdd.filter((w) => w.source === "general-catalyst").length;
  const accelCount = wouldAdd.filter((w) => w.source === "accel").length;
  const currentTargeting = entries.filter((e) => e.status === "targeting");

  return NextResponse.json({
    dry_run: true,
    current_targeting_total: currentTargeting.length,
    current_targeting_primary: currentTargeting.filter(
      (e) => (e.priority ?? "high") === "high"
    ).length,
    current_targeting_secondary: currentTargeting.filter(
      (e) => e.priority === "low"
    ).length,
    promotion_candidates_count: promotionCandidates.length,
    promotion_thrive: promotionCandidates.filter((e) =>
      e.name.endsWith("(Thrive)")
    ).length,
    promotion_index: promotionCandidates.filter((e) =>
      e.name.endsWith("(Index)")
    ).length,
    seed_total: ALL_ITEMS.length,
    gc_seed_count: GENERAL_CATALYST_BATCH_2026_05_07.length,
    accel_seed_count: ACCEL_BATCH_2026_05_07.length,
    would_add_count: wouldAdd.length,
    would_add_general_catalyst: gcCount,
    would_add_accel: accelCount,
    skipped_count: skipped.length,
    final_targeting_total_after:
      currentTargeting.length + wouldAdd.length,
    final_primary_after:
      currentTargeting.filter((e) => (e.priority ?? "high") === "high").length +
      promotionCandidates.length,
    final_secondary_after:
      currentTargeting.filter((e) => e.priority === "low").length -
      promotionCandidates.length +
      wouldAdd.length,
    sample_promotion_first_10: promotionCandidates.slice(0, 10).map((e) => e.name),
    sample_add_first_30: wouldAdd.slice(0, 30),
    skipped_first_50: skipped.slice(0, 50),
    instruction:
      "POST to apply. Two-stage operation: " +
      "(1) promotes all (Thrive)/(Index) targeting entries to priority='high', " +
      "(2) adds GC+Accel entries as 'targeting' with priority='low'. " +
      "Does NOT touch other primary targets. Idempotent.",
  });
}

/**
 * POST — applies promotion + adds.
 */
export async function POST() {
  const now = Date.now();
  const initialEntries = await getEntries();
  const existing = new Set(initialEntries.map((e) => normalize(e.name)));

  // STAGE 1: Promote all (Thrive)/(Index) low-priority targeting entries to high
  const promotionTargets = initialEntries.filter(
    (e) =>
      e.status === "targeting" &&
      (e.priority ?? "high") === "low" &&
      (e.name.endsWith("(Thrive)") || e.name.endsWith("(Index)"))
  );

  const promoted: Array<{ id: string; name: string }> = [];
  for (const e of promotionTargets) {
    await updateEntry(e.id, { priority: "high" });
    promoted.push({ id: e.id, name: e.name });
  }

  // STAGE 2: Add GC + Accel as low-priority targeting
  const added: Array<{ name: string; source: string }> = [];
  const skipped: Array<{ name: string; source: string }> = [];

  for (const item of ALL_ITEMS) {
    const norm = normalize(item.finalName);

    if (existing.has(norm)) {
      skipped.push({ name: item.finalName, source: item.source });
      continue;
    }

    const sourceLabel =
      item.source === "general-catalyst" ? "General Catalyst" : "Accel";
    await addEntry({
      name: item.finalName,
      status: "targeting",
      priority: "low",
      type: item.type,
      domain: item.domain,
      notes: `${sourceLabel} portfolio · May 7 2026 batch · secondary priority`,
      targetedAt: now,
    });
    added.push({ name: item.finalName, source: item.source });
    existing.add(norm);
  }

  const final = await getEntries();
  const finalTargeting = final.filter((e) => e.status === "targeting");
  return NextResponse.json({
    ok: true,
    summary: {
      final_total: final.length,
      final_targeting_count: finalTargeting.length,
      final_targeting_primary: finalTargeting.filter(
        (e) => (e.priority ?? "high") === "high"
      ).length,
      final_targeting_secondary: finalTargeting.filter(
        (e) => e.priority === "low"
      ).length,
    },
    promoted_count: promoted.length,
    promoted_thrive: promoted.filter((p) => p.name.endsWith("(Thrive)")).length,
    promoted_index: promoted.filter((p) => p.name.endsWith("(Index)")).length,
    added_count: added.length,
    added_general_catalyst: added.filter((a) => a.source === "general-catalyst")
      .length,
    added_accel: added.filter((a) => a.source === "accel").length,
    skipped_count: skipped.length,
    skipped_sample: skipped.slice(0, 30),
  });
}
