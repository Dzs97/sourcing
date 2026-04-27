import { NextResponse } from "next/server";
import { getEntries, addEntry } from "@/lib/storage";
import { NEOS_PORTCO_SEED } from "@/lib/portco-seed";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET — dry run. Reports which companies would be added vs. skipped.
 */
export async function GET() {
  const entries = await getEntries();
  const existing = new Set(entries.map((e) => e.name.toLowerCase().trim()));

  const wouldAdd: string[] = [];
  const wouldSkip: Array<{ name: string; reason: string }> = [];

  for (const p of NEOS_PORTCO_SEED) {
    if (existing.has(p.name.toLowerCase().trim())) {
      wouldSkip.push({ name: p.name, reason: "already exists in tracker" });
    } else {
      wouldAdd.push(p.name);
    }
  }

  return NextResponse.json({
    dry_run: true,
    seed_count: NEOS_PORTCO_SEED.length,
    would_add_count: wouldAdd.length,
    would_skip_count: wouldSkip.length,
    would_add: wouldAdd,
    would_skip: wouldSkip,
    instruction:
      "POST to this endpoint to actually add. " +
      "Each will be inserted with status='targeting', domain='neos-portco'. " +
      "Existing entries are not modified.",
  });
}

/**
 * POST — actually adds the missing entries.
 */
export async function POST() {
  const entries = await getEntries();
  const existing = new Set(entries.map((e) => e.name.toLowerCase().trim()));

  const added: string[] = [];
  const skipped: string[] = [];

  for (const p of NEOS_PORTCO_SEED) {
    if (existing.has(p.name.toLowerCase().trim())) {
      skipped.push(p.name);
      continue;
    }
    await addEntry({
      name: p.name,
      status: "targeting",
      type: p.type,
      domain: "neos-portco",
      notes: p.note
        ? `Neo's PortCo · ${p.subdomain} · ${p.note}`
        : `Neo's PortCo · ${p.subdomain}`,
      targetedAt: Date.now(),
    });
    added.push(p.name);
  }

  const final = await getEntries();
  return NextResponse.json({
    ok: true,
    added_count: added.length,
    skipped_count: skipped.length,
    final_db_count: final.length,
    final_targeting_count: final.filter((e) => e.status === "targeting").length,
    sample_added: added.slice(0, 30),
    skipped,
  });
}
