import { NextRequest, NextResponse } from "next/server";
import { getEntries, saveEntries, addEntry } from "@/lib/storage";
import type { Entry, EntryType, Domain } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ApplyPayload {
  selected: Array<{
    name: string;
    type: EntryType;
    domain: Domain;
  }>;
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function POST(req: NextRequest) {
  let body: ApplyPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.selected) || body.selected.length === 0) {
    return NextResponse.json(
      { error: "No selections provided" },
      { status: 400 }
    );
  }

  const entries = await getEntries();
  const selectedNames = new Set(body.selected.map((s) => normalize(s.name)));

  const report = {
    demoted_to_tried: [] as string[],
    promoted_to_targeting: [] as string[],
    added_new: [] as string[],
  };

  // Pass 1: walk existing entries
  const updated: Entry[] = entries.map((e) => {
    // Old targeting → tried (auto-mark as tried per user setting)
    if (e.status === "targeting") {
      report.demoted_to_tried.push(e.name);
      return { ...e, status: "tried" as const };
    }
    // Selected entries that already exist → promote to targeting
    if (selectedNames.has(normalize(e.name)) && e.status !== "blacklisted") {
      report.promoted_to_targeting.push(e.name);
      return { ...e, status: "targeting" as const };
    }
    return e;
  });

  await saveEntries(updated);

  // Pass 2: add brand-new entries from selections that aren't in DB yet
  const existingNames = new Set(updated.map((e) => normalize(e.name)));
  for (const sel of body.selected) {
    if (!existingNames.has(normalize(sel.name))) {
      await addEntry({
        name: sel.name,
        status: "targeting",
        type: sel.type,
        domain: sel.domain,
      });
      report.added_new.push(sel.name);
    }
  }

  const final = await getEntries();
  return NextResponse.json({
    ok: true,
    summary: {
      final_targeting_count: final.filter((e) => e.status === "targeting").length,
      final_tried_count: final.filter((e) => e.status === "tried").length,
    },
    report,
  });
}
