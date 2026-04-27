"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Entry,
  Status,
  EntryType,
  Domain,
  Suggestion,
} from "@/lib/types";
import {
  DOMAIN_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from "@/lib/types";

const DOMAINS = Object.keys(DOMAIN_LABELS) as Domain[];
const TYPES = Object.keys(TYPE_LABELS) as EntryType[];

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [typeFilter, setTypeFilter] = useState<EntryType | "all">("all");
  const [domainFilter, setDomainFilter] = useState<Domain | "all">("all");
  const [suggestionTypeFilter, setSuggestionTypeFilter] = useState<
    EntryType | "all"
  >("all");

  // Add form state
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState<Status>("targeting");
  const [newType, setNewType] = useState<EntryType>("company");
  const [newDomain, setNewDomain] = useState<Domain>("frontier-ai");

  async function loadEntries() {
    const res = await fetch("/api/pools");
    const data = await res.json();
    setEntries(data.entries);
  }

  async function loadSuggestions() {
    const url =
      suggestionTypeFilter === "all"
        ? "/api/suggest"
        : `/api/suggest?type=${suggestionTypeFilter}`;
    const res = await fetch(url);
    const data = await res.json();
    setSuggestions(data.suggestions);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadEntries();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!loading) loadSuggestions();
  }, [entries, suggestionTypeFilter, loading]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      // Hide blacklisted entries unless explicitly viewing them
      if (statusFilter !== "blacklisted" && e.status === "blacklisted") return false;
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

  async function removeEntry(id: string) {
    if (!confirm("Remove this entry?")) return;
    await fetch(`/api/pools/${id}`, { method: "DELETE" });
    await loadEntries();
  }

  async function promote(s: Suggestion) {
    // Suggestion is already in entries with status "new" — find it and bump to targeting
    const match = entries.find(
      (e) => e.name === s.name && e.type === s.type && e.domain === s.domain
    );
    if (match) {
      await changeStatus(match.id, "targeting");
    } else {
      // Edge case: not in entries (shouldn't happen with rule-based) — add it
      await fetch("/api/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: s.name,
          status: "targeting",
          type: s.type,
          domain: s.domain,
        }),
      });
      await loadEntries();
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <h1 className="masthead-title">
          The Sourcing <span className="italic">Dossier</span>
        </h1>
        <div className="masthead-meta">
          <strong>{counts.total}</strong> entries · <strong>{counts.tried}</strong> tried
          <br />
          <strong>{counts.targeting}</strong> targeting · <strong>{counts.new}</strong> new · <strong>{counts.blacklisted}</strong> blacklisted
        </div>
      </header>

      {/* SUGGESTIONS BLOCK */}
      <section className="suggestions">
        <div className="suggestions-head">Suggested next moves</div>
        <div className="suggestions-sub">
          Based on your active domains
        </div>

        <div className="filter-bar" style={{ background: "transparent", borderColor: "var(--ink-soft)" }}>
          <div className="filter-group">
            <span className="filter-label">Filter</span>
            {(["all", ...TYPES] as const).map((t) => (
              <button
                key={t}
                className={`filter-chip ${suggestionTypeFilter === t ? "active" : ""}`}
                style={
                  suggestionTypeFilter === t
                    ? { background: "var(--accent)", color: "var(--paper)", borderColor: "var(--accent)" }
                    : { background: "transparent", color: "var(--ink-fade)", borderColor: "var(--ink-soft)" }
                }
                onClick={() => setSuggestionTypeFilter(t as EntryType | "all")}
              >
                {t === "all" ? "All" : TYPE_LABELS[t as EntryType]}
              </button>
            ))}
          </div>
        </div>

        {suggestions.length === 0 ? (
          <div className="suggestions-empty">
            No suggestions — every domain you've engaged with has been mined.
          </div>
        ) : (
          <div className="suggestion-list">
            {suggestions.map((s, i) => (
              <div key={`${s.name}-${i}`} className="suggestion">
                <div className="suggestion-name">{s.name}</div>
                <div className="suggestion-meta">
                  {TYPE_LABELS[s.type]} · {DOMAIN_LABELS[s.domain]}
                </div>
                <div className="suggestion-reason">{s.reason}</div>
                <button
                  className="suggestion-promote"
                  onClick={() => promote(s)}
                >
                  → Move to targeting
                </button>
              </div>
            ))}
          </div>
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

      {/* FILTERS */}
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">Status</span>
          {(["all", "targeting", "new", "tried", "blacklisted"] as const).map((s) => (
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
            style={{ padding: "4px 10px" }}
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
      <div className="section-head">
        <div className="section-title">
          {statusFilter === "all" ? "All entries" : `${STATUS_LABELS[statusFilter as Status]}`}
        </div>
        <div className="section-counts">
          <span>{filtered.length}</span> shown · {counts.total} total
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading dossier…</div>
      ) : (
        <div className="entries">
          {filtered.map((e) => (
            <div key={e.id} className={`entry status-${e.status}`}>
              <div className="entry-name">{e.name}</div>
              <div className="entry-meta">
                <span>{STATUS_LABELS[e.status]}</span>
                <span>{TYPE_LABELS[e.type]}</span>
                <span className="domain">{DOMAIN_LABELS[e.domain]}</span>
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
                      if (confirm(`Blacklist "${e.name}"? It'll be hidden from the main view and excluded from suggestions.`)) {
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
    </main>
  );
}
