import { NextResponse } from "next/server";
import { getEntries, addEntry, updateEntry } from "@/lib/storage";
import { logDailyAction } from "@/lib/history-storage";
import { GREYLOCK_BATCH_2026_05_12 } from "@/lib/greylock-batch-seed";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Greylock Partners portfolio batch (May 12 2026).
 *
 * Three-stage operation in one POST:
 *   1. MARK AS TRIED: All current targeting entries with names ending in
 *      "(Thrive)" or "(Index)" → status="tried". They leave the Primary tier
 *      entirely and join the Tried list. Logged to daily-activity history.
 *   2. PROMOTE: All current targeting entries with names ending in
 *      "(Accel)" or "(General Catalyst)" → priority="high" (Secondary → Primary).
 *   3. ADD: All Greylock companies as priority="low" (Secondary tier).
 *
 * Idempotent — skips any whose normalized name is already in the DB.
 * Does not touch any entries that don't match the above patterns.
 */

export async function GET() {
  const entries = await getEntries();
  const existing = new Set(entries.map((e) => normalize(e.name)));

  const triedCandidates = entries.filter(
    (e) =>
      e.status === "targeting" &&
      (e.name.endsWith("(Thrive)") || e.name.endsWith("(Index)"))
  );

  const promotionCandidates = entries.filter(
    (e) =>
      e.status === "targeting" &&
      (e.priority ?? "high") === "low" &&
      (e.name.endsWith("(Accel)") ||
        e.name.endsWith("(General Catalyst)"))
  );

  const seenInBatch = new Set<string>();
  const wouldAdd: Array<{ name: string; domain: string }> = [];
  const skipped: Array<{ name: string; reason: string }> = [];

  for (const item of GREYLOCK_BATCH_2026_05_12) {
    const norm = normalize(item.finalName);
    if (existing.has(norm)) {
      skipped.push({ name: item.finalName, reason: "already in tracker" });
      continue;
    }
    if (seenInBatch.has(norm)) {
      skipped.push({ name: item.finalName, reason: "duplicate within batch" });
      continue;
    }
    seenInBatch.add(norm);
    wouldAdd.push({ name: item.finalName, domain: item.domain });
  }

  const currentTargeting = entries.filter((e) => e.status === "targeting");
  const currentPrimary = currentTargeting.filter(
    (e) => (e.priority ?? "high") === "high"
  ).length;
  const currentSecondary = currentTargeting.filter(
    (e) => e.priority === "low"
  ).length;

  return NextResponse.json({
    dry_run: true,
    current_state: {
      targeting_total: currentTargeting.length,
      targeting_primary: currentPrimary,
      targeting_secondary: currentSecondary,
      tried_total: entries.filter((e) => e.status === "tried").length,
    },
    stage_1_mark_tried: {
      total: triedCandidates.length,
      thrive: triedCandidates.filter((e) => e.name.endsWith("(Thrive)")).length,
      index: triedCandidates.filter((e) => e.name.endsWith("(Index)")).length,
      sample_first_10: triedCandidates.slice(0, 10).map((e) => e.name),
    },
    stage_2_promote: {
      total: promotionCandidates.length,
      accel: promotionCandidates.filter((e) => e.name.endsWith("(Accel)"))
        .length,
      general_catalyst: promotionCandidates.filter((e) =>
        e.name.endsWith("(General Catalyst)")
      ).length,
      sample_first_10: promotionCandidates.slice(0, 10).map((e) => e.name),
    },
    stage_3_add: {
      total: wouldAdd.length,
      skipped: skipped.length,
      sample_first_20: wouldAdd.slice(0, 20),
    },
    projected_final_state: {
      targeting_total:
        currentTargeting.length - triedCandidates.length + wouldAdd.length,
      targeting_primary: currentPrimary + promotionCandidates.length,
      targeting_secondary:
        currentSecondary - promotionCandidates.length + wouldAdd.length,
      tried_total:
        entries.filter((e) => e.status === "tried").length +
        triedCandidates.length,
    },
    instruction:
      "POST to apply. Three-stage operation: " +
      "(1) marks (Thrive)/(Index) targeting entries as 'tried', " +
      "(2) promotes (Accel)/(General Catalyst) Secondary → Primary, " +
      "(3) adds Greylock entries as Secondary. Idempotent.",
  });
}

export async function POST() {
  const now = Date.now();
  const initial = await getEntries();
  const existing = new Set(initial.map((e) => normalize(e.name)));

  // STAGE 1: Mark Thrive/Index targeting → tried (and log to daily activity)
  const triedTargets = initial.filter(
    (e) =>
      e.status === "targeting" &&
      (e.name.endsWith("(Thrive)") || e.name.endsWith("(Index)"))
  );
  const triedSummary = { thrive: 0, index: 0 };
  for (const e of triedTargets) {
    await updateEntry(e.id, { status: "tried" });
    await logDailyAction({
      name: e.name,
      type: e.type,
      domain: e.domain,
      fromStatus: "targeting",
      toStatus: "tried",
    });
    if (e.name.endsWith("(Thrive)")) triedSummary.thrive++;
    else triedSummary.index++;
  }

  // STAGE 2: Promote Accel/GC low → high
  const promotionTargets = initial.filter(
    (e) =>
      e.status === "targeting" &&
      (e.priority ?? "high") === "low" &&
      (e.name.endsWith("(Accel)") ||
        e.name.endsWith("(General Catalyst)"))
  );
  const promotedSummary = { accel: 0, general_catalyst: 0 };
  for (const e of promotionTargets) {
    await updateEntry(e.id, { priority: "high" });
    if (e.name.endsWith("(Accel)")) promotedSummary.accel++;
    else promotedSummary.general_catalyst++;
  }

  // STAGE 3: Add Greylock as low priority
  const added: string[] = [];
  const skipped: string[] = [];

  for (const item of GREYLOCK_BATCH_2026_05_12) {
    const norm = normalize(item.finalName);
    if (existing.has(norm)) {
      skipped.push(item.finalName);
      continue;
    }
    await addEntry({
      name: item.finalName,
      status: "targeting",
      priority: "low",
      type: item.type,
      domain: item.domain,
      notes: "Greylock portfolio · May 12 2026 batch · secondary priority",
      targetedAt: now,
    });
    added.push(item.finalName);
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
      final_tried_count: final.filter((e) => e.status === "tried").length,
    },
    stage_1_marked_tried: {
      total: triedSummary.thrive + triedSummary.index,
      ...triedSummary,
    },
    stage_2_promoted: {
      total: promotedSummary.accel + promotedSummary.general_catalyst,
      ...promotedSummary,
    },
    stage_3_added: {
      total: added.length,
      skipped: skipped.length,
    },
    skipped,
  });
}
