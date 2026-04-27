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
