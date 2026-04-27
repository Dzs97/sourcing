import { NextResponse } from "next/server";
import { getHistory } from "@/lib/history-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const history = await getHistory();
  // Newest first
  const sorted = [...history].sort((a, b) => b.archivedAt - a.archivedAt);
  return NextResponse.json({ history: sorted });
}
