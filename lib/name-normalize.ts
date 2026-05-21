/**
 * Aggressive name normalization for cross-reference / dedupe.
 *
 *   1. Strip trailing " (VC name)" suffix so "Foo" and "Foo (Benchmark)" match
 *   2. Lowercase
 *   3. Remove all non-alphanumerics so "OpenEvidence" / "Open Evidence" / "open-evidence" collapse
 *
 * Used by:
 *   - app/api/admin/bulk-add-payload (server-side dedupe of new batches)
 *   - app/RankingsPanel.tsx           (linking Rankings rows to Tracker entries)
 *   - app/page.tsx promoteByName()    (avoid creating dupes via the Rankings "+ Target" button)
 *
 * Keep these three in sync — if you change the rule here, all three callers update.
 */
export function fuzzyName(s: string): string {
  const noVc = (s || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  return noVc.toLowerCase().replace(/[^a-z0-9]/g, "");
}
