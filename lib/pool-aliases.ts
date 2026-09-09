/**
 * Pool name aliases — collapse variants into a single canonical name so the
 * aggregation buckets them together AND the team-size / category lookups
 * find them. Applied in `computeYields` before bucketing.
 *
 * Keep the RIGHT-hand side of each mapping as the display name we want
 * the sourcer to see in the Pools table. Add to POOL_TEAM_SIZES and
 * POOL_CATEGORIES under that canonical name.
 *
 * Only merge things that are genuinely the same entity — Palantir and
 * Palantir Technologies obviously same, Facebook and Meta obviously same.
 * When in doubt, leave separate.
 */
export const POOL_ALIASES: Record<string, string> = {
  // ── Companies with multiple naming variants ─────────────────
  "Palantir Technologies": "Palantir",
  "Anduril Industries": "Anduril",
  "Nvidia": "NVIDIA",
  "Amazon Web Services (AWS)": "AWS",
  "Rubrik, Inc.": "Rubrik",
  "Bloomberg LP": "Bloomberg",
  "Facebook": "Meta",
  "Instagram": "Meta",
  "Jump Trading": "Jump Trading Group",
  "Deepmind": "Google DeepMind",
  "xAi": "xAI",
  "Reddit, Inc.": "Reddit",
  "Snap": "Snap Inc.",  // short-form → canonical
  "Anysphere": "Cursor",  // parent company → product name Diego sources under

  // ── Universities — merge long/short forms ───────────────────
  "Massachusetts Institute of Technology": "MIT",
  "MIT EECS": "MIT",
  "Stanford University": "Stanford",
  "Stanford University Department of Computer Science": "Stanford",
  "Stanford University School of Engineering": "Stanford",
  "Princeton University": "Princeton",
  "Yale University": "Yale",
  "Harvard University": "Harvard",
  "Cornell University": "Cornell",
  "Columbia University": "Columbia",
  "University of Pennsylvania": "UPenn",
  "Duke University": "Duke",
  "Brown University": "Brown",
  "Georgia Institute of Technology": "Georgia Tech",
  "The University of Texas at Austin": "UT Austin",
  "University of Waterloo": "Waterloo",
  "Carnegie Mellon University": "CMU",
  "University of California, Berkeley": "UC Berkeley",
  "UC Berkeley Electrical Engineering & Computer Sciences (EECS)": "UC Berkeley",
  "Berkeley": "UC Berkeley",  // short-form → canonical
  "University of Chicago": "UChicago",
  "Northwestern University": "Northwestern",
  "University of Illinois Urbana-Champaign": "UIUC",
  "New York University": "NYU",

  // ── Research labs (long official names → short handle) ──────
  "Stanford Artificial Intelligence Laboratory (SAIL)": "SAIL",
  "Berkeley Artificial Intelligence Research": "BAIR",
  "MIT Computer Science and Artificial Intelligence Laboratory (CSAIL)": "CSAIL",
  "Stanford Institute for Human-Centered Artificial Intelligence (HAI)": "Stanford HAI",
};

/** Get the canonical display name for a pool label. */
export function canonicalPoolName(label: string): string {
  return POOL_ALIASES[label] ?? label;
}
