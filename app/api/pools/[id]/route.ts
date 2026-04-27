import { NextRequest, NextResponse } from "next/server";
import { getEntries, updateEntry, deleteEntry } from "@/lib/storage";
import { logDailyAction } from "@/lib/history-storage";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Capture the BEFORE state so we can log status transitions accurately.
  const before = (await getEntries()).find((e) => e.id === id);

  // If this PATCH promotes an entry to "targeting", stamp the date.
  if (body.status === "targeting" && !body.targetedAt) {
    body.targetedAt = Date.now();
  }

  const updated = await updateEntry(id, body);
  if (!updated) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  // Log to daily-activity history if status actually changed.
  // Captures both forward moves (✓ targeting→tried, ✕ targeting→blacklisted)
  // and reverse moves (un-blacklist, recovering a misclick, etc.)
  if (before && before.status !== updated.status) {
    await logDailyAction({
      name: updated.name,
      type: updated.type,
      domain: updated.domain,
      fromStatus: before.status,
      toStatus: updated.status,
    });
  }

  return NextResponse.json({ entry: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = await deleteEntry(id);
  if (!ok) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
