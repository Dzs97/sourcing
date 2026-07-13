import { NextRequest, NextResponse } from "next/server";
import { getEntries, addEntry, updateEntry } from "@/lib/storage";
import type { Domain, Entry, EntryType, Priority, Status } from "@/lib/types";
import { fuzzyName } from "@/lib/name-normalize";

export const dynamic = "force-dynamic";

const VALID_DOMAINS: Domain[] = [
  "frontier-ai", "healthcare-ai", "insurtech", "defense", "infra-devtools",
  "bio-ai", "research-lab", "fintech", "vertical-saas", "cs-school",
  "elite-hs", "fellowship", "olympiad", "open-source", "neos-portco",
  "korea-sourcing", "other",
];
const VALID_TYPES: EntryType[] = ["company", "school", "community", "competition"];
const VALID_STATUSES: Status[] = ["new", "targeting", "tried", "blacklisted"];
const VALID_PRIORITIES: Priority[] = ["high", "low", "tertiary"];

// Shared normalize — see lib/name-normalize.ts
const normalize = fuzzyName;

/**
 * Extract VC tags from an entry. Looks at:
 *   1. The trailing " (VC1, VC2)" suffix on the name
 *   2. The "Also backed by: VC1, VC2" line in notes
 *
 * Used to decide whether a sourceTag is already attributed to an existing entry.
 */
function extractVcTags(entry: Entry): Set<string> {
  const tags = new Set<string>();
  const m = entry.name.match(/\(([^)]+)\)\s*$/);
  if (m) m[1].split(",").map((s) => s.trim()).filter(Boolean).forEach((t) => tags.add(t));
  const noteMatch = (entry.notes ?? "").match(/Also backed by:\s*([^\n]+)/i);
  if (noteMatch) noteMatch[1].split(",").map((s) => s.trim()).filter(Boolean).forEach((t) => tags.add(t));
  return tags;
}

/**
 * Append a VC tag to an entry's "Also backed by:" notes line.
 * Returns the new notes string (or unchanged if the VC was already there).
 */
function appendVcToNotes(existingNotes: string | undefined, newVc: string): string {
  const notes = existingNotes ?? "";
  const markerRegex = /Also backed by:\s*([^\n]+)/i;
  const match = notes.match(markerRegex);
  if (match) {
    const vcs = match[1].split(",").map((s) => s.trim()).filter(Boolean);
    if (vcs.includes(newVc)) return notes;
    const updated = `Also backed by: ${[...vcs, newVc].join(", ")}`;
    return notes.replace(markerRegex, updated);
  }
  const tail = `Also backed by: ${newVc}`;
  return notes.trim() ? `${notes.trim()}\n${tail}` : tail;
}

interface PayloadItem {
  name: string;
  type?: EntryType;
  domain?: Domain;
  status?: Status;
  priority?: Priority;
  notes?: string;
}

export async function POST(req: NextRequest) {
  let body: { entries?: PayloadItem[]; dryRun?: boolean; sourceTag?: string };
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

  const sourceTag = body.sourceTag?.trim();
  const suffix = sourceTag ? ` (${sourceTag})` : "";

  const invalid: Array<{ index: number; reason: string }> = [];
  const normalizedItems: Array<{
    name: string;
    type: EntryType;
    domain: Domain;
    status: Status;
    priority?: Priority;
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
    const priority = item.priority;
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      invalid.push({ index: idx, reason: `invalid priority: ${priority}` });
      return;
    }
    const baseName = item.name.trim();
    const finalName =
      suffix && !baseName.endsWith(suffix) ? baseName + suffix : baseName;
    normalizedItems.push({
      name: finalName,
      type,
      domain,
      status,
      priority,
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
  // Map normalized name -> existing entry so we can update notes on collisions.
  const existingByName = new Map<string, Entry>();
  for (const e of existing) existingByName.set(normalize(e.name), e);

  const seenInPayload = new Set<string>();
  const toAdd: typeof normalizedItems = [];
  const skippedAlreadyInDb: string[] = [];
  const skippedDuplicateInPayload: string[] = [];
  // When sourceTag is set, collisions with a different VC trigger a notes
  // update on the existing entry instead of being silently dropped.
  const crossVcTagged: Array<{ name: string; addedVc: string }> = [];
  const crossVcAlreadyTagged: string[] = [];

  for (const item of normalizedItems) {
    const key = normalize(item.name);
    const collision = existingByName.get(key);
    if (collision) {
      if (sourceTag) {
        const tags = extractVcTags(collision);
        if (tags.has(sourceTag)) {
          crossVcAlreadyTagged.push(collision.name);
        } else {
          crossVcTagged.push({ name: collision.name, addedVc: sourceTag });
        }
      } else {
        skippedAlreadyInDb.push(item.name);
      }
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
      would_cross_vc_tag_count: crossVcTagged.length,
      already_tagged_count: crossVcAlreadyTagged.length,
      skipped_already_in_db: skippedAlreadyInDb,
      skipped_duplicate_in_payload: skippedDuplicateInPayload,
      would_cross_vc_tag: crossVcTagged,
      already_tagged: crossVcAlreadyTagged,
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
      priority: item.priority,
      notes: item.notes,
      targetedAt: item.status === "targeting" ? Date.now() : undefined,
    });
    added.push(item.name);
  }

  // Apply cross-VC notes updates for collisions with a different VC.
  const crossVcUpdated: string[] = [];
  for (const c of crossVcTagged) {
    const entry = existing.find((e) => e.name === c.name);
    if (!entry) continue;
    const newNotes = appendVcToNotes(entry.notes, c.addedVc);
    await updateEntry(entry.id, { notes: newNotes });
    crossVcUpdated.push(c.name);
  }

  const final = await getEntries();
  return NextResponse.json({
    ok: true,
    added_count: added.length,
    cross_vc_tagged_count: crossVcUpdated.length,
    already_tagged_count: crossVcAlreadyTagged.length,
    skipped_already_in_db_count: skippedAlreadyInDb.length,
    skipped_duplicate_in_payload_count: skippedDuplicateInPayload.length,
    final_db_count: final.length,
    added,
    cross_vc_tagged: crossVcUpdated,
    already_tagged: crossVcAlreadyTagged,
    skipped_already_in_db: skippedAlreadyInDb,
    skipped_duplicate_in_payload: skippedDuplicateInPayload,
  });
}
