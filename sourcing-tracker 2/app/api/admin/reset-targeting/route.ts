import { NextRequest, NextResponse } from "next/server";
import { getEntries, saveEntries, addEntry } from "@/lib/storage";
import type { Entry, EntryType, Domain } from "@/lib/types";

export const dynamic = "force-dynamic";

// The canonical targeting list — exactly 41 entries
const TARGETING_LIST: Array<{
  name: string;
  type: EntryType;
  domain: Domain;
}> = [
  // Frontier AI labs (8)
  { name: "Black Forest Labs", type: "company", domain: "frontier-ai" },
  { name: "Runway", type: "company", domain: "frontier-ai" },
  { name: "Ideogram", type: "company", domain: "frontier-ai" },
  { name: "Suno", type: "company", domain: "frontier-ai" },
  { name: "Liquid AI", type: "company", domain: "frontier-ai" },
  { name: "World Labs", type: "company", domain: "frontier-ai" },
  { name: "Reka AI", type: "company", domain: "frontier-ai" },
  { name: "Magic", type: "company", domain: "frontier-ai" },

  // Healthcare AI (17)
  { name: "PathAI", type: "company", domain: "healthcare-ai" },
  { name: "Paige.AI", type: "company", domain: "healthcare-ai" },
  { name: "Hippocratic AI", type: "company", domain: "healthcare-ai" },
  { name: "Abridge", type: "company", domain: "healthcare-ai" },
  { name: "Ambience Healthcare", type: "company", domain: "healthcare-ai" },
  { name: "OpenEvidence", type: "company", domain: "healthcare-ai" },
  { name: "Suki AI", type: "company", domain: "healthcare-ai" },
  { name: "Color Health", type: "company", domain: "healthcare-ai" },
  { name: "Verily", type: "company", domain: "healthcare-ai" },
  { name: "Recursion Pharmaceuticals", type: "company", domain: "bio-ai" },
  { name: "Insitro", type: "company", domain: "bio-ai" },
  { name: "Profluent", type: "company", domain: "bio-ai" },
  { name: "Genesis Therapeutics", type: "company", domain: "bio-ai" },
  { name: "Nuance Communications", type: "company", domain: "healthcare-ai" },
  { name: "Nabla", type: "company", domain: "healthcare-ai" },
  { name: "Heidi Health", type: "company", domain: "healthcare-ai" },
  { name: "Akasa", type: "company", domain: "healthcare-ai" },

  // InsurTech (2)
  { name: "Lemonade", type: "company", domain: "insurtech" },
  { name: "Hippo", type: "company", domain: "insurtech" },

  // Defense / frontier hardware (8)
  { name: "SpaceX", type: "company", domain: "defense" },
  { name: "Anduril", type: "company", domain: "defense" },
  { name: "Saronic Technologies", type: "company", domain: "defense" },
  { name: "Skydio", type: "company", domain: "defense" },
  { name: "Shield AI", type: "company", domain: "defense" },
  { name: "Vannevar Labs", type: "company", domain: "defense" },
  { name: "Rebellion Defense", type: "company", domain: "defense" },
  { name: "RTX", type: "company", domain: "defense" },

  // Infra / devtools (4)
  { name: "Supabase", type: "company", domain: "infra-devtools" },
  { name: "Neon", type: "company", domain: "infra-devtools" },
  { name: "PlanetScale", type: "company", domain: "infra-devtools" },
  { name: "Turbopuffer", type: "company", domain: "infra-devtools" },
];

function normalizeName(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function POST(_req: NextRequest) {
  const entries = await getEntries();
  const targetSet = new Set(TARGETING_LIST.map((t) => normalizeName(t.name)));

  const report = {
    demoted: [] as string[], // were targeting, now new
    promoted: [] as string[], // were new/tried, now targeting
    added: [] as string[], // didn't exist, now added as targeting
    unchanged_targeting: [] as string[],
  };

  // Pass 1: walk existing entries, set status correctly
  const updated: Entry[] = entries.map((e) => {
    const isInTargetList = targetSet.has(normalizeName(e.name));

    if (isInTargetList && e.status !== "targeting") {
      report.promoted.push(e.name);
      return { ...e, status: "targeting" as const };
    }
    if (!isInTargetList && e.status === "targeting") {
      report.demoted.push(e.name);
      return { ...e, status: "new" as const };
    }
    if (isInTargetList && e.status === "targeting") {
      report.unchanged_targeting.push(e.name);
    }
    return e;
  });

  await saveEntries(updated);

  // Pass 2: add any entries from the canonical list that aren't in the DB at all
  const existingNames = new Set(updated.map((e) => normalizeName(e.name)));
  for (const target of TARGETING_LIST) {
    if (!existingNames.has(normalizeName(target.name))) {
      await addEntry({
        name: target.name,
        status: "targeting",
        type: target.type,
        domain: target.domain,
      });
      report.added.push(target.name);
    }
  }

  // Final count
  const final = await getEntries();
  const finalTargeting = final.filter((e) => e.status === "targeting").length;

  return NextResponse.json({
    ok: true,
    summary: {
      final_targeting_count: finalTargeting,
      expected: TARGETING_LIST.length,
      match: finalTargeting === TARGETING_LIST.length,
    },
    report,
  });
}

// GET shows what would happen without making changes (dry run)
export async function GET() {
  const entries = await getEntries();
  const targetSet = new Set(TARGETING_LIST.map((t) => normalizeName(t.name)));

  const wouldDemote: string[] = [];
  const wouldPromote: string[] = [];
  const wouldAdd: string[] = [];
  const alreadyCorrect: string[] = [];

  for (const e of entries) {
    const inList = targetSet.has(normalizeName(e.name));
    if (inList && e.status !== "targeting") wouldPromote.push(e.name);
    else if (!inList && e.status === "targeting") wouldDemote.push(e.name);
    else if (inList && e.status === "targeting") alreadyCorrect.push(e.name);
  }

  const existingNames = new Set(entries.map((e) => normalizeName(e.name)));
  for (const t of TARGETING_LIST) {
    if (!existingNames.has(normalizeName(t.name))) wouldAdd.push(t.name);
  }

  return NextResponse.json({
    dry_run: true,
    would_promote: wouldPromote,
    would_demote: wouldDemote,
    would_add: wouldAdd,
    already_correct: alreadyCorrect,
    instruction: "POST to this endpoint to apply changes",
  });
}
