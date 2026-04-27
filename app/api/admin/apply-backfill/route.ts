import { NextResponse } from "next/server";
import { getEntries, addEntry } from "@/lib/storage";
import { SEED_ENTRIES } from "@/lib/seed";

export const dynamic = "force-dynamic";

// Aliases between Rankings names and tracker names — used to detect
// when a "new" backfill entry is actually an already-tracked company
// under a different name.
const RANKINGS_ALIASES: Record<string, string> = {
  "Anduril Industries": "Anduril",
  "Cursor": "Cursor (Anysphere)",
  "Anysphere": "Cursor (Anysphere)",
  "Codeium": "Codeium / Windsurf",
  "Windsurf": "Codeium / Windsurf",
  "Sentry (sentry.io)": "Sentry",
  "Snap Inc.": "Snap",
  "Perplexity AI": "Perplexity",
  "Temporal Technologies": "Temporal",
  "Bloomberg LP": "Bloomberg",
  "Amazon Web Services (AWS)": "AWS",
  "Nvidia": "NVIDIA",
  "Massachusetts Institute of Technology": "MIT",
  "Stanford University": "Stanford",
  "Princeton University": "Princeton",
  "Columbia University": "Columbia",
  "Yale University": "Yale",
  "Brown University": "Brown",
  "Duke University": "Duke",
  "Rice University": "Rice",
  "Cornell University": "Cornell",
  "University of Waterloo": "Waterloo",
};

function isAlreadyInDb(name: string, dbNames: Set<string>): boolean {
  if (dbNames.has(name.toLowerCase())) return true;
  const aliased = RANKINGS_ALIASES[name];
  if (aliased && dbNames.has(aliased.toLowerCase())) return true;
  return false;
}

/**
 * Returns the set of entries that exist in SEED_ENTRIES but NOT yet in Redis.
 * Used to compute what to add when applying the backfill to an existing DB.
 */
function computeMissingFromSeed(currentEntries: Awaited<ReturnType<typeof getEntries>>) {
  const dbNames = new Set(currentEntries.map((e) => e.name.toLowerCase()));
  const missing = SEED_ENTRIES.filter(
    (s) => !isAlreadyInDb(s.name, dbNames)
  );
  return missing;
}

export async function GET() {
  const entries = await getEntries();
  const missing = computeMissingFromSeed(entries);

  return NextResponse.json({
    dry_run: true,
    current_db_count: entries.length,
    seed_count: SEED_ENTRIES.length,
    would_add_count: missing.length,
    would_add_sample: missing.slice(0, 20).map((m) => ({
      name: m.name,
      status: m.status,
      type: m.type,
      domain: m.domain,
      notes: m.notes,
    })),
    instruction:
      "POST to this endpoint to add all missing entries to Redis. " +
      "Existing entries are NOT modified.",
  });
}

export async function POST() {
  const entries = await getEntries();
  const missing = computeMissingFromSeed(entries);

  const added: string[] = [];
  for (const m of missing) {
    await addEntry({
      name: m.name,
      status: m.status,
      type: m.type,
      domain: m.domain,
      notes: m.notes,
    });
    added.push(m.name);
  }

  const final = await getEntries();
  return NextResponse.json({
    ok: true,
    added_count: added.length,
    final_db_count: final.length,
    sample_added: added.slice(0, 20),
  });
}
