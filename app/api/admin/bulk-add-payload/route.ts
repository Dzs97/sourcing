import { NextRequest, NextResponse } from "next/server";
import { getEntries, addEntry } from "@/lib/storage";
import type { Domain, EntryType, Status } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_DOMAINS: Domain[] = [
  "frontier-ai", "healthcare-ai", "insurtech", "defense", "infra-devtools",
  "bio-ai", "research-lab", "fintech", "vertical-saas", "cs-school",
  "elite-hs", "fellowship", "olympiad", "open-source", "neos-portco", "other",
];
const VALID_TYPES: EntryType[] = ["company", "school", "community", "competition"];
const VALID_STATUSES: Status[] = ["new", "targeting", "tried", "blacklisted"];

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

interface PayloadItem {
  name: string;
  type?: EntryType;
  domain?: Domain;
  status?: Status;
  notes?: string;
}

export async function POST(req: NextRequest) {
  let body: { entries?: PayloadItem[]; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const items = body.entries;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Body must include non-empty `entries` array" },
      { status: 400 }
    );
  }

  const invalid: Array<{ index: number; reason: string }> = [];
  const normalizedItems: Array<{
    name: string;
    type: EntryType;
    domain: Domain;
    status: Status;
    notes?: string;
  }> = [];

  items.forEach((item, idx) => {
    if (!item || typeof item.name !== "string" || !item.name.trim()) {
      invalid.push({ index: idx, reason: "missing name" });
      return;
    }
    const type = (item.type ?? "company") as EntryType;
    const domain = (item.domain ?? "other") as Domain;
    const status = (item.status ?? "new") as Status;
    if (!VALID_TYPES.includes(type)) {
      invalid.push({ index: idx, reason: `invalid type: ${type}` });
      return;
    }
    if (!VALID_DOMAINS.includes(domain)) {
      invalid.push({ index: idx, reason: `invalid domain: ${domain}` });
      return;
    }
    if (!VALID_STATUSES.includes(status)) {
      invalid.push({ index: idx, reason: `invalid status: ${status}` });
      return;
    }
    normalizedItems.push({
      name: item.name.trim(),
      type,
      domain,
      status,
      notes: item.notes?.trim() || undefined,
    });
  });

  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", invalid },
      { status: 400 }
    );
  }

  const existing = await getEntries();
  const existingNames = new Set(existing.map((e) => normalize(e.name)));

  const seenInPayload = new Set<string>();
  const toAdd: typeof normalizedItems = [];
  const skippedAlreadyInDb: string[] = [];
  const skippedDuplicateInPayload: string[] = [];

  for (const item of normalizedItems) {
    const key = normalize(item.name);
    if (existingNames.has(key)) {
      skippedAlreadyInDb.push(item.name);
    } else if (seenInPayload.has(key)) {
      skippedDuplicateInPayload.push(item.name);
    } else {
      seenInPayload.add(key);
      toAdd.push(item);
    }
  }

  if (body.dryRun) {
    return NextResponse.json({
      dry_run: true,
      current_db_count: existing.length,
      payload_count: normalizedItems.length,
      would_add_count: toAdd.length,
      skipped_already_in_db: skippedAlreadyInDb,
      skipped_duplicate_in_payload: skippedDuplicateInPayload,
      would_add: toAdd,
      instruction: "POST again with dryRun:false (or omitted) to apply.",
    });
  }

  const added: string[] = [];
  for (const item of toAdd) {
    await addEntry({
      name: item.name,
      status: item.status,
      type: item.type,
      domain: item.domain,
      notes: item.notes,
      targetedAt: item.status === "targeting" ? Date.now() : undefined,
    });
    added.push(item.name);
  }

  const final = await getEntries();
  return NextResponse.json({
    ok: true,
    added_count: added.length,
    skipped_already_in_db_count: skippedAlreadyInDb.length,
    skipped_duplicate_in_payload_count: skippedDuplicateInPayload.length,
    final_db_count: final.length,
    added,
    skipped_already_in_db: skippedAlreadyInDb,
    skipped_duplicate_in_payload: skippedDuplicateInPayload,
  });
}
