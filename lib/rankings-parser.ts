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

  let rankings = parseRankingsSheet(wb);
  const recency = parseRecencySheet(wb);
  const { source_as_of, totals } = parseDashboard(wb);

  // Fallback: when the file is a candidate-level calibration sheet (e.g. "Eng"
  // tab from the Product & Engineering Sourcing doc) instead of the
  // pre-aggregated Rankings/Recency/Dashboard structure, aggregate it ourselves.
  if (rankings.length === 0) {
    rankings = parseCandidateLevelSheet(wb);
  }

  return {
    uploaded_at: Date.now(),
    source_as_of,
    rankings,
    recency,
    totals,
  };
}

/**
 * Aggregate a candidate-level calibration sheet into company-level rankings.
 *
 * Each row is one sourced candidate with a "Calibration" verdict
 * (Superstar / Yes / Maybe / No). We group by the candidate's "Current Company"
 * and produce one Ranking per company.
 *
 * Score weighting: Superstar=5, Yes=2, Maybe=0.5, No=0. Companies with more
 * superstars float to the top; companies with all No's drop to the bottom.
 *
 * Looks for a sheet named "Eng" first, then "Prod", then any sheet with both
 * a "Current Company" and "Calibration" header.
 */
function parseCandidateLevelSheet(wb: XLSX.WorkBook): Ranking[] {
  const sheetName = pickCandidateSheet(wb);
  if (!sheetName) return [];

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: null,
  });
  if (rows.length < 2) return [];

  // Locate columns by header name (more robust than fixed E/G indices in case
  // the upstream sheet's column order ever shifts).
  const header = (rows[0] as unknown[]).map((c) => toStr(c).toLowerCase());
  const companyCol = header.findIndex((h) => h === "current company");
  const calibCol = header.findIndex((h) => h === "calibration");
  if (companyCol === -1 || calibCol === -1) return [];

  type Bucket = { superstar: number; yes: number; maybe: number; no: number };
  const buckets = new Map<string, Bucket>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const company = toStr(row[companyCol]);
    if (!company) continue;
    const calib = toStr(row[calibCol]).toLowerCase();

    let b = buckets.get(company);
    if (!b) {
      b = { superstar: 0, yes: 0, maybe: 0, no: 0 };
      buckets.set(company, b);
    }
    if (calib === "superstar") b.superstar++;
    else if (calib === "yes") b.yes++;
    else if (calib === "maybe") b.maybe++;
    else if (calib === "no") b.no++;
    // empty / "2027" / other noise is skipped silently
  }

  const aggregated = Array.from(buckets.entries()).map(([company, b]) => {
    const total_votes = b.superstar + b.yes + b.maybe + b.no;
    const total_score = b.superstar * 5 + b.yes * 2 + b.maybe * 0.5;
    return {
      company,
      total_score,
      total_votes,
      superstar: b.superstar,
      yes: b.yes,
      maybe: b.maybe,
      no: b.no,
    };
  });

  // Rank by score descending, then by total_votes as tiebreak.
  aggregated.sort((a, b) =>
    b.total_score - a.total_score || b.total_votes - a.total_votes
  );

  return aggregated.map((r, i) => ({ rank: i + 1, ...r }));
}

function pickCandidateSheet(wb: XLSX.WorkBook): string | null {
  const preferred = ["Eng", "Prod", "Engineering", "Product"];
  for (const name of preferred) if (wb.Sheets[name]) return name;
  // Otherwise scan all sheets for one with both required headers.
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      blankrows: false,
      defval: null,
      range: 0,
    });
    if (!rows.length) continue;
    const header = (rows[0] as unknown[]).map((c) => toStr(c).toLowerCase());
    if (
      header.includes("current company") &&
      header.includes("calibration")
    ) {
      return name;
    }
  }
  return null;
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
