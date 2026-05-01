import { NextResponse } from "next/server";
import {
  getEntries,
  saveEntries,
  addEntry,
} from "@/lib/storage";
import { appendCohort } from "@/lib/history-storage";
import type { Entry, TargetingCohort } from "@/lib/types";
import { NEXT_BATCH_2026_05_01 } from "@/lib/next-batch-may-1-seed";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function stripVcSuffix(s: string): string {
  return s.replace(/\s*\([^)]+\)\s*$/, "").trim();
}

/**
 * GET — dry run. Reports what would happen without changing any data.
 */
export async function GET() {
  const entries = await getEntries();
  const knownNorms = new Set<string>();
  for (const e of entries) {
    knownNorms.add(normalize(e.name));
    knownNorms.add(normalize(stripVcSuffix(e.name)));
  }

  const wouldAdd: string[] = [];
  const wouldSkip: string[] = [];

  for (const item of NEXT_BATCH_2026_05_01) {
    const finalNorm = normalize(item.finalName);
    const strippedNorm = normalize(stripVcSuffix(item.finalName));
    if (knownNorms.has(finalNorm) || knownNorms.has(strippedNorm)) {
      wouldSkip.push(`${item.finalName} (already exists)`);
    } else {
      wouldAdd.push(item.finalName);
    }
  }

  const currentTargeting = entries.filter((e) => e.status === "targeting");

  return NextResponse.json({
    dry_run: true,
    current_targeting_count: currentTargeting.length,
    would_archive_to_history: currentTargeting.length,
    would_add_count: wouldAdd.length,
    would_skip_count: wouldSkip.length,
    would_add: wouldAdd,
    would_skip: wouldSkip,
    instruction:
      "POST to this endpoint to apply: archives current targeting to history, " +
      "demotes them to tried, and adds the 30 new entries as targeting.",
  });
}

/**
 * POST — applies the batch.
 *   1. Archive current targeting cohort to history (if any).
 *   2. Demote all current targeting → tried.
 *   3. Add the May 1 batch as targeting (skipping any that already exist).
 */
export async function POST() {
  const now = Date.now();
  const initialEntries = await getEntries();

  const report = {
    archived_cohort_size: 0,
    demoted_to_tried: [] as string[],
    added_new: [] as string[],
    skipped: [] as string[],
  };

  // STEP 1: Archive current targeting cohort
  const currentTargets = initialEntries.filter(
    (e) => e.status === "targeting"
  );
  if (currentTargets.length > 0) {
    const cohort: TargetingCohort = {
      id: `cohort-${now}`,
      archivedAt: now,
      kind: "batch-apply",
      entries: currentTargets.map((e) => ({
        name: e.name,
        type: e.type,
        domain: e.domain,
        targetedAt: e.targetedAt,
      })),
      note: `Archived as part of next-batch apply (May 1 2026)`,
    };
    await appendCohort(cohort);
    report.archived_cohort_size = currentTargets.length;
  }

  // STEP 2: Demote all current targeting → tried
  const demoted: Entry[] = initialEntries.map((e) => {
    if (e.status === "targeting") {
      report.demoted_to_tried.push(e.name);
      return { ...e, status: "tried" as const };
    }
    return e;
  });
  await saveEntries(demoted);

  // STEP 3: Add the new batch
  // Re-read entries after demote to get fresh state for dedup
  let working = await getEntries();
  const knownNorms = new Set<string>();
  for (const e of working) {
    knownNorms.add(normalize(e.name));
    knownNorms.add(normalize(stripVcSuffix(e.name)));
  }

  for (const item of NEXT_BATCH_2026_05_01) {
    const finalNorm = normalize(item.finalName);
    const strippedNorm = normalize(stripVcSuffix(item.finalName));
    if (knownNorms.has(finalNorm) || knownNorms.has(strippedNorm)) {
      report.skipped.push(item.finalName);
      continue;
    }
    await addEntry({
      name: item.finalName,
      status: "targeting",
      type: item.type,
      domain: item.domain,
      notes: item.note,
      targetedAt: now,
    });
    report.added_new.push(item.finalName);
    knownNorms.add(finalNorm);
    knownNorms.add(strippedNorm);
  }

  const final = await getEntries();
  return NextResponse.json({
    ok: true,
    summary: {
      final_total: final.length,
      final_targeting_count: final.filter((e) => e.status === "targeting")
        .length,
      final_tried_count: final.filter((e) => e.status === "tried").length,
    },
    report,
  });
}
