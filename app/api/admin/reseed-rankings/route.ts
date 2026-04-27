import { NextResponse } from "next/server";
import { saveRankings } from "@/lib/rankings-storage";
import { SEED_RANKINGS } from "@/lib/seed-rankings";

export const dynamic = "force-dynamic";

export async function POST() {
  const seeded = { ...SEED_RANKINGS, uploaded_at: Date.now() };
  await saveRankings(seeded);
  return NextResponse.json({
    ok: true,
    summary: {
      rankings_count: seeded.rankings.length,
      recency_count: seeded.recency.length,
      source_as_of: seeded.source_as_of,
    },
  });
}

export async function GET() {
  return NextResponse.json({
    rankings_count: SEED_RANKINGS.rankings.length,
    recency_count: SEED_RANKINGS.recency.length,
    source_as_of: SEED_RANKINGS.source_as_of,
    note: "POST to this endpoint to overwrite Redis with the bundled snapshot.",
  });
}
