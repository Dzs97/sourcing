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
  let recency = parseRecencySheet(wb);
  const { source_as_of, totals } = parseDashboard(wb);

  // Fallback: when the file is a candidate-level calibration sheet (e.g. "Eng"
  // tab from the Product & Engineering Sourcing doc) instead of the
  // pre-aggregated Rankings/Recency/Dashboard structure, aggregate it ourselves.
  if (rankings.length === 0) {
    const agg = parseCandidateLevelSheet(wb);
    rankings = agg.rankings;
    if (recency.length === 0) recency = agg.recency;
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
function parseCandidateLevelSheet(wb: XLSX.WorkBook): {
  rankings: Ranking[];
  recency: RecencyRecord[];
} {
  const sheetName = pickCandidateSheet(wb);
  if (!sheetName) return { rankings: [], recency: [] };

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: null,
  });
  if (rows.length < 2) return { rankings: [], recency: [] };

  // Locate columns by header name (more robust than fixed E/G indices in case
  // the upstream sheet's column order ever shifts).
  const header = (rows[0] as unknown[]).map((c) => toStr(c).toLowerCase());
  const companyCol = header.findIndex((h) => h === "current company");
  const calibCol = header.findIndex((h) => h === "calibration");
  const dateCol = header.findIndex((h) => h === "date");
  const cohortCol = header.findIndex((h) => h === "cohort");
  if (companyCol === -1 || calibCol === -1) {
    return { rankings: [], recency: [] };
  }

  type Bucket = {
    superstar: number;
    yes: number;
    maybe: number;
    no: number;
    dates: number[]; // unix-ms timestamps of every dated candidate
    cohorts: Set<string>;
    total_rows: number; // includes rows with empty calibration / date
  };
  const buckets = new Map<string, Bucket>();
  const now = Date.now();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const company = toStr(row[companyCol]);
    if (!company) continue;

    let b = buckets.get(company);
    if (!b) {
      b = {
        superstar: 0,
        yes: 0,
        maybe: 0,
        no: 0,
        dates: [],
        cohorts: new Set(),
        total_rows: 0,
      };
      buckets.set(company, b);
    }
    b.total_rows++;

    const calib = toStr(row[calibCol]).toLowerCase();
    if (calib === "superstar") b.superstar++;
    else if (calib === "yes") b.yes++;
    else if (calib === "maybe") b.maybe++;
    else if (calib === "no") b.no++;
    // empty / "2027" / other noise is skipped for calibration counting

    if (dateCol !== -1) {
      const ts = parseFlexibleDate(row[dateCol], now);
      if (ts !== null) b.dates.push(ts);
    }
    if (cohortCol !== -1) {
      const c = toStr(row[cohortCol]);
      if (c) b.cohorts.add(c);
    }
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
      bucket: b,
    };
  });

  // Rank by score descending, then by total_votes as tiebreak.
  aggregated.sort(
    (a, b) =>
      b.total_score - a.total_score || b.total_votes - a.total_votes
  );

  const rankings: Ranking[] = aggregated.map((r, i) => ({
    rank: i + 1,
    company: r.company,
    total_score: r.total_score,
    total_votes: r.total_votes,
    superstar: r.superstar,
    yes: r.yes,
    maybe: r.maybe,
    no: r.no,
  }));

  // Recency: median sourcing date per company. Companies with no dated rows
  // get a placeholder (median omitted, days_ago=0) so the row still surfaces;
  // the UI's "overdue" logic relies on days_ago >= threshold, so 0 means
  // "not overdue" which is the right default for unknown.
  const recency: RecencyRecord[] = aggregated.map((r, i) => {
    const dates = r.bucket.dates;
    let median_sourcing_date = "";
    let days_ago = 0;
    if (dates.length > 0) {
      const sorted = [...dates].sort((a, b) => a - b);
      const mid =
        sorted.length % 2 === 1
          ? sorted[(sorted.length - 1) / 2]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
      median_sourcing_date = isoDay(mid);
      days_ago = Math.max(0, Math.round((now - mid) / (1000 * 60 * 60 * 24)));
    }
    return {
      rank: i + 1,
      company: r.company,
      median_sourcing_date,
      days_ago,
      num_candidates: r.bucket.total_rows,
      num_cohorts: r.bucket.cohorts.size,
    };
  });

  return { rankings, recency };
}

/**
 * Parse the messy date column from a sourcing sheet. The Eng tab uses bare
 * "M/D" with the current year implied; the dashboard sometimes ships
 * "M/D/YY" or "M/D/YYYY"; the underlying xlsx can also surface Excel serial
 * date numbers (days since 1899-12-30). Returns unix-ms or null.
 */
function parseFlexibleDate(v: unknown, nowMs: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  // Excel serial date number → days since 1899-12-30
  if (typeof v === "number" && Number.isFinite(v) && v > 30000 && v < 80000) {
    return (v - 25569) * 86400 * 1000; // 25569 = days from 1970-01-01 to 1899-12-30 offset
  }
  const s = String(v).trim();
  if (!s) return null;
  const parts = s.split("/");
  if (parts.length === 2) {
    // "M/D" — assume the year the sheet is current for (today's year)
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    if (!Number.isFinite(m) || !Number.isFinite(d)) return null;
    const year = new Date(nowMs).getUTCFullYear();
    return Date.UTC(year, m - 1, d);
  }
  if (parts.length === 3) {
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (!Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(y)) {
      return null;
    }
    if (y < 100) y += 2000;
    return Date.UTC(y, m - 1, d);
  }
  return null;
}

function isoDay(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
