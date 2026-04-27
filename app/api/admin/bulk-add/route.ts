import { NextResponse } from "next/server";
import { getEntries, addEntry } from "@/lib/storage";
import { BULK_ADD_ENTRIES, BULK_ADD_VERSION } from "@/lib/seed-bulk-add";

export const dynamic = "force-dynamic";

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Idempotent bulk-add: walks BULK_ADD_ENTRIES and adds each one to the
 * tracker if (and only if) it isn't already present.
 *
 * GET: dry-run preview — shows what would be added without writing
 * POST: actually applies the changes
 */
async function compute() {
  const entries = await getEntries();
  const existing = new Set(entries.map((e) => normalize(e.name)));

  const toAdd: typeof BULK_ADD_ENTRIES = [];
  const skipped: string[] = [];

  for (const item of BULK_ADD_ENTRIES) {
    if (existing.has(normalize(item.name))) {
      skipped.push(item.name);
    } else {
      toAdd.push(item);
    }
  }

  return { entries, toAdd, skipped };
}

export async function GET() {
  const { entries, toAdd, skipped } = await compute();

  return NextResponse.json({
    dry_run: true,
    version: BULK_ADD_VERSION,
    current_db_count: entries.length,
    bulk_add_total: BULK_ADD_ENTRIES.length,
    would_add_count: toAdd.length,
    skipped_count: skipped.length,
    skipped_sample: skipped.slice(0, 20),
    would_add_sample: toAdd.slice(0, 20).map((t) => ({
      name: t.name,
      type: t.type,
      domain: t.domain,
      notes: t.notes,
    })),
    instruction: "POST to apply.",
  });
}

export async function POST() {
  const { toAdd, skipped } = await compute();

  const added: string[] = [];
  for (const item of toAdd) {
    await addEntry({
      name: item.name,
      status: "new",
      type: item.type,
      domain: item.domain,
      notes: item.notes,
    });
    added.push(item.name);
  }

  const final = await getEntries();
  return NextResponse.json({
    ok: true,
    version: BULK_ADD_VERSION,
    added_count: added.length,
    skipped_count: skipped.length,
    final_db_count: final.length,
    added,
    skipped,
  });
}
