"use client";

import { useEffect, useMemo, useState } from "react";
import type { Entry } from "@/lib/types";
import type { RankingsBundle } from "@/lib/rankings-types";
import { fuzzyName } from "@/lib/name-normalize";

type MainTab = "home" | "tracker" | "rankings" | "matrix";

interface Props {
  entries: Entry[];
  onNavigate: (tab: MainTab) => void;
  onSearch: (q: string) => void;
}

const STALE_DAYS = 30;
const TOP_UNTRACKED_LIMIT = 6;
const UNASSIGNED_LIMIT = 8;

function ownerOf(e: Entry): string | null {
  const m = /Owner:\s*([\p{L}][\p{L}\p{N} _.-]*)/u.exec(e.notes ?? "");
  return m ? m[1].trim() : null;
}

function daysAgo(ms?: number): number | null {
  if (!ms) return null;
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

export default function HomePanel({ entries, onNavigate, onSearch }: Props) {
  const [bundle, setBundle] = useState<RankingsBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rankings");
        if (!res.ok) throw new Error("rankings fetch failed");
        // The endpoint returns { bundle: RankingsBundle | null }.
        const wrapped = (await res.json()) as {
          bundle: RankingsBundle | null;
        };
        if (!cancelled) setBundle(wrapped?.bundle ?? null);
      } catch {
        if (!cancelled) setBundle(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const trackedKeys = useMemo(
    () => new Set(entries.map((e) => fuzzyName(e.name))),
    [entries]
  );

  const topUntracked = useMemo(() => {
    if (!bundle?.rankings) return [];
    return bundle.rankings
      .filter((r) => r.total_score > 0)
      .filter((r) => !trackedKeys.has(fuzzyName(r.company)))
      .slice(0, TOP_UNTRACKED_LIMIT);
  }, [bundle, trackedKeys]);

  const unassignedTargeting = useMemo(() => {
    return entries
      .filter((e) => e.status === "targeting" && !ownerOf(e))
      .slice(0, UNASSIGNED_LIMIT);
  }, [entries]);

  const staleTargeting = useMemo(() => {
    return entries
      .filter((e) => e.status === "targeting")
      .map((e) => ({ e, d: daysAgo(e.targetedAt ?? e.addedAt) }))
      .filter((x) => x.d !== null && x.d >= STALE_DAYS)
      .sort((a, b) => (b.d ?? 0) - (a.d ?? 0))
      .slice(0, UNASSIGNED_LIMIT);
  }, [entries]);

  const counts = useMemo(() => {
    const targeting = entries.filter((e) => e.status === "targeting").length;
    const withOwner = entries.filter(
      (e) => e.status === "targeting" && ownerOf(e)
    ).length;
    return {
      targeting,
      withOwner,
      pctOwned: targeting ? Math.round((withOwner / targeting) * 100) : 0,
      pools: entries.length,
      ranked: bundle?.rankings?.length ?? 0,
      untracked: topUntracked.length,
    };
  }, [entries, bundle, topUntracked]);

  const recentActivity = useMemo(() => {
    // Naive derived-signal feed for v1: newest entries first, cap at 6.
    return [...entries]
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, 6);
  }, [entries]);

  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  function findUntracked(name: string) {
    onSearch(name);
    onNavigate("tracker");
  }

  return (
    <div className="home-panel">
      <div className="home-head">
        <div>
          <div className="home-greeting">{greeting}</div>
          <div className="home-sub">
            {loading
              ? "Loading pipeline snapshot…"
              : `${counts.pools} pools tracked · ${counts.ranked} ranked companies in calibration data · ${counts.pctOwned}% of targeting has an owner`}
          </div>
        </div>
        <div className="home-stat-row">
          <div className="home-stat">
            <span className="home-stat-num">{counts.targeting}</span>
            <span className="home-stat-label">targeting</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-num">{topUntracked.length}</span>
            <span className="home-stat-label">ranked untracked</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-num">{unassignedTargeting.length}</span>
            <span className="home-stat-label">unassigned</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-num">{staleTargeting.length}</span>
            <span className="home-stat-label">stale ≥30d</span>
          </div>
        </div>
      </div>

      <div className="home-layout">
        <section className="home-queue">
          <div className="home-section-label">ACTION QUEUE</div>

          {/* Reply approvals — placeholder for Slice C */}
          <div className="hq-card hq-mute">
            <div className="hq-rail hq-rail-mute" />
            <div className="hq-body">
              <div className="hq-title">Reply approvals — arriving soon</div>
              <div className="hq-desc">
                Google Workspace connector + reply-triage inbox ship in the next slice. Once wired, agent drafts will queue here for one-click approval.
              </div>
            </div>
          </div>

          {/* Top-ranked untracked */}
          {topUntracked.length > 0 && (
            <div className="hq-card">
              <div className="hq-rail hq-rail-accent" />
              <div className="hq-body">
                <div className="hq-title">
                  {topUntracked.length} high-ranked{" "}
                  {topUntracked.length === 1 ? "company is" : "companies are"}{" "}
                  not in your tracker
                </div>
                <div className="hq-desc">
                  Calibration data ranks them highly but no pool row exists.
                  Add to targeting or blacklist to clear the queue.
                </div>
                <ul className="hq-list">
                  {topUntracked.map((r) => (
                    <li key={r.company}>
                      <button
                        className="hq-list-name"
                        onClick={() => findUntracked(r.company)}
                        title="Open in tracker (searches for this name)"
                      >
                        {r.company}
                      </button>
                      <span className="hq-list-meta">
                        score {r.total_score.toFixed(1)} · {r.total_votes} votes
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  className="hq-cta"
                  onClick={() => onNavigate("rankings")}
                >
                  Open rankings →
                </button>
              </div>
            </div>
          )}

          {/* Unassigned owners */}
          {unassignedTargeting.length > 0 && (
            <div className="hq-card">
              <div className="hq-rail hq-rail-warn" />
              <div className="hq-body">
                <div className="hq-title">
                  {unassignedTargeting.length} targeting{" "}
                  {unassignedTargeting.length === 1 ? "pool has" : "pools have"}{" "}
                  no owner
                </div>
                <div className="hq-desc">
                  Assign an owner from the tracker page so the pool actually
                  gets worked. Bulk-assign is one click.
                </div>
                <ul className="hq-list">
                  {unassignedTargeting.slice(0, 5).map((e) => (
                    <li key={e.id}>
                      <button
                        className="hq-list-name"
                        onClick={() => findUntracked(e.name)}
                      >
                        {e.name}
                      </button>
                      <span className="hq-list-meta">
                        {e.type} · {e.domain}
                      </span>
                    </li>
                  ))}
                </ul>
                <button className="hq-cta" onClick={() => onNavigate("tracker")}>
                  Assign owners in tracker →
                </button>
              </div>
            </div>
          )}

          {/* Stale targets */}
          {staleTargeting.length > 0 && (
            <div className="hq-card">
              <div className="hq-rail hq-rail-mute" />
              <div className="hq-body">
                <div className="hq-title">
                  {staleTargeting.length} targeting{" "}
                  {staleTargeting.length === 1 ? "pool has" : "pools have"} sat
                  for ≥{STALE_DAYS} days
                </div>
                <div className="hq-desc">
                  Old veins produce diminishing returns. Move to tried or
                  demote to tertiary priority to keep the active list honest.
                </div>
                <ul className="hq-list">
                  {staleTargeting.slice(0, 5).map(({ e, d }) => (
                    <li key={e.id}>
                      <button
                        className="hq-list-name"
                        onClick={() => findUntracked(e.name)}
                      >
                        {e.name}
                      </button>
                      <span className="hq-list-meta">
                        {d}d · {e.domain}
                      </span>
                    </li>
                  ))}
                </ul>
                <button className="hq-cta" onClick={() => onNavigate("tracker")}>
                  Review in tracker →
                </button>
              </div>
            </div>
          )}

          {/* Handoff placeholder */}
          <div className="hq-card hq-mute">
            <div className="hq-rail hq-rail-mute" />
            <div className="hq-body">
              <div className="hq-title">Handoff to Google Sheet — arriving soon</div>
              <div className="hq-desc">
                Once configured, high-signal candidates push to the Sourced
                Candidates sheet, create a feedback Doc from the template, and
                drop a Cal invite in Gmail.
              </div>
            </div>
          </div>

          {!loading &&
            topUntracked.length === 0 &&
            unassignedTargeting.length === 0 &&
            staleTargeting.length === 0 && (
              <div className="hq-empty">
                Inbox zero. Nothing needs your attention right now.
              </div>
            )}
        </section>

        <aside className="home-rail">
          <div className="home-section-label">RECENT ACTIVITY</div>
          {recentActivity.map((e) => (
            <div key={e.id} className="hr-row">
              <div className="hr-when">
                {new Date(e.addedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div className="hr-what">
                <button className="hr-name" onClick={() => findUntracked(e.name)}>
                  {e.name}
                </button>
                <div className="hr-kind">
                  Added · {e.status} · {e.domain}
                </div>
              </div>
            </div>
          ))}
          {bundle?.uploaded_at && (
            <div className="hr-row">
              <div className="hr-when">
                {new Date(bundle.uploaded_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div className="hr-what">
                <div className="hr-name">Rankings upload</div>
                <div className="hr-kind">
                  {bundle.rankings.length} companies · {bundle.source_as_of ?? "no as-of"}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
