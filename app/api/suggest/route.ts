import { NextRequest, NextResponse } from "next/server";
import { getEntries } from "@/lib/storage";
import { generateSuggestions } from "@/lib/suggest";
import type { EntryType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const filterType = req.nextUrl.searchParams.get("type") as EntryType | null;
  const entries = await getEntries();
  const suggestions = generateSuggestions(entries, filterType ?? undefined);
  return NextResponse.json({ suggestions });
}
