import { NextResponse } from "next/server";
import { parseCsv, toCsvExportUrl } from "@/lib/sheet-csv";
import { rowsFromCsv, computeYields } from "@/lib/pool-yield";

/**
 * GET /api/sheet-sync
 *   Fetches the configured NEXT_PUBLIC_HANDOFF_SHEET_URL as CSV, parses,
 *   returns per-pool yields + candidate rows.
 *
 * Query params:
 *   ?url=<sheet URL>   — override the configured sheet (for ad-hoc testing)
 *
 * Response:
 *   { ok: true, updated_at, sheet_url, pools: PoolYield[], total: number }
 *   { ok: false, error: string, missing?: string }  (400/500/502)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const override = url.searchParams.get("url");
  const sheetUrl = override || process.env.NEXT_PUBLIC_HANDOFF_SHEET_URL || "";
  if (!sheetUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "Sheet URL not configured.",
        missing: "NEXT_PUBLIC_HANDOFF_SHEET_URL",
      },
      { status: 400 }
    );
  }

  let csvUrl: string;
  try {
    csvUrl = toCsvExportUrl(sheetUrl);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(csvUrl, {
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Sheet fetch returned ${res.status}. Is it link-viewable?`,
        },
        { status: 502 }
      );
    }
    const text = await res.text();
    if (text.startsWith("<") || text.includes("<html")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sheet returned HTML, not CSV. Change share setting to \"Anyone with the link → Viewer\" and try again.",
        },
        { status: 403 }
      );
    }
    const cells = parseCsv(text);
    const rows = rowsFromCsv(cells);
    const pools = computeYields(rows);

    return NextResponse.json({
      ok: true,
      updated_at: Date.now(),
      sheet_url: sheetUrl,
      pools,
      total: rows.length,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
