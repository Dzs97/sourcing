export type Status = "tried" | "targeting" | "new" | "blacklisted";
export type EntryType = "company" | "school" | "community" | "competition";
export type Domain =
  | "frontier-ai"
  | "healthcare-ai"
  | "insurtech"
  | "defense"
  | "infra-devtools"
  | "bio-ai"
  | "research-lab"
  | "fintech"
  | "vertical-saas"
  | "cs-school"
  | "elite-hs"
  | "fellowship"
  | "olympiad"
  | "open-source"
  | "neos-portco"
  | "other";

export interface Entry {
  id: string;
  name: string;
  status: Status;
  type: EntryType;
  domain: Domain;
  notes?: string;
  addedAt: number;
  /**
   * Timestamp of the most recent time this entry was promoted to "targeting".
   * Optional because legacy entries may not have it.
   */
  targetedAt?: number;
}

/**
 * A unit of recorded targeting activity.
 *
 * Two flavours:
 *   - "batch-apply" — captured when the user clicks "Apply batch" and the
 *     whole targeting group gets demoted to "tried" at once. The `entries`
 *     array holds the cohort that was archived.
 *   - "daily-activity" — accumulates individual ✓/✕ status changes (and any
 *     reverses) made on individual entries during a single calendar day.
 *     The `actions` array holds the per-click log. There's at most one
 *     daily-activity cohort per UTC day; new clicks merge into the existing
 *     one for that day.
 */
export interface TargetingCohort {
  id: string;
  /** When this cohort was archived. For daily-activity, the day's first action. */
  archivedAt: number;
  /** Discriminator. Optional for backwards compatibility (legacy → "batch-apply"). */
  kind?: "batch-apply" | "daily-activity";
  /** UTC day key for daily-activity cohorts ("YYYY-MM-DD"). Used for merging. */
  dayKey?: string;
  /** For batch-apply: snapshot of the cohort's members. */
  entries: Array<{
    name: string;
    type: EntryType;
    domain: Domain;
    /** When this entry first joined the cohort, if known. */
    targetedAt?: number;
  }>;
  /** For daily-activity: chronological log of individual status changes. */
  actions?: Array<{
    name: string;
    type: EntryType;
    domain: Domain;
    fromStatus: Status;
    toStatus: Status;
    at: number;
  }>;
  /** Optional summary. */
  note?: string;
}

export interface Suggestion {
  name: string;
  type: EntryType;
  domain: Domain;
  reason: string;
}

export const DOMAIN_LABELS: Record<Domain, string> = {
  "frontier-ai": "Frontier AI",
  "healthcare-ai": "Healthcare AI",
  insurtech: "Insurtech",
  defense: "Defense / Hardware",
  "infra-devtools": "Infra / Devtools",
  "bio-ai": "Bio + AI",
  "research-lab": "Research Lab",
  fintech: "Fintech",
  "vertical-saas": "Vertical SaaS",
  "cs-school": "CS School",
  "elite-hs": "Elite High School",
  fellowship: "Fellowship",
  olympiad: "Olympiad / Competition",
  "open-source": "Open Source",
  "neos-portco": "Neo's PortCo",
  other: "Other",
};

export const STATUS_LABELS: Record<Status, string> = {
  tried: "Tried",
  targeting: "Targeting",
  new: "New",
  blacklisted: "Blacklisted",
};

export const TYPE_LABELS: Record<EntryType, string> = {
  company: "Company",
  school: "School",
  community: "Community",
  competition: "Competition",
};
