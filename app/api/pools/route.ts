import { NextRequest, NextResponse } from "next/server";
import { getEntries, addEntry } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const entries = await getEntries();
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !body.status || !body.type || !body.domain) {
    return NextResponse.json(
      { error: "name, status, type, domain are required" },
      { status: 400 }
    );
  }
  const entry = await addEntry({
    name: body.name,
    status: body.status,
    type: body.type,
    domain: body.domain,
    notes: body.notes,
    // Stamp date if entry is being created directly as a target
    targetedAt: body.status === "targeting" ? Date.now() : undefined,
  });
  return NextResponse.json({ entry });
}
