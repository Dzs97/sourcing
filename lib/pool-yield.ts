/**
 * Aggregate the Sourced Candidates sheet into per-pool (Tag) yield metrics.
 * All logic is derived from the columns we already know exist:
 *   Cohort, Tag, Date, Name, Current Company, Location,
 *   Calibration, [Ranking?], Current Stage, Recent message date,
 *   Current Owner, Response date, Notes, then Message N × ~13.
 *
 * The Ranking column is optional — the app assumes it may or may not be
 * present. When absent, `avgRanking` is null.
 *
 * Pool name aliases from POOL_ALIASES are applied before bucketing so
 * "Palantir" and "Palantir Technologies" combine into one pool.
 */
import { canonicalPoolName } from "./pool-aliases";

export interface CandidateRow {
  cohort: string;
  tag: string;
  date: string;
  name: string;
  currentCompany: string;
  location: string;
  calibration: string;
  ranking: string;
  currentStage: string;
  recentMessageDate: string;
  currentOwner: string;
  responseDate: string;
  notes: string;
}

export interface PoolYield {
  /** Display label for the pool — the first-seen value from Tag or Current Company. */
  tag: string;
  /**
   * Which source columns contributed rows to this pool.
   * "tag" = at least one row has this label in the Tag column.
   * "company" = at least one row has this label in the Current Company column.
   * Most pools will be one or the other; some overlap.
   */
  sources: ("tag" | "company")[];
  sourced: number;
  responded: number;
  interviewed: number;
  offered: number;
  hired: number;
  dropped: number;
  onHold: number;

  responseRate: number;   // responded / sourced
  interviewRate: number;  // interviewed / sourced
  offerRate: number;      // offered / sourced
  yieldRate: number;      // hired / sourced

  avgRanking: number | null;
  rankingCount: number;   // how many rows in this pool had a numeric ranking

  recentSourcedDate: string;  // most recent Date cell (YYYY-MM-DD or as-typed)
  owners: string[];
  sampleCalibrations: string[]; // up to 3 non-empty one-liners
}

/** Stage buckets — matches your Doc's section headings + sheet values. */
const STAGES_INTERVIEWED = new Set([
  "Initial Screen",
  "On-site/Build",
  "Offer stage",
  "Pending start",
]);
const STAGES_OFFERED = new Set(["Offer stage", "Pending start"]);
const STAGE_HIRED = "Pending start";
const STAGE_DROP = "Drop";
const STAGE_HOLD = "On Hold";

/**
 * Map the raw CSV header row to the column indexes we care about.
 * Falls back to fuzzy header matching so a header renamed slightly
 * (case, extra whitespace) still resolves.
 */
export interface HeaderMap {
  cohort: number;
  tag: number;
  date: number;
  name: number;
  currentCompany: number;
  location: number;
  calibration: number;
  ranking: number;      // -1 if absent
  currentStage: number;
  recentMessageDate: number;
  currentOwner: number;
  responseDate: number;
  notes: number;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function mapHeaders(header: string[]): HeaderMap {
  const idx = (want: string): number => {
    const target = norm(want);
    for (let i = 0; i < header.length; i++) {
      if (norm(header[i]) === target) return i;
    }
    return -1;
  };
  return {
    cohort: idx("Cohort"),
    tag: idx("Tag"),
    date: idx("Date"),
    name: idx("Name"),
    currentCompany: idx("Current Company"),
    location: idx("Location"),
    calibration: idx("Calibration"),
    ranking: idx("Ranking"),
    currentStage: idx("Current Stage"),
    recentMessageDate: idx("Recent message date"),
    currentOwner: idx("Current Owner"),
    responseDate: idx("Response date"),
    notes: idx("Notes"),
  };
}

export function rowsFromCsv(cells: string[][]): CandidateRow[] {
  if (cells.length < 2) return [];
  const header = cells[0];
  const h = mapHeaders(header);

  const pick = (row: string[], i: number): string =>
    i < 0 || i >= row.length ? "" : (row[i] ?? "").trim();

  const out: CandidateRow[] = [];
  for (let r = 1; r < cells.length; r++) {
    const row = cells[r];
    // Skip completely blank rows
    if (row.every((c) => (c ?? "").trim() === "")) continue;
    const name = pick(row, h.name);
    const tag = pick(row, h.tag);
    if (!name && !tag) continue;
    out.push({
      cohort: pick(row, h.cohort),
      tag,
      date: pick(row, h.date),
      name,
      currentCompany: pick(row, h.currentCompany),
      location: pick(row, h.location),
      calibration: pick(row, h.calibration),
      ranking: pick(row, h.ranking),
      currentStage: pick(row, h.currentStage),
      recentMessageDate: pick(row, h.recentMessageDate),
      currentOwner: pick(row, h.currentOwner),
      responseDate: pick(row, h.responseDate),
      notes: pick(row, h.notes),
    });
  }
  return out;
}

/**
 * Group candidate rows into pools — each row contributes to BOTH its Tag
 * pool and its Current Company pool (deduped when they normalize to the
 * same key). This gives a bigger-picture view: a candidate sourced under
 * Tag="ex-OpenAI" who currently works at Anthropic counts toward both
 * pools, so Anthropic's calibration outcomes surface even if you never
 * explicitly tagged people that way.
 *
 * Pool key uses lowercase + collapsed whitespace so "Ramp" and "ramp"
 * merge but "OpenAI" and "ex-OpenAI" stay distinct.
 */
export function computeYields(rows: CandidateRow[]): PoolYield[] {
  interface Bucket {
    display: string;
    rows: CandidateRow[];
    sources: Set<"tag" | "company">;
  }
  const groups = new Map<string, Bucket>();

  for (const r of rows) {
    const labels: Array<{ label: string; source: "tag" | "company" }> = [];
    if (r.tag) labels.push({ label: r.tag, source: "tag" });
    if (r.currentCompany)
      labels.push({ label: r.currentCompany, source: "company" });

    // Dedup within a single row: if Tag and Current Company normalize the
    // same (after aliasing), count this candidate once toward that pool.
    const seenKeys = new Set<string>();
    for (const { label, source } of labels) {
      const canonical = canonicalPoolName(label);
      const key = norm(canonical);
      if (!key || seenKeys.has(key)) continue;
      seenKeys.add(key);

      let bucket = groups.get(key);
      if (!bucket) {
        bucket = { display: canonical, rows: [], sources: new Set() };
        groups.set(key, bucket);
      }
      bucket.rows.push(r);
      bucket.sources.add(source);
    }
  }

  const yields: PoolYield[] = [];
  for (const [, { display, rows: bucket, sources }] of groups) {
    const tag = display;
    const sourced = bucket.length;
    let responded = 0;
    let interviewed = 0;
    let offered = 0;
    let hired = 0;
    let dropped = 0;
    let onHold = 0;

    const ownersSet = new Set<string>();
    let recentSourcedDate = "";
    const rankingSum: number[] = [];
    const calibrations: string[] = [];

    for (const r of bucket) {
      if (r.responseDate) responded++;
      if (STAGES_INTERVIEWED.has(r.currentStage)) interviewed++;
      if (STAGES_OFFERED.has(r.currentStage)) offered++;
      if (r.currentStage === STAGE_HIRED) hired++;
      if (r.currentStage === STAGE_DROP) dropped++;
      if (r.currentStage === STAGE_HOLD) onHold++;
      if (r.currentOwner) ownersSet.add(r.currentOwner);
      if (r.date && r.date > recentSourcedDate) recentSourcedDate = r.date;
      const rk = parseFloat(r.ranking);
      if (!Number.isNaN(rk)) rankingSum.push(rk);
      if (r.calibration && calibrations.length < 3) calibrations.push(r.calibration);
    }

    const avgRanking =
      rankingSum.length > 0
        ? rankingSum.reduce((a, b) => a + b, 0) / rankingSum.length
        : null;

    yields.push({
      tag,
      sources: Array.from(sources),
      sourced,
      responded,
      interviewed,
      offered,
      hired,
      dropped,
      onHold,
      responseRate: sourced ? responded / sourced : 0,
      interviewRate: sourced ? interviewed / sourced : 0,
      offerRate: sourced ? offered / sourced : 0,
      yieldRate: sourced ? hired / sourced : 0,
      avgRanking,
      rankingCount: rankingSum.length,
      recentSourcedDate,
      owners: Array.from(ownersSet).sort(),
      sampleCalibrations: calibrations,
    });
  }

  // Default sort: highest response rate first, then most sourced.
  yields.sort((a, b) => {
    if (b.responseRate !== a.responseRate) return b.responseRate - a.responseRate;
    return b.sourced - a.sourced;
  });
  return yields;
}
