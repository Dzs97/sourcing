import { NextResponse } from "next/server";
import {
  getEntries,
  saveEntries,
  addEntry,
  deleteEntry,
} from "@/lib/storage";
import { appendCohort } from "@/lib/history-storage";
import type { Entry, TargetingCohort } from "@/lib/types";
import { NEXT_BATCH_2026_05_01 } from "@/lib/next-batch-may1-seed";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * GET — dry run. Reports what would happen without changing any data.
 */
export async function GET() {
  const entries = await getEntries();
  const byNorm = new Map(entries.map((e) => [normalize(e.name), e]));

  const renames: Array<{ from: string; to: string; found: boolean }> = [];
  const newAdds: string[] = [];
  const skipped: string[] = [];

  for (const item of NEXT_BATCH_2026_05_01) {
    if (item.renameFrom) {
      const existing = byNorm.get(normalize(item.renameFrom));
      if (byNorm.has(normalize(item.finalName))) {
        skipped.push(`${item.finalName} (already exists)`);
        continue;
      }
      renames.push({
        from: item.renameFrom,
        to: item.finalName,
        found: !!existing,
      });
    } else {
      if (byNorm.has(normalize(item.finalName))) {
        skipped.push(`${item.finalName} (already exists)`);
        continue;
      }
      newAdds.push(item.finalName);
    }
  }

  const currentTargeting = entries.filter((e) => e.status === "targeting");

  return NextResponse.json({
    dry_run: true,
    current_targeting_count: currentTargeting.length,
    renames_count: renames.length,
    new_adds_count: newAdds.length,
    skipped_count: skipped.length,
    renames,
    new_adds: newAdds,
    skipped,
    instruction:
      "POST to this endpoint to apply: archives current targeting to history, " +
      "then adds the new entries as targeting.",
  });
}

/**
 * POST — applies the batch.
 *
 * Steps:
 *   1. Archive current targeting cohort to history (if any).
 *   2. Demote all current targeting → tried.
 *   3. For each rename: delete old entry, add new entry as targeting.
 *      If old entry not found, just add the new entry as targeting.
 *   4. For each brand-new: add as targeting.
 *
 * Idempotent — safe to re-run.
 */
export async function POST() {
  const now = Date.now();
  const initialEntries = await getEntries();

  const report = {
    archived_cohort_size: 0,
    demoted_to_tried: [] as string[],
    renamed: [] as Array<{ from: string; to: string }>,
    added_new: [] as string[],
    skipped: [] as string[],
  };

  // STEP 1: Archive current targeting cohort to history
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

  // STEP 3 + 4: process each batch item
  let working = await getEntries();
  const finalNamesAlreadyDone = new Set<string>();

  for (const item of NEXT_BATCH_2026_05_01) {
    const finalNorm = normalize(item.finalName);

    const existsByFinal = working.find(
      (e) => normalize(e.name) === finalNorm
    );
    if (existsByFinal || finalNamesAlreadyDone.has(finalNorm)) {
      report.skipped.push(`${item.finalName} (already exists)`);
      continue;
    }

    if (item.renameFrom) {
      const oldEntry = working.find(
        (e) => normalize(e.name) === normalize(item.renameFrom!)
      );
      if (oldEntry) {
        await deleteEntry(oldEntry.id);
        report.renamed.push({ from: item.renameFrom, to: item.finalName });
      } else {
        report.added_new.push(item.finalName);
      }
    } else {
      report.added_new.push(item.finalName);
    }

    await addEntry({
      name: item.finalName,
      status: "targeting",
      type: item.type,
      domain: item.domain,
      notes: item.note,
      targetedAt: now,
    });

    finalNamesAlreadyDone.add(finalNorm);
    working = await getEntries();
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
