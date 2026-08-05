// Rankings data parsed from the Company_Rankings.xlsx export

export interface Ranking {
  rank: number;
  company: string;
  total_score: number;
  total_votes: number;
  superstar: number;
  yes: number;
  maybe: number;
  no: number;
  /**
   * Distribution of calibration Tag values (column B of the source
   * sheet) seen for candidates at this company. Only populated on
   * candidate-level uploads. Order is not stable; use the entries
   * with the highest counts as the primary label(s).
   */
  tags?: Record<string, number>;
}

export interface RecencyRecord {
  rank: number;
  company: string;
  median_sourcing_date: string; // raw date string from sheet
  days_ago: number;
  num_candidates: number;
  num_cohorts: number;
}

export interface RankingsBundle {
  uploaded_at: number; // epoch ms when the file was uploaded
  source_as_of: string | null; // the "As of {date}" line from Dashboard
  rankings: Ranking[];
  recency: RecencyRecord[];
  totals: {
    companies_tracked: number | null;
    superstars: number | null;
    yes_count: number | null;
    maybe_count: number | null;
    no_count: number | null;
  };
}

// Threshold for "high score" — used in the Untried High Scorers view
export const HIGH_SCORE_THRESHOLD = 10;

// Threshold for "overdue" — companies not sourced in this many days
export const OVERDUE_DAYS = 180;
