"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Entry,
  Status,
  EntryType,
  Domain,
  Priority,
  TargetingCohort,
} from "@/lib/types";
import {
  DOMAIN_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from "@/lib/types";
import RankingsPanel from "./RankingsPanel";

const DOMAINS = Object.keys(DOMAIN_LABELS) as Domain[];
const TYPES = Object.keys(TYPE_LABELS) as EntryType[];

interface BatchCandidate {
  name: string;
  type: EntryType;
  domain: Domain;
  reason: string;
  is_existing_entry: boolean;
}

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // Top-level tab switching between the tracker and the rankings view
  const [mainTab, setMainTab] = useState<"tracker" | "rankings">("tracker");

  // Filters
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [typeFilter, setTypeFilter] = useState<EntryType | "all">("all");
  const [domainFilter, setDomainFilter] = useState<Domain | "all">("all");

  // Archive collapse state — collapsed by default to keep main view clean
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Add form state
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState<Status>("targeting");
  const [newType, setNewType] = useState<EntryType>("company");
  const [newDomain, setNewDomain] = useState<Domain>("frontier-ai");

  // Batch generation state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<BatchCandidate[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(
    new Set()
  );

  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [history, setHistory] = useState<TargetingCohort[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function openHistoryModal() {
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      setHistory(data.history ?? []);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadEntries() {
    const res = await fetch("/api/pools");
    const data = await res.json();
    setEntries(data.entries);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadEntries();
      setLoading(false);
    })();
  }, []);

  const targeting = useMemo(
    () => entries.filter((e) => e.status === "targeting"),
    [entries]
  );

  // Split targeting into priority tiers — undefined priority = "high"
  const targetingHigh = useMemo(
    () => targeting.filter((e) => (e.priority ?? "high") === "high"),
    [targeting]
  );
  const targetingLow = useMemo(
    () => targeting.filter((e) => e.priority === "low"),
    [targeting]
  );

  const groupByDomain = (items: Entry[]) => {
    const groups: Record<string, Entry[]> = {};
    for (const e of items) {
      const key = DOMAIN_LABELS[e.domain];
      groups[key] = groups[key] ?? [];
      groups[key].push(e);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  };

  const targetingHighByDomain = useMemo(
    () => groupByDomain(targetingHigh),
    [targetingHigh]
  );
  const targetingLowByDomain = useMemo(
    () => groupByDomain(targetingLow),
    [targetingLow]
  );

  // Legacy var for backwards compat — used by any remaining reference
  const targetingByDomain = useMemo(
    () => groupByDomain(targeting),
    [targeting]
  );

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (statusFilter !== "blacklisted" && e.status === "blacklisted") return false;
      if (statusFilter === "all" && e.status === "targeting") return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (domainFilter !== "all" && e.domain !== domainFilter) return false;
      return true;
    });
  }, [entries, statusFilter, typeFilter, domainFilter]);

  const counts = useMemo(() => {
    return {
      tried: entries.filter((e) => e.status === "tried").length,
      targeting: entries.filter((e) => e.status === "targeting").length,
      new: entries.filter((e) => e.status === "new").length,
      blacklisted: entries.filter((e) => e.status === "blacklisted").length,
      total: entries.length,
    };
  }, [entries]);

  async function addNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await fetch("/api/pools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        status: newStatus,
        type: newType,
        domain: newDomain,
      }),
    });
    setNewName("");
    await loadEntries();
  }

  async function changeStatus(id: string, status: Status) {
    await fetch(`/api/pools/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadEntries();
  }

  async function togglePriority(id: string, current: Priority | undefined) {
    const next: Priority = (current ?? "high") === "high" ? "low" : "high";
    await fetch(`/api/pools/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: next }),
    });
    await loadEntries();
  }

  async function removeEntry(id: string) {
    if (!confirm("Remove this entry?")) return;
    await fetch(`/api/pools/${id}`, { method: "DELETE" });
    await loadEntries();
  }

  /**
   * Promote a company by name (used by the Rankings panel).
   * If the company already exists in entries, just changes its status.
   * If it doesn't exist, adds a new entry with the given status.
   */
  async function promoteByName(name: string, status: Status) {
    const existing = entries.find(
      (e) => e.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      await changeStatus(existing.id, status);
    } else {
      await fetch("/api/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          status,
          type: "company",
          domain: "other",
        }),
      });
      await loadEntries();
    }
  }

  function candidateKey(c: BatchCandidate): string {
    return `${c.name}|${c.type}|${c.domain}`;
  }

  async function generateBatch() {
    setBatchModalOpen(true);
    setBatchLoading(true);
    setBatchError(null);
    setCandidates([]);
    setSelectedCandidates(new Set());
    try {
      const res = await fetch("/api/batch/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setBatchError(data.error ?? "Failed to generate batch");
      } else {
        setCandidates(data.candidates ?? []);
        const allKeys = new Set<string>(
          (data.candidates ?? []).map((c: BatchCandidate) => candidateKey(c))
        );
        setSelectedCandidates(allKeys);
      }
    } catch (err: any) {
      setBatchError(err?.message ?? "Network error");
    } finally {
      setBatchLoading(false);
    }
  }

  function toggleCandidate(c: BatchCandidate) {
    const key = candidateKey(c);
    const next = new Set(selectedCandidates);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedCandidates(next);
  }

  async function applyBatch() {
    const selected = candidates.filter((c) =>
      selectedCandidates.has(candidateKey(c))
    );
    if (selected.length === 0) return;

    const proceed = confirm(
      `This will:\n` +
        `• Mark all ${counts.targeting} current targets as "tried"\n` +
        `• Promote ${selected.length} new entries to targeting\n\n` +
        `Continue?`
    );
    if (!proceed) return;

    setBatchLoading(true);
    try {
      const res = await fetch("/api/batch/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected: selected.map((c) => ({
            name: c.name,
            type: c.type,
            domain: c.domain,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBatchError(data.error ?? "Failed to apply batch");
        return;
      }
      setBatchModalOpen(false);
      setCandidates([]);
      await loadEntries();
    } finally {
      setBatchLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <h1 className="masthead-title">Sourcing Tracker</h1>
        <div className="masthead-right">
          <div className="masthead-meta">
            <span className="masthead-meta-item">
              <strong>{counts.total}</strong> total
            </span>
            <span className="masthead-meta-item">
              <strong>{counts.tried}</strong> tried
            </span>
            <span className="masthead-meta-item">
              <strong>{counts.new}</strong> new
            </span>
            <span className="masthead-meta-item">
              <strong>{counts.blacklisted}</strong> blacklisted
            </span>
          </div>
          <button
            className="masthead-action"
            onClick={openHistoryModal}
            title="View targeting history & export"
          >
            History & export
          </button>
        </div>
      </header>

      {/* MAIN TAB SWITCHER */}
      <div className="main-tabs">
        <button
          className={`main-tab ${mainTab === "tracker" ? "active" : ""}`}
          onClick={() => setMainTab("tracker")}
        >
          Tracker
        </button>
        <button
          className={`main-tab ${mainTab === "rankings" ? "active" : ""}`}
          onClick={() => setMainTab("rankings")}
        >
          Rankings
        </button>
      </div>

      {mainTab === "rankings" ? (
        <RankingsPanel entries={entries} onPromote={promoteByName} />
      ) : (
      <>
      {/* FEATURED — TARGETING */}
      <section className="featured">
        <div className="featured-head">
          <div>
            <div className="featured-eyebrow">CURRENTLY TARGETING</div>
            <div className="featured-stat">
              <span className="featured-stat-num">{counts.targeting}</span>
              <span className="featured-stat-label">pools targeting</span>
            </div>
            <div className="featured-sub">
              Active pipeline grouped by domain
            </div>
          </div>
          <button
            className="generate-btn"
            onClick={generateBatch}
            disabled={batchLoading}
          >
            <span className="generate-btn-icon">↻</span>
            {batchLoading ? "Generating…" : "Generate next batch"}
          </button>
        </div>

        {targeting.length === 0 ? (
          <div className="featured-empty">
            No active targets. Click "Generate next batch" to surface candidates.
          </div>
        ) : (
          <>
            {targetingHighByDomain.length > 0 && (
              <>
                {targetingLowByDomain.length > 0 && (
                  <div className="targeting-tier-label">
                    Primary targets
                    <span className="targeting-tier-count">
                      {targetingHigh.length}
                    </span>
                  </div>
                )}
                <div className="targeting-groups">
                  {targetingHighByDomain.map(([domain, items]) => (
                    <div key={`high-${domain}`} className="targeting-group">
                      <div className="targeting-group-head">
                        <span className="targeting-group-name">{domain}</span>
                        <span className="targeting-group-count">
                          {items.length}
                        </span>
                      </div>
                      <div className="targeting-list">
                        {items.map((e) => (
                          <div key={e.id} className="targeting-item">
                            <span className="targeting-item-name">{e.name}</span>
                            <div className="targeting-item-actions">
                              <button
                                className="t-action subtle"
                                onClick={() => togglePriority(e.id, e.priority)}
                                title="Demote to secondary"
                              >
                                ↓
                              </button>
                              <button
                                className="t-action"
                                onClick={() => changeStatus(e.id, "tried")}
                                title="Mark tried"
                              >
                                ✓
                              </button>
                              <button
                                className="t-action danger"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Blacklist "${e.name}"? It'll be hidden and excluded from suggestions.`
                                    )
                                  ) {
                                    changeStatus(e.id, "blacklisted");
                                  }
                                }}
                                title="Blacklist"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {targetingLowByDomain.length > 0 && (
              <>
                <div className="targeting-tier-label targeting-tier-label-low">
                  Secondary targets
                  <span className="targeting-tier-count">
                    {targetingLow.length}
                  </span>
                </div>
                <div className="targeting-groups targeting-groups-low">
                  {targetingLowByDomain.map(([domain, items]) => (
                    <div key={`low-${domain}`} className="targeting-group">
                      <div className="targeting-group-head">
                        <span className="targeting-group-name">{domain}</span>
                        <span className="targeting-group-count">
                          {items.length}
                        </span>
                      </div>
                      <div className="targeting-list">
                        {items.map((e) => (
                          <div key={e.id} className="targeting-item">
                            <span className="targeting-item-name">{e.name}</span>
                            <div className="targeting-item-actions">
                              <button
                                className="t-action subtle"
                                onClick={() => togglePriority(e.id, e.priority)}
                                title="Promote to primary"
                              >
                                ↑
                              </button>
                              <button
                                className="t-action"
                                onClick={() => changeStatus(e.id, "tried")}
                                title="Mark tried"
                              >
                                ✓
                              </button>
                              <button
                                className="t-action danger"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Blacklist "${e.name}"? It'll be hidden and excluded from suggestions.`
                                    )
                                  ) {
                                    changeStatus(e.id, "blacklisted");
                                  }
                                }}
                                title="Blacklist"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* ADD ENTRY */}
      {!showAdd ? (
        <button className="add-form-toggle" onClick={() => setShowAdd(true)}>
          + Add entry
        </button>
      ) : (
        <form className="add-form" onSubmit={addNew}>
          <input
            placeholder="Name (e.g., Cresta)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as Status)}
          >
            {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as EntryType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value as Domain)}
          >
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_LABELS[d]}
              </option>
            ))}
          </select>
          <button type="submit" className="add-button">
            Save
          </button>
        </form>
      )}

      {/* ARCHIVE — collapsible */}
      <button
        className={`archive-toggle ${archiveOpen ? "open" : ""}`}
        onClick={() => setArchiveOpen(!archiveOpen)}
      >
        <span className="archive-toggle-chevron">▸</span>
        <span className="archive-toggle-label">Archive</span>
        <span className="archive-toggle-meta">
          {counts.tried} tried · {counts.new} new
          {counts.blacklisted > 0 ? ` · ${counts.blacklisted} blacklisted` : ""}
        </span>
      </button>

      {archiveOpen && (
        <div className="archive-content">
          {/* FILTERS */}
          <div className="filter-bar">
            <div className="filter-group">
              <span className="filter-label">Status</span>
              {(["all", "new", "tried", "blacklisted"] as const).map((s) => (
                <button
                  key={s}
                  className={`filter-chip ${statusFilter === s ? "active" : ""}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "all" ? "All" : STATUS_LABELS[s as Status]}
                </button>
              ))}
            </div>
            <div className="filter-group">
              <span className="filter-label">Type</span>
              {(["all", ...TYPES] as const).map((t) => (
                <button
                  key={t}
                  className={`filter-chip ${typeFilter === t ? "active" : ""}`}
                  onClick={() => setTypeFilter(t as EntryType | "all")}
                >
                  {t === "all" ? "All" : TYPE_LABELS[t as EntryType]}
                </button>
              ))}
            </div>
            <div className="filter-group">
              <span className="filter-label">Domain</span>
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value as Domain | "all")}
                className="filter-chip"
              >
                <option value="all">All domains</option>
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {DOMAIN_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ENTRIES */}
          <div className="archive-section-head">
            <div className="archive-section-title">
              {statusFilter === "all"
                ? "All entries"
                : `${STATUS_LABELS[statusFilter as Status]}`}
            </div>
            <div className="archive-section-count">
              <span>{filtered.length}</span> shown
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading…</div>
          ) : (
        <div className="entries">
          {filtered.map((e) => (
            <div key={e.id} className={`entry status-${e.status}`}>
              <div className="entry-name">{e.name}</div>
              <div className="entry-meta">
                <span className={`status-pill ${e.status}`}>
                  {STATUS_LABELS[e.status]}
                </span>
                <span className="type-pill">{TYPE_LABELS[e.type]}</span>
                <span className="domain-pill">{DOMAIN_LABELS[e.domain]}</span>
              </div>
              {e.notes && <div className="entry-notes">{e.notes}</div>}
              <div className="entry-actions">
                {e.status !== "tried" && (
                  <button
                    className="entry-action"
                    onClick={() => changeStatus(e.id, "tried")}
                  >
                    Mark tried
                  </button>
                )}
                {e.status !== "targeting" && (
                  <button
                    className="entry-action"
                    onClick={() => changeStatus(e.id, "targeting")}
                  >
                    Target
                  </button>
                )}
                {e.status !== "new" && e.status !== "blacklisted" && (
                  <button
                    className="entry-action"
                    onClick={() => changeStatus(e.id, "new")}
                  >
                    Reset
                  </button>
                )}
                {e.status !== "blacklisted" && (
                  <button
                    className="entry-action danger"
                    onClick={() => {
                      if (
                        confirm(
                          `Blacklist "${e.name}"? It'll be hidden from the main view and excluded from suggestions.`
                        )
                      ) {
                        changeStatus(e.id, "blacklisted");
                      }
                    }}
                  >
                    Blacklist
                  </button>
                )}
                {e.status === "blacklisted" && (
                  <button
                    className="entry-action"
                    onClick={() => changeStatus(e.id, "new")}
                  >
                    Un-blacklist
                  </button>
                )}
                <button
                  className="entry-action danger"
                  onClick={() => removeEntry(e.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
        </div>
      )}

      {/* BATCH GENERATION MODAL */}
      {batchModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => !batchLoading && setBatchModalOpen(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title">Next batch — candidate review</div>
                <div className="modal-sub">
                  {batchLoading
                    ? "Claude is analyzing your patterns…"
                    : batchError
                    ? "Error"
                    : `${selectedCandidates.size} of ${candidates.length} selected`}
                </div>
              </div>
              <button
                className="modal-close"
                onClick={() => setBatchModalOpen(false)}
                disabled={batchLoading}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {batchLoading && candidates.length === 0 && (
                <div className="modal-loading">
                  <div className="spinner"></div>
                  <div>Reasoning through your sourcing history…</div>
                  <div className="modal-loading-note">
                    This takes 20–40 seconds.
                  </div>
                </div>
              )}

              {batchError && (
                <div className="modal-error">
                  {batchError}
                  <br />
                  <br />
                  <span style={{ fontSize: 12, fontStyle: "italic" }}>
                    Make sure ANTHROPIC_API_KEY is set in your Vercel project's
                    environment variables.
                  </span>
                </div>
              )}

              {candidates.length > 0 && (
                <div className="candidates">
                  {candidates.map((c) => {
                    const key = candidateKey(c);
                    const checked = selectedCandidates.has(key);
                    return (
                      <label
                        key={key}
                        className={`candidate ${checked ? "checked" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCandidate(c)}
                        />
                        <div className="candidate-body">
                          <div className="candidate-head">
                            <span className="candidate-name">{c.name}</span>
                            {!c.is_existing_entry && (
                              <span className="candidate-tag">NEW</span>
                            )}
                          </div>
                          <div className="candidate-meta">
                            <span className="type-pill">
                              {TYPE_LABELS[c.type]}
                            </span>
                            <span className="domain-pill">
                              {DOMAIN_LABELS[c.domain]}
                            </span>
                          </div>
                          <div className="candidate-reason">{c.reason}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {candidates.length > 0 && (
              <div className="modal-footer">
                <button
                  className="modal-btn ghost"
                  onClick={() => setSelectedCandidates(new Set())}
                  disabled={batchLoading}
                >
                  Clear all
                </button>
                <button
                  className="modal-btn ghost"
                  onClick={() =>
                    setSelectedCandidates(
                      new Set(candidates.map((c) => candidateKey(c)))
                    )
                  }
                  disabled={batchLoading}
                >
                  Select all
                </button>
                <div style={{ flex: 1 }} />
                <button
                  className="modal-btn primary"
                  onClick={applyBatch}
                  disabled={batchLoading || selectedCandidates.size === 0}
                >
                  {batchLoading
                    ? "Applying…"
                    : `Apply (${selectedCandidates.size})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </>
      )}

      {/* HISTORY & EXPORT MODAL — accessible from both tabs */}
      {historyModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setHistoryModalOpen(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title">Targeting history & export</div>
                <div className="modal-sub">
                  {historyLoading
                    ? "Loading history…"
                    : history.length === 0
                    ? "No archived cohorts yet"
                    : `${history.length} archived ${
                        history.length === 1 ? "cohort" : "cohorts"
                      }`}
                </div>
              </div>
              <button
                className="modal-close"
                onClick={() => setHistoryModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {historyLoading && (
                <div className="modal-loading">
                  <div className="spinner" />
                </div>
              )}

              {!historyLoading && history.length === 0 && (
                <div className="history-empty">
                  <p>
                    Targeting cohorts are recorded automatically when you click{" "}
                    <strong>Apply batch</strong> on a generated batch.
                  </p>
                  <p>
                    Each time you finish a sourcing cycle and move to a new
                    batch, the previous cohort is archived here with the date.
                  </p>
                  <p>
                    You can still export your current state below.
                  </p>
                </div>
              )}

              {!historyLoading && history.length > 0 && (
                <div className="history-list">
                  {history.map((cohort) => {
                    const date = new Date(cohort.archivedAt);
                    const dateStr = date.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    });

                    // === DAILY-ACTIVITY rendering ===
                    if (cohort.kind === "daily-activity") {
                      const actions = cohort.actions ?? [];
                      // Newest action first within the day
                      const sortedActions = [...actions].sort(
                        (a, b) => b.at - a.at
                      );
                      // Quick stats: count by destination status
                      const counts: Record<string, number> = {};
                      for (const a of actions) {
                        counts[a.toStatus] = (counts[a.toStatus] ?? 0) + 1;
                      }
                      const summary = Object.entries(counts)
                        .map(
                          ([s, n]) => `${n} → ${STATUS_LABELS[s as Status]}`
                        )
                        .join(" · ");

                      return (
                        <div
                          key={cohort.id}
                          className="history-cohort history-cohort-daily"
                        >
                          <div className="history-cohort-head">
                            <div className="history-cohort-date">
                              Daily activity — {dateStr}
                            </div>
                            <div className="history-cohort-count">
                              {actions.length}{" "}
                              {actions.length === 1 ? "action" : "actions"}
                              {summary ? ` · ${summary}` : ""}
                            </div>
                          </div>
                          <div className="history-actions">
                            {sortedActions.map((a, i) => {
                              const time = new Date(a.at).toLocaleTimeString(
                                "en-US",
                                { hour: "numeric", minute: "2-digit" }
                              );
                              return (
                                <div
                                  key={`${a.name}-${a.at}-${i}`}
                                  className="history-action"
                                >
                                  <span className="history-action-time">
                                    {time}
                                  </span>
                                  <span className="history-action-name">
                                    {a.name}
                                  </span>
                                  <span
                                    className={`status-pill ${a.fromStatus}`}
                                    style={{ opacity: 0.5 }}
                                  >
                                    {STATUS_LABELS[a.fromStatus]}
                                  </span>
                                  <span className="history-action-arrow">
                                    →
                                  </span>
                                  <span
                                    className={`status-pill ${a.toStatus}`}
                                  >
                                    {STATUS_LABELS[a.toStatus]}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    // === BATCH-APPLY rendering (legacy + ongoing) ===
                    // Group entries by domain
                    const groups: Record<string, typeof cohort.entries> = {};
                    for (const e of cohort.entries) {
                      const k = DOMAIN_LABELS[e.domain];
                      groups[k] = groups[k] ?? [];
                      groups[k].push(e);
                    }
                    return (
                      <div key={cohort.id} className="history-cohort">
                        <div className="history-cohort-head">
                          <div className="history-cohort-date">
                            Batch archived — {dateStr}
                          </div>
                          <div className="history-cohort-count">
                            {cohort.entries.length} entries archived
                          </div>
                        </div>
                        <div className="history-cohort-body">
                          {Object.entries(groups)
                            .sort((a, b) => b[1].length - a[1].length)
                            .map(([domain, items]) => (
                              <div key={domain} className="history-domain">
                                <span className="history-domain-name">
                                  {domain}
                                </span>
                                <span className="history-domain-list">
                                  {items.map((i) => i.name).join(", ")}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <a
                href="/api/export/csv"
                download
                className="modal-btn ghost"
              >
                ↓ Export CSV
              </a>
              <a
                href="/api/export/markdown"
                download
                className="modal-btn ghost"
              >
                ↓ Export Markdown
              </a>
              <div style={{ flex: 1 }} />
              <button
                className="modal-btn primary"
                onClick={() => setHistoryModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
