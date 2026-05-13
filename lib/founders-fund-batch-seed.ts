// Founders Fund portfolio batch — net-new entries to add as low-priority targeting (May 13 2026)
// User reviewed list and removed: DeepMind, Oculus, Twilio, Credit Karma, Wish,
// Postmates, The Athletic, Faire, Oscar, Sword Health, Wave, Mnzil (12 removed).
// Names follow "Company Name (Founders Fund)" convention.
// All entries get priority="low" so they render in the Secondary targets tier.

import type { EntryType, Domain } from "./types";

export interface FoundersFundSeed {
  finalName: string;
  type: EntryType;
  domain: Domain;
}

export const FOUNDERS_FUND_BATCH_2026_05_13: FoundersFundSeed[] = [
  { finalName: "Nubank (Founders Fund)", type: "company", domain: "fintech" },
  { finalName: "Polymarket (Founders Fund)", type: "company", domain: "fintech" },
  { finalName: "General Matter (Founders Fund)", type: "company", domain: "other" },
  { finalName: "Impulse Space (Founders Fund)", type: "company", domain: "other" },
  { finalName: "Hadrian (Founders Fund)", type: "company", domain: "other" },
  { finalName: "Aro (Founders Fund)", type: "company", domain: "frontier-ai" },
  { finalName: "Until (Founders Fund)", type: "company", domain: "frontier-ai" },
  { finalName: "Flock Safety (Founders Fund)", type: "company", domain: "vertical-saas" },
  { finalName: "The Boring Company (Founders Fund)", type: "company", domain: "other" },
  { finalName: "BuildOps (Founders Fund)", type: "company", domain: "vertical-saas" },
  { finalName: "Solugen (Founders Fund)", type: "company", domain: "other" },
  { finalName: "Flexport (Founders Fund)", type: "company", domain: "vertical-saas" },
  { finalName: "Workrise (Founders Fund)", type: "company", domain: "vertical-saas" },
  { finalName: "Tagomi (Founders Fund)", type: "company", domain: "fintech" },
  { finalName: "Traba (Founders Fund)", type: "company", domain: "vertical-saas" },
  { finalName: "Paxos (Founders Fund)", type: "company", domain: "fintech" },
  { finalName: "Nanotronics (Founders Fund)", type: "company", domain: "frontier-ai" },
  { finalName: "Endurosat (Founders Fund)", type: "company", domain: "other" },
];
