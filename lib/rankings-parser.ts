import * as XLSX from "xlsx";
import type { Ranking, RecencyRecord, RankingsBundle } from "./rankings-types";

function toNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/**
 * Parse the Company_Rankings.xlsx structure into a clean bundle.
 * Tolerant of the messy spreadsheet shape:
 *   - Multi-row headers
 *   - Trailing junk columns
 *   - The "Top 10" panel embedded in the Rankings sheet's right side
 */
export function parseRankingsWorkbook(buffer: ArrayBuffer): RankingsBundle {
  const wb = XLSX.read(buffer, { type: "array" });

  const rankings = parseRankingsSheet(wb);
  const recency = parseRecencySheet(wb);
  const { source_as_of, totals } = parseDashboard(wb);

  return {
    uploaded_at: Date.now(),
    source_as_of,
    rankings,
    recency,
    totals,
  };
}

function parseRankingsSheet(wb: XLSX.WorkBook): Ranking[] {
  const ws = wb.Sheets["Rankings"];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  const out: Ranking[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    // Expected: [rank, company, total_score, total_votes, superstar, yes, maybe, no, ...]
    const rank = toNum(row[0]);
    const company = toStr(row[1]);
    if (!company || rank === 0) continue;
    // Skip header row (rank field is text "Rank" or similar)
    if (typeof row[0] === "string" && /rank/i.test(row[0])) continue;

    out.push({
      rank,
      company,
      total_score: toNum(row[2]),
      total_votes: toNum(row[3]),
      superstar: toNum(row[4]),
      yes: toNum(row[5]),
      maybe: toNum(row[6]),
      no: toNum(row[7]),
    });
  }

  return out;
}

function parseRecencySheet(wb: XLSX.WorkBook): RecencyRecord[] {
  const ws = wb.Sheets["Recency"];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  const out: RecencyRecord[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const rank = toNum(row[0]);
    const company = toStr(row[1]);
    if (!company || rank === 0) continue;
    if (typeof row[0] === "string" && /rank/i.test(row[0])) continue;

    out.push({
      rank,
      company,
      median_sourcing_date: toStr(row[2]),
      days_ago: toNum(row[3]),
      num_candidates: toNum(row[4]),
      num_cohorts: toNum(row[5]),
    });
  }

  return out;
}

function parseDashboard(wb: XLSX.WorkBook): {
  source_as_of: string | null;
  totals: RankingsBundle["totals"];
} {
  const ws = wb.Sheets["Dashboard"];
  const totals: RankingsBundle["totals"] = {
    companies_tracked: null,
    superstars: null,
    yes_count: null,
    maybe_count: null,
    no_count: null,
  };

  if (!ws) return { source_as_of: null, totals };

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  let source_as_of: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const cell0 = toStr(row[0]);

    // "As of April 07, 2026  ·  ..."
    if (!source_as_of && /^as of /i.test(cell0)) {
      const m = cell0.match(/as of\s+(.+?)(?:\s*[·•]\s*|$)/i);
      if (m) source_as_of = m[1].trim();
    }

    // Pipeline overview row — has the data row right below the label row
    if (/companies tracked/i.test(toStr(row[1] ?? ""))) {
      const dataRow = rows[i + 1];
      if (Array.isArray(dataRow)) {
        totals.companies_tracked = toNum(dataRow[1]) || null;
        totals.superstars = toNum(dataRow[4]) || null;

        // Yes / Maybe / No is one cell like "3103 / 1096 / 5703"
        const ymn = toStr(dataRow[5]);
        const parts = ymn.split("/").map((p) => p.trim());
        if (parts.length === 3) {
          totals.yes_count = toNum(parts[0]) || null;
          totals.maybe_count = toNum(parts[1]) || null;
          totals.no_count = toNum(parts[2]) || null;
        }
      }
    }
  }

  return { source_as_of, totals };
}
