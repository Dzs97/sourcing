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
 * A snapshot of a batch of entries that were targeted together.
 * Captured at the moment "Apply batch" runs (before demotion).
 */
export interface TargetingCohort {
  id: string;
  /** When this cohort was archived — i.e. when its members got demoted to "tried". */
  archivedAt: number;
  /** Names of entries that were in this cohort. */
  entries: Array<{
    name: string;
    type: EntryType;
    domain: Domain;
    /** When this entry first joined the cohort, if known. */
    targetedAt?: number;
  }>;
  /** Optional summary written by the user or generated automatically. */
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
