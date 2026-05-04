import { NextResponse } from "next/server";
import { getEntries, addEntry } from "@/lib/storage";
import { SEQUOIA_BATCH_2026_05_01 } from "@/lib/sequoia-batch-seed";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * GET — dry run.
 *
 * NOTE: Unlike the May 1 batch endpoint, this does NOT archive or demote
 * existing targeting. It just *adds* the Sequoia companies to the targeting
 * pool alongside what's already there. This is intentional given the size
 * of this batch (198 entries) — treating it as a sourcing pool expansion
 * rather than a full batch cycle.
 */
export async function GET() {
  const entries = await getEntries();
  const existing = new Set(entries.map((e) => normalize(e.name)));

  const wouldAdd: string[] = [];
  const skipped: string[] = [];

  for (const item of SEQUOIA_BATCH_2026_05_01) {
    if (existing.has(normalize(item.finalName))) {
      skipped.push(item.finalName);
    } else {
      wouldAdd.push(item.finalName);
    }
  }

  const currentTargeting = entries.filter((e) => e.status === "targeting");

  return NextResponse.json({
    dry_run: true,
    current_targeting_count: currentTargeting.length,
    seed_count: SEQUOIA_BATCH_2026_05_01.length,
    would_add_count: wouldAdd.length,
    skipped_count: skipped.length,
    would_add_sample: wouldAdd.slice(0, 30),
    skipped,
    instruction:
      "POST to apply. Adds all entries as 'targeting' status without archiving " +
      "or demoting current targeting. Idempotent.",
    warning:
      "This will dramatically expand your targeting list. Make sure that's intended.",
  });
}

/**
 * POST — applies the batch.
 *
 * Each entry is added with status='targeting', stamped with today's date.
 * Existing entries (matched by normalized name) are skipped.
 * Idempotent — safe to re-run.
 */
export async function POST() {
  const now = Date.now();
  const initialEntries = await getEntries();
  const existing = new Set(initialEntries.map((e) => normalize(e.name)));

  const added: string[] = [];
  const skipped: string[] = [];

  for (const item of SEQUOIA_BATCH_2026_05_01) {
    if (existing.has(normalize(item.finalName))) {
      skipped.push(item.finalName);
      continue;
    }
    await addEntry({
      name: item.finalName,
      status: "targeting",
      type: item.type,
      domain: item.domain,
      notes: item.note ?? "Sequoia portfolio · May 1 2026 batch",
      targetedAt: now,
    });
    added.push(item.finalName);
    existing.add(normalize(item.finalName));
  }

  const final = await getEntries();
  return NextResponse.json({
    ok: true,
    summary: {
      final_total: final.length,
      final_targeting_count: final.filter((e) => e.status === "targeting")
        .length,
    },
    added_count: added.length,
    skipped_count: skipped.length,
    skipped,
  });
}
