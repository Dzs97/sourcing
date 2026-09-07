"use client";

import { useEffect, useMemo, useState } from "react";
import type { PoolYield } from "@/lib/pool-yield";
import type { Ranking, RankingsBundle } from "@/lib/rankings-types";
import { fuzzyName } from "@/lib/name-normalize";
import {
  POOL_CATEGORIES,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  type PoolCategory,
} from "@/lib/pool-categories";
import PoolPromptModal, { type PromptSeed } from "./PoolPromptModal";

type SortKey =
  | "worth"
  | "calibration"
  | "superstar"
  | "yes"
  | "sourced"
  | "recent";

/**
 * "Worth another hour" — expected calibration score per candidate you'd add
 * with one more sourcing pass. High = under-mined pool with strong signal.
 * Low = well-mined pool where the next sourcing pass has diminishing return.
 *
 * Formula: score / (sourced + 10). The +10 dampens tiny-sample noise so a
 * pool with 3 sourced and score 30 doesn't dominate over a pool with 60
 * sourced and score 120.
 */
function worthScore(p: EnrichedPool): number {
  if (!p.ranking || p.ranking.total_votes === 0) return -Infinity;
  return p.ranking.total_score / (p.sourced + 10);
}

interface State {
  loading: boolean;
  error: string | null;
  pools: PoolYield[];
  rankingsByKey: Map<string, Ranking>;
  total: number;
  updatedAt: number | null;
}

/**
 * A PoolYield row enriched with the matching Rankings entry (if any).
 * The join is fuzzy: Tag → Company via lib/name-normalize.
 */
export interface EnrichedPool extends PoolYield {
  ranking?: Ranking;
  category: PoolCategory;
}

const INIT: State = {
  loading: true,
  error: null,
  pools: [],
  rankingsByKey: new Map(),
  total: 0,
  updatedAt: null,
};

function timeAgo(ms: number): string {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

export default function PoolsPanel() {
  const [state, setState] = useState<State>(INIT);
  const [sortKey, setSortKey] = useState<SortKey>("calibration");
  const [q, setQ] = useState("");
  const [minSourced, setMinSourced] = useState(1);
  const [calibratedOnly, setCalibratedOnly] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<PoolCategory | "all">("all");
  const [seed, setSeed] = useState<PromptSeed | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [poolsRes, rankingsRes] = await Promise.all([
        fetch("/api/sheet-sync", { cache: "no-store" }),
        fetch("/api/rankings", { cache: "no-store" }),
      ]);
      const poolsData = await poolsRes.json();
      if (!poolsRes.ok || !poolsData.ok) {
        setState({
          loading: false,
          error: poolsData.error || `HTTP ${poolsRes.status}`,
          pools: [],
          rankingsByKey: new Map(),
          total: 0,
          updatedAt: null,
        });
        return;
      }
      let rankingsMap = new Map<string, Ranking>();
      if (rankingsRes.ok) {
        // The endpoint returns { bundle: RankingsBundle | null }.
        const wrapped = (await rankingsRes.json()) as {
          bundle: RankingsBundle | null;
        };
        const bundle = wrapped?.bundle ?? null;
        if (bundle?.rankings) {
          for (const r of bundle.rankings) {
            rankingsMap.set(fuzzyName(r.company), r);
          }
        }
      }
      setState({
        loading: false,
        error: null,
        pools: poolsData.pools as PoolYield[],
        rankingsByKey: rankingsMap,
        total: poolsData.total as number,
        updatedAt: poolsData.updated_at as number,
      });
    } catch (e) {
      setState({
        loading: false,
        error: (e as Error).message,
        pools: [],
        rankingsByKey: new Map(),
        total: 0,
        updatedAt: null,
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const enriched: EnrichedPool[] = useMemo(() => {
    return state.pools.map((p) => ({
      ...p,
      ranking: state.rankingsByKey.get(fuzzyName(p.tag)),
      category: (POOL_CATEGORIES[p.tag] ?? "other") as PoolCategory,
    }));
  }, [state.pools, state.rankingsByKey]);

  const shown = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const filtered = enriched.filter((p) => {
      if (p.sourced < minSourced) return false;
      if (calibratedOnly && (!p.ranking || p.ranking.total_votes === 0)) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (qq && !p.tag.toLowerCase().includes(qq)) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "worth":
          return worthScore(b) - worthScore(a);
        case "calibration": {
          const sa = a.ranking?.total_score ?? -Infinity;
          const sb = b.ranking?.total_score ?? -Infinity;
          return sb - sa;
        }
        case "superstar":
          return (b.ranking?.superstar ?? -1) - (a.ranking?.superstar ?? -1);
        case "yes":
          return (b.ranking?.yes ?? -1) - (a.ranking?.yes ?? -1);
        case "sourced":
          return b.sourced - a.sourced;
        case "recent":
          return (b.recentSourcedDate || "").localeCompare(a.recentSourcedDate || "");
      }
    });
    return sorted;
  }, [enriched, q, sortKey, minSourced, calibratedOnly, categoryFilter]);

  /**
   * Per-category rollup — restricted to calibrated pools when the filter is
   * on so the coverage view matches what the table below shows.
   */
  const coverage = useMemo(() => {
    const buckets = new Map<
      PoolCategory,
      { pools: number; sourced: number; superstars: number; totalScore: number; scoredPools: number }
    >();
    for (const p of enriched) {
      if (calibratedOnly && (!p.ranking || p.ranking.total_votes === 0)) continue;
      const b = buckets.get(p.category) ?? {
        pools: 0,
        sourced: 0,
        superstars: 0,
        totalScore: 0,
        scoredPools: 0,
      };
      b.pools += 1;
      b.sourced += p.sourced;
      if (p.ranking && p.ranking.total_votes > 0) {
        b.superstars += p.ranking.superstar;
        b.totalScore += p.ranking.total_score;
        b.scoredPools += 1;
      }
      buckets.set(p.category, b);
    }
    return CATEGORY_ORDER.map((c) => {
      const b = buckets.get(c);
      return {
        category: c,
        label: CATEGORY_LABELS[c],
        pools: b?.pools ?? 0,
        sourced: b?.sourced ?? 0,
        superstars: b?.superstars ?? 0,
        avgScore: b && b.scoredPools ? b.totalScore / b.scoredPools : 0,
      };
    }).filter((r) => r.pools > 0);
  }, [enriched, calibratedOnly]);

  const totals = useMemo(() => {
    let sourced = 0;
    let calibratedPools = 0;
    let superstars = 0;
    let yesCount = 0;
    for (const p of enriched) {
      sourced += p.sourced;
      if (p.ranking) {
        calibratedPools++;
        superstars += p.ranking.superstar;
        yesCount += p.ranking.yes;
      }
    }
    return {
      pools: enriched.length,
      calibratedPools,
      sourced,
      superstars,
      yesCount,
    };
  }, [enriched]);

  function openPrompt(pool?: EnrichedPool) {
    setSeed({ tag: pool?.tag ?? "", yield: pool });
    setModalOpen(true);
  }

  return (
    <div className="pools-panel">
      <div className="pools-head">
        <div>
          <div className="pools-eyebrow">POOL INTELLIGENCE</div>
          <h2 className="pools-title">Calibration results per pool</h2>
          <div className="pools-sub">
            A pool is any label that appears in your sheet's <b>Tag</b> or{" "}
            <b>Current Company</b> column — a candidate contributes to both,
            so companies you never explicitly tagged still surface here. Each
            row is joined to its calibration outcomes (★ · Yes · Maybe · No)
            from the Rankings data. Sorted by calibration score.
          </div>
        </div>
        <div className="pools-actions">
          <button className="hq-cta pools-refresh" onClick={load} disabled={state.loading}>
            {state.loading ? "Refreshing…" : "↻ Refresh"}
          </button>
          <button className="handoff-submit pools-new" onClick={() => openPrompt()}>
            + Prompt for a new pool
          </button>
        </div>
      </div>

      {state.error && (
        <div className="handoff-warn">
          <b>Sheet fetch failed:</b> {state.error}
          {state.error.includes("configured") && (
            <> Add <code>NEXT_PUBLIC_HANDOFF_SHEET_URL</code> to <code>.env.local</code>.</>
          )}
        </div>
      )}

      {!state.error && (
        <div className="pools-stats">
          <div><span>{totals.pools}</span>pools</div>
          <div><span>{totals.calibratedPools}</span>with calibration</div>
          <div><span>{totals.sourced}</span>candidates sourced</div>
          <div><span>{totals.superstars}</span>★ superstars</div>
          <div><span>{totals.yesCount}</span>Yes votes</div>
          {state.updatedAt && (
            <div className="pools-updated">
              Synced <b>{timeAgo(state.updatedAt)}</b>
            </div>
          )}
        </div>
      )}

      {!state.error && coverage.length > 0 && (
        <div className="pools-coverage">
          <div className="pools-coverage-label">COVERAGE — click to filter</div>
          <div className="pools-coverage-row">
            <button
              className={`pools-cov-tile ${categoryFilter === "all" ? "active" : ""}`}
              onClick={() => setCategoryFilter("all")}
              title="Show all categories"
            >
              <span className="pools-cov-cat">All</span>
              <span className="pools-cov-nums">
                <b>{coverage.reduce((a, c) => a + c.pools, 0)}</b> pools ·{" "}
                <b>{coverage.reduce((a, c) => a + c.sourced, 0)}</b> sourced
              </span>
            </button>
            {coverage.map((c) => (
              <button
                key={c.category}
                className={`pools-cov-tile pools-cov-${c.category} ${
                  categoryFilter === c.category ? "active" : ""
                }`}
                onClick={() =>
                  setCategoryFilter(
                    categoryFilter === c.category ? "all" : c.category
                  )
                }
                title={`${c.label} · avg score ${c.avgScore.toFixed(1)}`}
              >
                <span className="pools-cov-cat">{c.label}</span>
                <span className="pools-cov-nums">
                  <b>{c.pools}</b>{c.superstars > 0 ? ` · ★${c.superstars}` : ""}
                  {c.avgScore > 0 ? ` · ${c.avgScore.toFixed(0)}avg` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pools-filter">
        <input
          className="pools-search"
          placeholder="Filter pools…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="pools-filter-group">
          <span className="filter-label">Sort</span>
          {(
            [
              ["worth", "Worth another hour"],
              ["calibration", "Score"],
              ["superstar", "★ Superstars"],
              ["yes", "Yes"],
              ["sourced", "Sourced"],
              ["recent", "Recent"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              className={`filter-chip ${sortKey === k ? "active" : ""}`}
              onClick={() => setSortKey(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="pools-filter-group">
          <span className="filter-label">Min sourced</span>
          {[1, 3, 5, 10, 25].map((n) => (
            <button
              key={n}
              className={`filter-chip ${minSourced === n ? "active" : ""}`}
              onClick={() => setMinSourced(n)}
            >
              ≥ {n}
            </button>
          ))}
        </div>
        <div className="pools-filter-group">
          <button
            className={`filter-chip ${calibratedOnly ? "active" : ""}`}
            onClick={() => setCalibratedOnly((v) => !v)}
            title="When on, hides pools with no calibration signal yet."
          >
            {calibratedOnly ? "✓ Calibrated only" : "Include uncalibrated"}
          </button>
        </div>
      </div>

      {state.loading && !state.pools.length ? (
        <div className="pools-empty">Loading pool calibration data…</div>
      ) : !shown.length ? (
        <div className="pools-empty">
          {state.pools.length === 0
            ? "No pools yet — hit refresh once your sheet is populated."
            : "No pools match your filters."}
        </div>
      ) : (
        <div className="pools-table-wrap">
          <table className="pools-table">
            <thead>
              <tr>
                <th>Pool</th>
                <th className="num" title="Candidates sourced from this pool (from your sheet)">Sourced</th>
                <th className="num" title="Superstars (from calibration data)">★</th>
                <th className="num">Yes</th>
                <th className="num">Maybe</th>
                <th className="num">No</th>
                <th className="num" title="Calibration score: ★·10 + Yes·2 + Maybe·0.25 − No·0.5">Score</th>
                <th className="num" title="Score / (Sourced + 10). Higher = under-mined pool with strong signal, worth another hour of sourcing.">Worth</th>
                <th>Recent</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const r = p.ranking;
                const hasCal = !!r && r.total_votes > 0;
                return (
                  <tr key={p.tag}>
                    <td className="pools-tag">
                      <button
                        className="pools-tag-btn"
                        onClick={() => openPrompt(p)}
                        title={`Draft sourcing prompt · label came from: ${p.sources.join(" + ")}`}
                      >
                        {p.tag}
                      </button>
                      <span className="pools-source-chip" title={p.sources.map(s => s === "tag" ? "Tag column" : "Current Company column").join(" + ")}>
                        {p.sources.includes("tag") && p.sources.includes("company")
                          ? "T·C"
                          : p.sources[0] === "tag" ? "T" : "C"}
                      </span>
                      {p.sampleCalibrations.length > 0 && (
                        <div className="pools-tag-hint">
                          &ldquo;{p.sampleCalibrations[0]}&rdquo;
                        </div>
                      )}
                    </td>
                    <td className="num">{p.sourced}</td>
                    <td className={`num ${r && r.superstar > 0 ? "num-good" : ""}`}>
                      {hasCal ? (r!.superstar || "·") : "—"}
                    </td>
                    <td className="num">{hasCal ? (r!.yes || "·") : "—"}</td>
                    <td className="num">{hasCal ? (r!.maybe || "·") : "—"}</td>
                    <td className="num">{hasCal ? (r!.no || "·") : "—"}</td>
                    <td className={`num ${r && r.total_score >= 10 ? "num-good" : ""}`}>
                      {hasCal ? r!.total_score.toFixed(1) : "—"}
                    </td>
                    <td className={`num ${hasCal && worthScore(p) >= 1 ? "num-good" : ""}`}>
                      {hasCal ? worthScore(p).toFixed(2) : "—"}
                    </td>
                    <td className="pools-recent">{p.recentSourcedDate || "—"}</td>
                    <td className="pools-actions-cell">
                      <button
                        className="entry-action"
                        onClick={() => openPrompt(p)}
                      >
                        ↗ Source more
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PoolPromptModal
        open={modalOpen}
        seed={seed}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
