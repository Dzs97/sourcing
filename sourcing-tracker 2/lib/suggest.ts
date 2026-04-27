import type { Entry, Suggestion, Domain, EntryType } from "./types";
import { DOMAIN_LABELS } from "./types";

/**
 * Rule-based suggestion engine.
 *
 * Logic:
 * 1. Look at domains the user has actively engaged with (tried OR targeting).
 * 2. For each active domain, surface "new" entries the user hasn't touched.
 * 3. Rank by domain density (more activity in a domain → more confidence
 *    that adjacent entries are relevant).
 * 4. Optionally filter by entry type (e.g., schools only).
 */
export function generateSuggestions(
  entries: Entry[],
  filterType?: EntryType
): Suggestion[] {
  // Count how engaged the user is with each domain
  const domainEngagement = new Map<Domain, number>();
  for (const entry of entries) {
    if (entry.status === "tried" || entry.status === "targeting") {
      domainEngagement.set(
        entry.domain,
        (domainEngagement.get(entry.domain) ?? 0) + 1
      );
    }
  }

  // Find unmined entries in those domains
  const candidates: Array<{ entry: Entry; score: number }> = [];
  for (const entry of entries) {
    if (entry.status !== "new") continue;
    if (filterType && entry.type !== filterType) continue;
    const engagement = domainEngagement.get(entry.domain) ?? 0;
    if (engagement === 0) continue; // ignore domains with no activity
    candidates.push({ entry, score: engagement });
  }

  // Sort by domain engagement descending
  candidates.sort((a, b) => b.score - a.score);

  return candidates.slice(0, 30).map(({ entry, score }) => ({
    name: entry.name,
    type: entry.type,
    domain: entry.domain,
    reason: buildReason(entry, score),
  }));
}

function buildReason(entry: Entry, engagement: number): string {
  const domainLabel = DOMAIN_LABELS[entry.domain];
  const noun = entry.type === "company" ? "companies" : `${entry.type}s`;
  return `You've engaged with ${engagement} ${noun} in ${domainLabel}. Consider this one next.`;
}
