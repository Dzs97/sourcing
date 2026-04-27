import { NextRequest, NextResponse } from "next/server";
import { getRankings, saveRankings, clearRankings } from "@/lib/rankings-storage";
import { parseRankingsWorkbook } from "@/lib/rankings-parser";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const bundle = await getRankings();
  return NextResponse.json({ bundle });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Send a multipart/form-data request with a file under the 'file' field" },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "No file uploaded under the 'file' field" },
      { status: 400 }
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 10MB)" },
      { status: 413 }
    );
  }

  let bundle;
  try {
    const buffer = await file.arrayBuffer();
    bundle = parseRankingsWorkbook(buffer);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to parse file: ${err?.message ?? "unknown"}` },
      { status: 400 }
    );
  }

  if (bundle.rankings.length === 0) {
    return NextResponse.json(
      {
        error:
          "No rankings rows found. Make sure the file has a 'Rankings' sheet with the expected columns.",
      },
      { status: 400 }
    );
  }

  await saveRankings(bundle);

  return NextResponse.json({
    ok: true,
    summary: {
      rankings_count: bundle.rankings.length,
      recency_count: bundle.recency.length,
      source_as_of: bundle.source_as_of,
      uploaded_at: bundle.uploaded_at,
    },
  });
}

export async function DELETE() {
  await clearRankings();
  return NextResponse.json({ ok: true });
}
