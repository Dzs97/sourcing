"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Entry, Status } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";
import type {
  Ranking,
  RecencyRecord,
  RankingsBundle,
} from "@/lib/rankings-types";
import { HIGH_SCORE_THRESHOLD, OVERDUE_DAYS } from "@/lib/rankings-types";

// Threshold above which a Rankings company is considered "already tried"
// regardless of whether it's in the user's tracker. 10+ votes means the team
// has effectively mined the company, even if no one added it to the tracker.
const TRIED_VOTE_THRESHOLD = 10;

// Aliases between the rankings sheet and the tracker. Maps the rankings name
// (left) to the canonical tracker name (right). Used to avoid double-counting
// the same company under different naming conventions.
const RANKINGS_ALIASES: Record<string, string> = {
  "Anduril Industries": "Anduril",
  Cursor: "Cursor (Anysphere)",
  Anysphere: "Cursor (Anysphere)",
  Codeium: "Codeium / Windsurf",
  Windsurf: "Codeium / Windsurf",
  "Sentry (sentry.io)": "Sentry",
  "Snap Inc.": "Snap",
  "Perplexity AI": "Perplexity",
  "Temporal Technologies": "Temporal",
  "Bloomberg LP": "Bloomberg",
  "Amazon Web Services (AWS)": "AWS",
  Nvidia: "NVIDIA",
  "Massachusetts Institute of Technology": "MIT",
  "Stanford University": "Stanford",
  "Princeton University": "Princeton",
  "Columbia University": "Columbia",
  "Yale University": "Yale",
  "Brown University": "Brown",
  "Duke University": "Duke",
  "Rice University": "Rice",
  "Cornell University": "Cornell",
  "University of Waterloo": "Waterloo",
};

function canonicalizeRankingName(name: string): string {
  return RANKINGS_ALIASES[name] ?? name;
}

type Tab = "all" | "mine" | "untried" | "all-tracker";
type SortKey = "rank" | "score" | "votes" | "superstar" | "recency";

interface RankingsPanelProps {
  entries: Entry[];
  onPromote: (companyName: string, status: Status) => Promise<void>;
}

export default function RankingsPanel({ entries, onPromote }: RankingsPanelProps) {
  const [bundle, setBundle] = useState<RankingsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("untried");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Pagination — pageSize=0 means "show all"
  const [pageSize, setPageSize] = useState<number>(200);
  const [page, setPage] = useState<number>(1);

  // Reset to page 1 when the filtered/sorted result set changes
  useEffect(() => {
    setPage(1);
  }, [tab, search, sortKey, pageSize]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/rankings");
      const data = await res.json();
      setBundle(data.bundle ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Index entries by lowercased name for O(1) cross-reference
  const entriesByName = useMemo(() => {
    const m = new Map<string, Entry>();
    for (const e of entries) m.set(e.name.toLowerCase(), e);
    return m;
  }, [entries]);

  // Helper: given a Rankings row, look up the matching tracker entry
  // (using the alias map so "Anduril Industries" matches "Anduril")
  const lookupEntry = (companyName: string): Entry | undefined => {
    const direct = entriesByName.get(companyName.toLowerCase());
    if (direct) return direct;
    const canonical = canonicalizeRankingName(companyName);
    if (canonical !== companyName) {
      return entriesByName.get(canonical.toLowerCase());
    }
    return undefined;
  };

  // Index recency by company for quick lookup
  const recencyByCompany = useMemo(() => {
    const m = new Map<string, RecencyRecord>();
    if (!bundle) return m;
    for (const r of bundle.recency) m.set(r.company.toLowerCase(), r);
    return m;
  }, [bundle]);

  // Index rankings by canonical lowercased company name so we can attach
  // rankings data to a tracker entry when building the "all-tracker" view.
  const rankingsByCompany = useMemo(() => {
    const m = new Map<string, Ranking>();
    if (!bundle) return m;
    for (const r of bundle.rankings) {
      m.set(r.company.toLowerCase(), r);
      const canon = canonicalizeRankingName(r.company);
      if (canon !== r.company) m.set(canon.toLowerCase(), r);
    }
    return m;
  }, [bundle]);

  // Compute the rows to show based on tab + filters + sort
  const rows = useMemo(() => {
    if (!bundle) return [];

    let base: Ranking[];

    if (tab === "all-tracker") {
      // Build a row per tracker entry. If the entry has rankings data attach
      // it, otherwise synthesize a zeroed Ranking so the table renders.
      base = entries.map((e) => {
        const existing = rankingsByCompany.get(e.name.toLowerCase());
        if (existing) return existing;
        return {
          rank: 0,
          company: e.name,
          total_score: 0,
          superstar: 0,
          yes: 0,
          no: 0,
          total_votes: 0,
        } as Ranking;
      });
    } else {
      base = bundle.rankings;
    }

    // Apply tab filter
    if (tab === "mine") {
      base = base.filter((r) => lookupEntry(r.company) !== undefined);
    } else if (tab === "untried") {
      // Genuinely untried: high score, low vote count (sample size below the
      // "implicitly tried" threshold), and not in the user's tracker
      base = base.filter(
        (r) =>
          r.total_score >= HIGH_SCORE_THRESHOLD &&
          r.total_votes < TRIED_VOTE_THRESHOLD &&
          lookupEntry(r.company) === undefined
      );
    }

    // Apply search
    const q = search.trim().toLowerCase();
    if (q) {
      base = base.filter((r) => r.company.toLowerCase().includes(q));
    }

    // Sort
    const sorted = [...base];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "rank":
          return a.rank - b.rank;
        case "score":
          return b.total_score - a.total_score;
        case "votes":
          return b.total_votes - a.total_votes;
        case "superstar":
          return b.superstar - a.superstar;
        case "recency": {
          const ra = recencyByCompany.get(a.company.toLowerCase())?.days_ago ?? -1;
          const rb = recencyByCompany.get(b.company.toLowerCase())?.days_ago ?? -1;
          return rb - ra; // most overdue first
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [bundle, tab, sortKey, search, entries, entriesByName, recencyByCompany, rankingsByCompany]);

  // Stats for the tab labels and hero block
  const stats = useMemo(() => {
    if (!bundle) return { all: 0, mine: 0, untried: 0, gold: 0, allTracker: entries.length };
    let mine = 0;
    let untried = 0;
    let gold = 0;
    for (const r of bundle.rankings) {
      if (r.superstar > 2) gold++;
      if (lookupEntry(r.company) !== undefined) {
        mine++;
      } else if (
        r.total_score >= HIGH_SCORE_THRESHOLD &&
        r.total_votes < TRIED_VOTE_THRESHOLD
      ) {
        untried++;
      }
    }
    return { all: bundle.rankings.length, mine, untried, gold, allTracker: entries.length };
  }, [bundle, entries, entriesByName]);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/rankings", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed");
      } else {
        await load();
      }
    } catch (err: any) {
      setUploadError(err?.message ?? "Network error");
    } finally {
      setUploading(false);
    }
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUpload(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleClear() {
    if (!confirm("Clear the uploaded rankings data? This cannot be undone (you'd need to re-upload).")) {
      return;
    }
    await fetch("/api/rankings", { method: "DELETE" });
    await load();
  }

  if (loading) {
    return <div className="loading">Loading rankings…</div>;
  }

  // EMPTY STATE — same dark featured block aesthetic
  if (!bundle) {
    return (
      <>
        <section className="featured">
          <div className="featured-head">
            <div>
              <div className="featured-eyebrow">RANKINGS</div>
              <div className="featured-stat">
                <span className="featured-stat-num">0</span>
                <span className="featured-stat-label">companies ranked</span>
              </div>
              <div className="featured-sub">
                Upload your Company_Rankings.xlsx to see scored companies cross-referenced with your tracker.
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFilePick}
              style={{ display: "none" }}
            />
            <button
              className="generate-btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <span className="generate-btn-icon">↑</span>
              {uploading ? "Uploading…" : "Upload rankings file"}
            </button>
          </div>
        </section>
        {uploadError && <div className="modal-error">{uploadError}</div>}
      </>
    );
  }

  // POPULATED STATE
  // Hero stat depends on which tab is active
  const heroStat =
    tab === "mine"
      ? { num: stats.mine, label: "in your tracker" }
      : tab === "untried"
      ? { num: stats.untried, label: "untried high scorers" }
      : tab === "all-tracker"
      ? { num: stats.allTracker, label: "companies in your tracker" }
      : { num: stats.all, label: "companies ranked" };

  return (
    <>
      {/* DARK FEATURED BLOCK — mirrors the Tracker tab's hero */}
      <section className="featured">
        <div className="featured-head">
          <div>
            <div className="featured-eyebrow">RANKINGS</div>
            <div className="featured-stat">
              <span className="featured-stat-num">{heroStat.num}</span>
              <span className="featured-stat-label">{heroStat.label}</span>
            </div>
            <div className="featured-sub">
              {bundle.source_as_of ? `As of ${bundle.source_as_of}` : "Source date unknown"}
              {" · "}
              {bundle.totals.superstars
                ? `${bundle.totals.superstars} superstars across pipeline`
                : `${bundle.rankings.length} companies tracked`}
            </div>
          </div>
          <div className="rankings-actions">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFilePick}
              style={{ display: "none" }}
            />
            <button
              className="rankings-action-btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "↑ Replace data"}
            </button>
            <button
              className="rankings-action-btn rankings-action-danger"
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Sub-tabs inside the dark block — like the targeting groups visually */}
        <div className="rankings-subtabs">
          <button
            className={`rankings-subtab ${tab === "all" ? "active" : ""}`}
            onClick={() => setTab("all")}
          >
            <span>All ranked</span>
            <span className="rankings-subtab-count">{stats.all}</span>
          </button>
          <button
            className={`rankings-subtab ${tab === "mine" ? "active" : ""}`}
            onClick={() => setTab("mine")}
          >
            <span>My entries</span>
            <span className="rankings-subtab-count">{stats.mine}</span>
          </button>
          <button
            className={`rankings-subtab ${tab === "untried" ? "active" : ""}`}
            onClick={() => setTab("untried")}
          >
            <span>Untried high scorers</span>
            <span className="rankings-subtab-count">{stats.untried}</span>
          </button>
          <button
            className={`rankings-subtab ${tab === "all-tracker" ? "active" : ""}`}
            onClick={() => setTab("all-tracker")}
          >
            <span>All tracker</span>
            <span className="rankings-subtab-count">{stats.allTracker}</span>
          </button>
        </div>
      </section>

      {uploadError && <div className="modal-error">{uploadError}</div>}

      {/* Search + sort controls — match the filter-bar styling from Tracker */}
      <div className="filter-bar">
        <div className="filter-group" style={{ flex: 1, minWidth: 220 }}>
          <input
            className="rankings-search"
            placeholder="Search companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <span className="filter-label">Sort</span>
          {(["score", "rank", "votes", "superstar", "recency"] as const).map((k) => (
            <button
              key={k}
              className={`filter-chip ${sortKey === k ? "active" : ""}`}
              onClick={() => setSortKey(k)}
            >
              {k === "superstar" ? "★ Stars" : k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Section header — same style as Archive */}
      <div className="archive-section-head">
        <div className="archive-section-title">
          {tab === "mine"
            ? "Companies in your tracker"
            : tab === "untried"
            ? `Score ≥ ${HIGH_SCORE_THRESHOLD}, votes < ${TRIED_VOTE_THRESHOLD}, not yet tracked`
            : tab === "all-tracker"
            ? "Every company in your tracker"
            : "All ranked companies"}
        </div>
        <div className="archive-section-count">
          <span>{rows.length}</span> shown
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rankings-no-results">No matches</div>
      ) : (
        <div className="rankings-table-wrap">
          <table className="rankings-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Company</th>
                <th style={{ width: 70 }}>Score</th>
                <th style={{ width: 50 }}>★</th>
                <th style={{ width: 60 }}>Yes</th>
                <th style={{ width: 60 }}>No</th>
                <th style={{ width: 100 }}>Last sourced</th>
                <th style={{ width: 140 }}>Status</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {(pageSize === 0
                ? rows
                : rows.slice((page - 1) * pageSize, page * pageSize)
              ).map((r, idx) => {
                const entry = lookupEntry(r.company);
                const recency = recencyByCompany.get(r.company.toLowerCase());
                const isOverdue = recency && recency.days_ago >= OVERDUE_DAYS;
                const isHighScore = r.total_score >= HIGH_SCORE_THRESHOLD;
                const isImplicitlyTried = r.total_votes >= TRIED_VOTE_THRESHOLD;
                const isGold = r.superstar > 2;
                // Synthetic rows (tracker entries with no rankings data) have
                // rank=0 and total_votes=0 — show dashes instead of zeros.
                const isUnranked = r.rank === 0 && r.total_votes === 0;

                return (
                  <tr
                    key={`${r.rank}-${r.company}-${idx}`}
                    className={isGold ? "row-gold" : isHighScore ? "row-high" : ""}
                  >
                    <td className="rk-rank">{isUnranked ? "—" : r.rank}</td>
                    <td className="rk-company">
                      {isGold && <span className="gold-marker" title=">2 superstars">⭐</span>}
                      {r.company}
                    </td>
                    <td className="rk-num">
                      {isUnranked ? "—" : <strong>{r.total_score}</strong>}
                    </td>
                    <td className="rk-num">{r.superstar > 0 ? r.superstar : "·"}</td>
                    <td className="rk-num rk-yes">{isUnranked ? "—" : r.yes}</td>
                    <td className="rk-num rk-no">{isUnranked ? "—" : r.no}</td>
                    <td className={`rk-recency ${isOverdue ? "overdue" : ""}`}>
                      {recency ? `${Math.round(recency.days_ago)}d` : "—"}
                    </td>
                    <td>
                      {entry ? (
                        <span className={`status-pill ${entry.status}`}>
                          {STATUS_LABELS[entry.status]}
                        </span>
                      ) : isImplicitlyTried ? (
                        <span
                          className="status-pill tried"
                          title={`${r.total_votes} votes — implicitly tried`}
                        >
                          tried (implicit)
                        </span>
                      ) : (
                        <span className="rk-no-entry">not tracked</span>
                      )}
                    </td>
                    <td className="rk-actions">
                      {!entry && (
                        <button
                          className="entry-action"
                          onClick={() => onPromote(r.company, "targeting")}
                          title="Add to targeting"
                        >
                          + Target
                        </button>
                      )}
                      {entry && entry.status !== "targeting" && (
                        <button
                          className="entry-action"
                          onClick={() => onPromote(r.company, "targeting")}
                          title="Move to targeting"
                        >
                          → Target
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="rankings-pagination">
            <div className="rankings-pagination-info">
              {pageSize === 0
                ? `Showing all ${rows.length}`
                : `Showing ${Math.min((page - 1) * pageSize + 1, rows.length)}–${Math.min(page * pageSize, rows.length)} of ${rows.length}`}
            </div>
            <div className="rankings-pagination-controls">
              <span className="filter-label">Per page</span>
              {[100, 200, 500, 1000, 0].map((n) => (
                <button
                  key={n}
                  className={`filter-chip ${pageSize === n ? "active" : ""}`}
                  onClick={() => setPageSize(n)}
                >
                  {n === 0 ? "All" : n}
                </button>
              ))}
              {pageSize !== 0 && rows.length > pageSize && (
                <>
                  <button
                    className="filter-chip"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    ← Prev
                  </button>
                  <span className="filter-label">
                    Page {page} / {Math.max(1, Math.ceil(rows.length / pageSize))}
                  </span>
                  <button
                    className="filter-chip"
                    onClick={() =>
                      setPage((p) =>
                        Math.min(Math.ceil(rows.length / pageSize), p + 1)
                      )
                    }
                    disabled={page >= Math.ceil(rows.length / pageSize)}
                  >
                    Next →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
