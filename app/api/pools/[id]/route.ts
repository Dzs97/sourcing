import { NextRequest, NextResponse } from "next/server";
import { updateEntry, deleteEntry } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // If this PATCH promotes an entry to "targeting", stamp the date.
  // The /api/batch/apply route also does this, but this covers manual
  // promotions from the UI (e.g., the Rankings tab "+ Target" button,
  // or manually changing status in the entry card).
  if (body.status === "targeting" && !body.targetedAt) {
    body.targetedAt = Date.now();
  }

  const updated = await updateEntry(id, body);
  if (!updated) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
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
