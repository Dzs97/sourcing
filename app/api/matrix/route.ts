import { NextRequest, NextResponse } from "next/server";
import { addItems, getAdditions, removeItem } from "@/lib/matrix-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getAdditions();
  return NextResponse.json(data);
}

// POST { function, role, group, items: string[] } — appends items
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { function: fn, role, group, items } = body ?? {};
  if (typeof fn !== "string" || typeof role !== "string" || typeof group !== "string") {
    return NextResponse.json(
      { error: "function, role, group required" },
      { status: 400 }
    );
  }
  const arr: string[] = Array.isArray(items)
    ? items
    : typeof items === "string"
    ? [items]
    : [];
  const updated = await addItems(fn, role, group, arr);
  return NextResponse.json(updated);
}

// DELETE { function, role, group, item } — removes a single item
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { function: fn, role, group, item } = body ?? {};
  if (
    typeof fn !== "string" ||
    typeof role !== "string" ||
    typeof group !== "string" ||
    typeof item !== "string"
  ) {
    return NextResponse.json(
      { error: "function, role, group, item required" },
      { status: 400 }
    );
  }
  const updated = await removeItem(fn, role, group, item);
  return NextResponse.json(updated);
}
