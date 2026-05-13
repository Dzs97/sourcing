import { NextResponse } from "next/server";
import { getEntries, updateEntry } from "@/lib/storage";
import { logDailyAction } from "@/lib/history-storage";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Cleanup operation (May 13 2026).
 *
 * Two-stage in one POST:
 *   1. MARK AS TRIED: All targeting entries ending in "(Accel)" or
 *      "(General Catalyst)" → status="tried". Logged to daily-activity history.
 *      (Decision: not pursuing these portfolios.)
 *   2. PROMOTE: All targeting entries ending in "(Greylock)" with priority="low"
 *      → priority="high" (Secondary → Primary).
 *
 * Idempotent. Does not touch any entries outside these patterns.
 */

export async function GET() {
  const entries = await getEntries();

  const triedCandidates = entries.filter(
    (e) =>
      e.status === "targeting" &&
      (e.name.endsWith("(Accel)") ||
        e.name.endsWith("(General Catalyst)"))
  );

  const promotionCandidates = entries.filter(
    (e) =>
      e.status === "targeting" &&
      (e.priority ?? "high") === "low" &&
      e.name.endsWith("(Greylock)")
  );

  const currentTargeting = entries.filter((e) => e.status === "targeting");
  const currentPrimary = currentTargeting.filter(
    (e) => (e.priority ?? "high") === "high"
  ).length;
  const currentSecondary = currentTargeting.filter(
    (e) => e.priority === "low"
  ).length;
  const currentTried = entries.filter((e) => e.status === "tried").length;

  return NextResponse.json({
    dry_run: true,
    current_state: {
      targeting_total: currentTargeting.length,
      targeting_primary: currentPrimary,
      targeting_secondary: currentSecondary,
      tried_total: currentTried,
    },
    stage_1_mark_tried: {
      total: triedCandidates.length,
      accel: triedCandidates.filter((e) => e.name.endsWith("(Accel)")).length,
      general_catalyst: triedCandidates.filter((e) =>
        e.name.endsWith("(General Catalyst)")
      ).length,
      sample_first_10: triedCandidates.slice(0, 10).map((e) => e.name),
    },
    stage_2_promote_greylock: {
      total: promotionCandidates.length,
      sample_first_10: promotionCandidates.slice(0, 10).map((e) => e.name),
    },
    projected_final_state: {
      targeting_total: currentTargeting.length - triedCandidates.length,
      targeting_primary:
        currentPrimary -
        triedCandidates.filter((e) => (e.priority ?? "high") === "high")
          .length +
        promotionCandidates.length,
      targeting_secondary:
        currentSecondary -
        triedCandidates.filter((e) => e.priority === "low").length -
        promotionCandidates.length,
      tried_total: currentTried + triedCandidates.length,
    },
    instruction:
      "POST to apply. Two-stage operation: " +
      "(1) marks all (Accel)/(General Catalyst) targeting entries as 'tried' " +
      "(logged to daily activity), " +
      "(2) promotes (Greylock) Secondary → Primary. Idempotent.",
  });
}

export async function POST() {
  const initial = await getEntries();

  // STAGE 1: Mark Accel/GC targeting → tried
  const triedTargets = initial.filter(
    (e) =>
      e.status === "targeting" &&
      (e.name.endsWith("(Accel)") ||
        e.name.endsWith("(General Catalyst)"))
  );
  const triedSummary = { accel: 0, general_catalyst: 0 };
  for (const e of triedTargets) {
    await updateEntry(e.id, { status: "tried" });
    await logDailyAction({
      name: e.name,
      type: e.type,
      domain: e.domain,
      fromStatus: "targeting",
      toStatus: "tried",
    });
    if (e.name.endsWith("(Accel)")) triedSummary.accel++;
    else triedSummary.general_catalyst++;
  }

  // STAGE 2: Promote Greylock low → high
  const promotionTargets = initial.filter(
    (e) =>
      e.status === "targeting" &&
      (e.priority ?? "high") === "low" &&
      e.name.endsWith("(Greylock)")
  );
  let promotedCount = 0;
  for (const e of promotionTargets) {
    await updateEntry(e.id, { priority: "high" });
    promotedCount++;
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
      total: triedSummary.accel + triedSummary.general_catalyst,
      ...triedSummary,
    },
    stage_2_promoted_greylock: {
      total: promotedCount,
    },
  });
}
