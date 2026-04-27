export type Status = "tried" | "targeting" | "new";
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
};

export const TYPE_LABELS: Record<EntryType, string> = {
  company: "Company",
  school: "School",
  community: "Community",
  competition: "Competition",
};
