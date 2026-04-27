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

type Tab = "all" | "mine" | "untried";
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

  // Index recency by company for quick lookup
  const recencyByCompany = useMemo(() => {
    const m = new Map<string, RecencyRecord>();
    if (!bundle) return m;
    for (const r of bundle.recency) m.set(r.company.toLowerCase(), r);
    return m;
  }, [bundle]);

  // Compute the rows to show based on tab + filters + sort
  const rows = useMemo(() => {
    if (!bundle) return [];

    let base = bundle.rankings;

    // Apply tab filter
    if (tab === "mine") {
      base = base.filter((r) => entriesByName.has(r.company.toLowerCase()));
    } else if (tab === "untried") {
      base = base.filter(
        (r) =>
          r.total_score >= HIGH_SCORE_THRESHOLD &&
          !entriesByName.has(r.company.toLowerCase())
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
  }, [bundle, tab, sortKey, search, entriesByName, recencyByCompany]);

  // Stats for the tab labels and hero block
  const stats = useMemo(() => {
    if (!bundle) return { all: 0, mine: 0, untried: 0, gold: 0 };
    let mine = 0;
    let untried = 0;
    let gold = 0;
    for (const r of bundle.rankings) {
      if (r.superstar > 2) gold++;
      if (entriesByName.has(r.company.toLowerCase())) {
        mine++;
      } else if (r.total_score >= HIGH_SCORE_THRESHOLD) {
        untried++;
      }
    }
    return { all: bundle.rankings.length, mine, untried, gold };
  }, [bundle, entriesByName]);

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
            ? `Score ≥ ${HIGH_SCORE_THRESHOLD}, not yet tracked`
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
              {rows.slice(0, 200).map((r) => {
                const entry = entriesByName.get(r.company.toLowerCase());
                const recency = recencyByCompany.get(r.company.toLowerCase());
                const isOverdue = recency && recency.days_ago >= OVERDUE_DAYS;
                const isHighScore = r.total_score >= HIGH_SCORE_THRESHOLD;
                const isGold = r.superstar > 2;

                return (
                  <tr
                    key={`${r.rank}-${r.company}`}
                    className={isGold ? "row-gold" : isHighScore ? "row-high" : ""}
                  >
                    <td className="rk-rank">{r.rank}</td>
                    <td className="rk-company">
                      {isGold && <span className="gold-marker" title=">2 superstars">⭐</span>}
                      {r.company}
                    </td>
                    <td className="rk-num">
                      <strong>{r.total_score}</strong>
                    </td>
                    <td className="rk-num">{r.superstar > 0 ? r.superstar : "·"}</td>
                    <td className="rk-num rk-yes">{r.yes}</td>
                    <td className="rk-num rk-no">{r.no}</td>
                    <td className={`rk-recency ${isOverdue ? "overdue" : ""}`}>
                      {recency ? `${Math.round(recency.days_ago)}d` : "—"}
                    </td>
                    <td>
                      {entry ? (
                        <span className={`status-pill ${entry.status}`}>
                          {STATUS_LABELS[entry.status]}
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
          {rows.length > 200 && (
            <div className="rankings-truncated">
              Showing first 200 of {rows.length} matches. Refine search to narrow down.
            </div>
          )}
        </div>
      )}
    </>
  );
}
