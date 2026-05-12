import { NextResponse } from "next/server";
import { getEntries, addEntry } from "@/lib/storage";
import { GREYLOCK_BATCH_2026_05_12 } from "@/lib/greylock-batch-seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Greylock Partners portfolio batch (May 12 2026).
 *
 * Behavior:
 *   - Adds entries with status='targeting' and priority='low' (Secondary targets tier).
 *   - Mixed in with existing GC + Accel secondary entries.
 *   - Idempotent — skips any whose normalized name is already in the DB.
 *   - Add-only — does not archive/demote/promote anything else.
 */

export async function GET() {
  const entries = await getEntries();
  const existing = new Set(entries.map((e) => normalize(e.name)));

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
  return NextResponse.json({
    dry_run: true,
    current_targeting_total: currentTargeting.length,
    current_targeting_primary: currentTargeting.filter(
      (e) => (e.priority ?? "high") === "high"
    ).length,
    current_targeting_secondary: currentTargeting.filter(
      (e) => e.priority === "low"
    ).length,
    seed_total: GREYLOCK_BATCH_2026_05_12.length,
    would_add_count: wouldAdd.length,
    skipped_count: skipped.length,
    final_targeting_after: currentTargeting.length + wouldAdd.length,
    final_secondary_after:
      currentTargeting.filter((e) => e.priority === "low").length +
      wouldAdd.length,
    sample_first_20: wouldAdd.slice(0, 20),
    skipped,
    instruction:
      "POST to apply. Adds all entries as 'targeting' with priority='low' (Secondary tier). " +
      "Idempotent and add-only.",
  });
}

export async function POST() {
  const now = Date.now();
  const initial = await getEntries();
  const existing = new Set(initial.map((e) => normalize(e.name)));

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
    },
    added_count: added.length,
    skipped_count: skipped.length,
    skipped,
  });
}
