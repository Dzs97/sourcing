#!/usr/bin/env node
/**
 * One-shot: read a TSV of candidate-level calibration data, aggregate per
 * Current Company, and write a RankingsBundle-shaped file to
 * lib/local-rankings.ts. rankings-storage.ts picks this up as an override
 * when it exists — so the Rankings + Pools tabs work locally without
 * needing to connect to prod Redis.
 *
 * Usage:
 *   node scripts/build-local-rankings.mjs <path-to-tsv>
 *
 * Assumes header row + these columns by index (0-based):
 *   4 = Current Company
 *   6 = Calibration (Superstar / Yes / Maybe / No / blank)
 */
import fs from "node:fs";
import path from "node:path";

const [, , tsvPath] = process.argv;
if (!tsvPath) {
  console.error("Usage: node scripts/build-local-rankings.mjs <path-to-tsv>");
  process.exit(1);
}

const raw = fs.readFileSync(tsvPath, "utf8");
const lines = raw.split(/\r?\n/);
const header = lines[0].split("\t");
console.error(`Read ${lines.length - 1} rows.`);
console.error(`Header (first 8): ${header.slice(0, 8).join(" · ")}`);

const COMPANY_COL = 4;
const CALIBRATION_COL = 6;

const perCompany = new Map();

let counted = 0;
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  const cells = line.split("\t");
  const company = (cells[COMPANY_COL] || "").trim();
  const cal = (cells[CALIBRATION_COL] || "").trim();
  if (!company) continue;

  let bucket = perCompany.get(company);
  if (!bucket) {
    bucket = { company, superstar: 0, yes: 0, maybe: 0, no: 0 };
    perCompany.set(company, bucket);
  }
  const c = cal.toLowerCase();
  if (c === "superstar") bucket.superstar++;
  else if (c === "yes") bucket.yes++;
  else if (c === "maybe") bucket.maybe++;
  else if (c === "no") bucket.no++;
  // blank / other values contribute nothing to votes
  counted++;
}
console.error(`Aggregated ${counted} rows into ${perCompany.size} companies.`);

// Score formula: same as lib/rankings-parser.ts
//   superstar * 10 + yes * 2 + maybe * 0.25 - no * 0.5
const rankings = [];
for (const b of perCompany.values()) {
  const total_votes = b.superstar + b.yes + b.maybe + b.no;
  if (total_votes === 0) continue; // skip pure-blank companies
  const total_score =
    b.superstar * 10 + b.yes * 2 + b.maybe * 0.25 - b.no * 0.5;
  rankings.push({
    rank: 0,
    company: b.company,
    total_score: Math.round(total_score * 100) / 100,
    total_votes,
    superstar: b.superstar,
    yes: b.yes,
    maybe: b.maybe,
    no: b.no,
  });
}
rankings.sort((a, b) => b.total_score - a.total_score);
rankings.forEach((r, i) => (r.rank = i + 1));

const totals = {
  companies_tracked: rankings.length,
  superstars: rankings.reduce((s, r) => s + r.superstar, 0),
  yes_count: rankings.reduce((s, r) => s + r.yes, 0),
  maybe_count: rankings.reduce((s, r) => s + r.maybe, 0),
  no_count: rankings.reduce((s, r) => s + r.no, 0),
};

const bundle = {
  uploaded_at: Date.now(),
  source_as_of: `Local TSV import ${new Date().toISOString().slice(0, 10)}`,
  rankings,
  recency: [],
  totals,
};

const outPath = path.resolve(process.cwd(), "lib/local-rankings.ts");
const banner = `// Auto-generated from ${path.basename(tsvPath)} on ${new Date().toISOString()}.
// Do not edit by hand. Regenerate:
//   node scripts/build-local-rankings.mjs <path-to-tsv>
// This override is picked up by lib/rankings-storage.ts as a local seed,
// so the Rankings + Pools tabs work without needing prod Redis.
`;
const body = `import type { RankingsBundle } from "./rankings-types";\n\nexport const LOCAL_RANKINGS: RankingsBundle = ${JSON.stringify(
  bundle,
  null,
  2
)};\n`;
fs.writeFileSync(outPath, banner + "\n" + body, "utf8");
console.error(`Wrote ${outPath}`);
console.error(
  `Top 10 by score:\n${rankings
    .slice(0, 10)
    .map((r) => `  ${r.rank.toString().padStart(3)}  ${r.total_score.toFixed(1).padStart(6)}  ${r.company}`)
    .join("\n")}`
);
