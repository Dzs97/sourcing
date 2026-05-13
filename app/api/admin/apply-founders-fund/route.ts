import { NextResponse } from "next/server";
import { getEntries, addEntry } from "@/lib/storage";
import { FOUNDERS_FUND_BATCH_2026_05_13 } from "@/lib/founders-fund-batch-seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Founders Fund portfolio batch (May 13 2026).
 *
 * Behavior:
 *   - Adds 30 net-new entries with status='targeting' and priority='low'
 *     (Secondary tier, below the current Greylock Primary tier).
 *   - Idempotent — skips any whose normalized name is already in the DB
 *     (in case some were added since the dedup was run).
 *   - Add-only — does not promote, demote, or move anything else.
 */

export async function GET() {
  const entries = await getEntries();
  const existing = new Set(entries.map((e) => normalize(e.name)));

  const seenInBatch = new Set<string>();
  const wouldAdd: Array<{ name: string; domain: string }> = [];
  const skipped: Array<{ name: string; reason: string }> = [];

  for (const item of FOUNDERS_FUND_BATCH_2026_05_13) {
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
    current_state: {
      targeting_total: currentTargeting.length,
      targeting_primary: currentTargeting.filter(
        (e) => (e.priority ?? "high") === "high"
      ).length,
      targeting_secondary: currentTargeting.filter(
        (e) => e.priority === "low"
      ).length,
    },
    seed_total: FOUNDERS_FUND_BATCH_2026_05_13.length,
    would_add_count: wouldAdd.length,
    skipped_count: skipped.length,
    projected_final_state: {
      targeting_total: currentTargeting.length + wouldAdd.length,
      targeting_secondary:
        currentTargeting.filter((e) => e.priority === "low").length +
        wouldAdd.length,
    },
    sample_first_20: wouldAdd.slice(0, 20),
    skipped,
    instruction:
      "POST to apply. Adds Founders Fund entries as 'targeting' with priority='low' " +
      "(Secondary tier). Idempotent and add-only.",
  });
}

export async function POST() {
  const now = Date.now();
  const initial = await getEntries();
  const existing = new Set(initial.map((e) => normalize(e.name)));

  const added: string[] = [];
  const skipped: string[] = [];

  for (const item of FOUNDERS_FUND_BATCH_2026_05_13) {
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
      notes: "Founders Fund portfolio · May 13 2026 batch · secondary priority",
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
