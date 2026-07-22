"use client";

import { useEffect, useMemo, useState } from "react";
import matrixData from "@/lib/matrix-data.json";
import type { Entry, Domain } from "@/lib/types";
import { DOMAIN_LABELS } from "@/lib/types";

interface MatrixAdditions {
  additions: Record<string, string[]>;
  updated_at: number;
}
const addKey = (fn: string, role: string, group: string) =>
  `${fn}::${role}::${group}`;

/**
 * Categorize a target-group label into a section so the matrix reads
 * top-down as: talent programs → investor networks → companies →
 * schools → awards/research → regional → historical → other.
 *
 * The Historical tracker groups auto-injected from the DB and any
 * user-added groups slot into the appropriate section by label match,
 * so the sourcer sees "all school lists together" instead of scattered
 * across the role card.
 */
const SECTIONS: {
  key: string;
  label: string;
  match: (l: string) => boolean;
}[] = [
  {
    key: "search-keywords",
    label: "Search keywords",
    match: (l) => /(search\s+titles?|search\s+keywords?|boolean|title[s]?\s*&\s*keywords?|role\s+titles?|product\s+&\s+leadership)/i.test(l),
  },
  {
    key: "talent-programs",
    label: "Talent programs & pipelines",
    match: (l) =>
      /(fellowship|residency|scholar|talent pipeline|pipelines?|consulting club|clubs?|fellow[s]?\b)/i.test(l),
  },
  {
    key: "investors",
    label: "Investor networks",
    match: (l) => /(vc|venture|portfolio|fund|investor|theme|sequoia|a16z|greylock|thrive|founders fund|iconiq|nea|coatue|bessemer|kleiner|neos)/i.test(l),
  },
  {
    key: "companies",
    label: "Companies & IPOs",
    match: (l) =>
      /(company target|companies|ipo|scale filter|gaming|startups?|late[- ]stage|early[- ]stage|management trainee|banks?|consultants?|private equity|hedge fund|law firm|target compan)/i.test(l),
  },
  {
    key: "schools",
    label: "Schools & academic",
    match: (l) =>
      /(school|univers|college|liberal arts|high\s+school|hs\b|kmla|design program|art school|clubs?\s+—\s+SNU|clubs?\s+—\s+Yonsei|clubs?\s+—\s+KAIST|clubs?\s+—\s+Korea|cross-university|historical tracker.*(school|high|university|research))/i.test(l),
  },
  {
    key: "awards",
    label: "Awards & research signals",
    match: (l) =>
      /(olympiad|award|research lab|conference|neurips|icml|iclr|ml \/ nlp|competition|open.source|historical tracker.*(olympiad|open|research)|scholarship)/i.test(l),
  },
  {
    key: "regional",
    label: "Regional & geo",
    match: (l) =>
      /(israel|hk\b|hong ?kong|geo|misc|middle east|arabic|malay|thai|korea|japan|taiwan|china|india|singapore|australia|europe|latin|region|regional|country|arabic speakers|defense tech.*(uae|israel))/i.test(l),
  },
  {
    key: "profile",
    label: "Profile & sourcing signals",
    match: (l) => /(profile|signals?|sourcing|archetype|excludes?)/i.test(l),
  },
  {
    key: "historical",
    label: "Historical tracker snapshots",
    match: (l) => /^historical tracker/i.test(l),
  },
];
const OTHER = { key: "other", label: "Other" };

function sectionFor(label: string) {
  for (const s of SECTIONS) if (s.match(label)) return s;
  return OTHER;
}

interface TargetGroup {
  label: string;
  items: string[];
}
interface Role {
  role: string;
  yoe?: string;
  status?: string;
  profile?: string[];
  targets?: TargetGroup[];
}
interface FunctionBlock {
  function: string;
  note?: string;
  sharedTargets?: TargetGroup[];
  sharedSchools?: TargetGroup[];
  roles: Role[];
}

// Engineering-flavoured domains — used to slice the tracker DB into an
// "Engineering — Historical Tracker Data" block appended to the Engineering
// section. Anything else is out of scope for this view.
const ENG_DOMAINS: Domain[] = [
  "frontier-ai",
  "infra-devtools",
  "defense",
  "bio-ai",
  "research-lab",
  "fintech",
  "vertical-saas",
  "cs-school",
  "elite-hs",
  "fellowship",
  "olympiad",
  "open-source",
  "neos-portco",
];

export default function MatrixPanel({ entries }: { entries: Entry[] }) {
  const data = matrixData as { title: string; functions: FunctionBlock[] };

  // ---- User additions overlay ----
  const [adds, setAdds] = useState<MatrixAdditions>({
    additions: {},
    updated_at: 0,
  });
  const [syncing, setSyncing] = useState<"rankings" | "historical" | null>(
    null
  );
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function loadAdditions() {
    try {
      const res = await fetch("/api/matrix");
      if (!res.ok) return;
      const j = (await res.json()) as MatrixAdditions;
      setAdds(j);
    } catch {}
  }
  useEffect(() => {
    loadAdditions();
  }, []);

  async function addItemsToGroup(
    fn: string,
    role: string,
    group: string,
    items: string[]
  ) {
    const clean = items.map((s) => s.trim()).filter(Boolean);
    if (clean.length === 0) return;
    const res = await fetch("/api/matrix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: fn, role, group, items: clean }),
    });
    if (res.ok) setAdds(await res.json());
  }
  async function deleteItem(
    fn: string,
    role: string,
    group: string,
    item: string
  ) {
    const res = await fetch("/api/matrix", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ function: fn, role, group, item }),
    });
    if (res.ok) setAdds(await res.json());
  }
  async function runSync(mode: "rankings" | "historical") {
    setSyncing(mode);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/matrix/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, topN: 50 }),
      });
      const j = await res.json();
      if (res.ok) {
        setSyncMsg(`✓ Synced ${j.added} ${mode === "rankings" ? "ranked companies" : "historical entries"}`);
        await loadAdditions();
      } else {
        setSyncMsg(`✗ ${j.error ?? "Sync failed"}`);
      }
    } catch (err: any) {
      setSyncMsg(`✗ ${err?.message ?? "Network error"}`);
    } finally {
      setSyncing(null);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  }
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Try localStorage first — remember collapse state across sessions.
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("matrix.expanded");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    const m: Record<string, boolean> = {};
    for (const f of data.functions) m[f.function] = true;
    return m;
  });
  // Persist collapse state on change.
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("matrix.expanded", JSON.stringify(expanded));
    } catch {}
  }

  // Group the tracker DB by domain for the "Engineering — Historical" block
  const engHistorical = useMemo(() => {
    const byDomain = new Map<Domain, Entry[]>();
    for (const e of entries) {
      if (!ENG_DOMAINS.includes(e.domain)) continue;
      const arr = byDomain.get(e.domain) ?? [];
      arr.push(e);
      byDomain.set(e.domain, arr);
    }
    // Sort each bucket by name for stable rendering
    for (const arr of byDomain.values()) {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    }
    return byDomain;
  }, [entries]);

  const toggle = (key: string) =>
    setExpanded((s) => ({ ...s, [key]: !s[key] }));

  return (
    <section className="matrix">
      <div className="matrix-header">
        <div className="matrix-title-row">
          <h2 className="matrix-title">{data.title}</h2>
          <div className="matrix-sync">
            <button
              className={`matrix-sync-btn ${syncing === "rankings" ? "loading" : ""}`}
              onClick={() => runSync("rankings")}
              disabled={syncing !== null}
              title="Add top-50 ranked companies (not yet in tracker) to Engineering"
            >
              {syncing === "rankings" ? "…" : "⟳"} Sync rankings
            </button>
            <button
              className={`matrix-sync-btn ${syncing === "historical" ? "loading" : ""}`}
              onClick={() => runSync("historical")}
              disabled={syncing !== null}
              title="Snapshot all eng-domain tracker entries into the matrix"
            >
              {syncing === "historical" ? "…" : "⟳"} Sync historical
            </button>
            {syncMsg && <span className="matrix-sync-msg">{syncMsg}</span>}
          </div>
        </div>
        <div className="matrix-sub">
          Recruiting targets by function → role. Use ⟳ Sync rankings to add
          top-ranked companies you haven't tracked yet, or ⟳ Sync historical
          to snapshot your DB into the matrix. Add-only — nothing gets
          removed unless you click the × on an item.
        </div>
      </div>

      {data.functions.map((f) => (
        <div
          key={f.function}
          className="matrix-function"
          data-function={functionSlug(f.function)}
        >
          <button
            className="matrix-function-head"
            onClick={() => toggle(f.function)}
          >
            <span className="matrix-caret">
              {expanded[f.function] ? "▾" : "▸"}
            </span>
            <span className="matrix-function-name">{f.function}</span>
            <span className="matrix-role-count">
              {f.roles.length} role{f.roles.length === 1 ? "" : "s"}
            </span>
          </button>

          {expanded[f.function] && (
            <div className="matrix-function-body">
              {f.note && <div className="matrix-note">{f.note}</div>}

              {/* Roles first — this is what we're actively searching for. */}
              {f.roles.map((r) => {
                // For Engineering, merge historical tracker data into the
                // Product/Founding Engineer role's target groups so all
                // sourcing pools live in one place instead of a sibling card.
                const extraTargets: TargetGroup[] =
                  f.function === "Engineering" &&
                  r.role === "Product / Founding Engineer"
                    ? [...engHistorical.entries()]
                        .sort((a, b) => b[1].length - a[1].length)
                        .map(([domain, arr]) => ({
                          label: `Historical tracker — ${DOMAIN_LABELS[domain]}`,
                          items: arr.map((e) => e.name),
                        }))
                    : [];
                // Append user-added groups that don't already exist on the role
                const baseLabels = new Set(
                  [...(r.targets ?? []), ...extraTargets].map((g) => g.label)
                );
                const userGroups: TargetGroup[] = Object.entries(adds.additions)
                  .filter(([k]) => {
                    const [afn, arole] = k.split("::");
                    return afn === f.function && arole === r.role;
                  })
                  .map(([k, items]) => {
                    const [, , gLabel] = k.split("::");
                    return { label: gLabel, items } as TargetGroup;
                  })
                  .filter((g) => !baseLabels.has(g.label));
                return (
                  <RoleCard
                    key={r.role}
                    fn={f.function}
                    role={
                      extraTargets.length || userGroups.length
                        ? { ...r, targets: [...(r.targets ?? []), ...extraTargets, ...userGroups] }
                        : r
                    }
                    adds={adds}
                    onAdd={addItemsToGroup}
                    onDelete={deleteItem}
                  />
                );
              })}

              {/* Shared targets/schools below the roles — they apply across
                  the ladder above but belong under "how we source", not
                  "who we're looking for". */}
              {f.sharedTargets && (
                <SharedBlock title="Shared targets" groups={f.sharedTargets} />
              )}
              {f.sharedSchools && (
                <SharedBlock title="Shared schools" groups={f.sharedSchools} />
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

// Stable slug per top-level function — drives the section glow color.
function functionSlug(name: string): string {
  const s = name.toLowerCase();
  if (s.startsWith("finance")) return "finance";
  if (s.startsWith("legal")) return "legal";
  if (s.startsWith("engineering")) return "engineering";
  if (s.startsWith("design")) return "design";
  if (s.startsWith("growth")) return "growth";
  if (s.startsWith("operations")) return "ops";
  return "default";
}

function SharedBlock({
  title,
  groups,
}: {
  title: string;
  groups: TargetGroup[];
}) {
  return (
    <div className="matrix-shared">
      <div className="matrix-shared-title">{title}</div>
      {groups.map((g) => (
        <TargetGroupBlock key={g.label} label={g.label} items={g.items} />
      ))}
    </div>
  );
}

function RoleCard({
  fn,
  role,
  adds,
  onAdd,
  onDelete,
}: {
  fn: string;
  role: Role;
  adds: MatrixAdditions;
  onAdd: (fn: string, role: string, group: string, items: string[]) => Promise<void>;
  onDelete: (fn: string, role: string, group: string, item: string) => Promise<void>;
}) {
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupItems, setNewGroupItems] = useState("");
  async function submitNewGroup() {
    const label = newGroupName.trim();
    const items = newGroupItems
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!label || items.length === 0) return;
    await onAdd(fn, role.role, label, items);
    setNewGroupName("");
    setNewGroupItems("");
    setShowNewGroup(false);
  }
  return (
    <div className="matrix-role">
      <div className="matrix-role-head">
        <div className="matrix-role-name">
          {role.role}
          {role.status && (
            <span className="matrix-role-status">[{role.status}]</span>
          )}
        </div>
        {role.yoe && <div className="matrix-role-yoe">{role.yoe}</div>}
      </div>
      {role.profile && role.profile.length > 0 && (
        <ul className="matrix-role-profile">
          {role.profile.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
      {/* Groups are rendered inside category sections so related lists
          (schools, investors, etc.) sit together instead of scattered. */}
      {(() => {
        const bySection = new Map<string, TargetGroup[]>();
        for (const g of role.targets ?? []) {
          const s = sectionFor(g.label);
          const arr = bySection.get(s.key) ?? [];
          arr.push(g);
          bySection.set(s.key, arr);
        }
        const ordered = [...SECTIONS, OTHER].filter((s) =>
          bySection.has(s.key)
        );
        return ordered.map((section) => {
          const groups = bySection.get(section.key) ?? [];
          return (
            <div key={section.key} className="matrix-section">
              <div className="matrix-section-title">{section.label}</div>
              {groups.map((g) => {
                const k = addKey(fn, role.role, g.label);
                const userItems = adds.additions[k] ?? [];
                const combined = [...g.items];
                const seen = new Set(g.items.map((x) => x.toLowerCase()));
                const userOnly = new Set<string>();
                for (const it of userItems) {
                  if (!seen.has(it.toLowerCase())) {
                    combined.push(it);
                    userOnly.add(it.toLowerCase());
                  }
                }
                return (
                  <TargetGroupBlock
                    key={g.label}
                    label={g.label}
                    items={combined}
                    userOnly={userOnly}
                    onAddItems={(items) =>
                      onAdd(fn, role.role, g.label, items)
                    }
                    onDeleteItem={(item) =>
                      onDelete(fn, role.role, g.label, item)
                    }
                  />
                );
              })}
            </div>
          );
        });
      })()}
      {/* Add a brand-new target group under this role */}
      {showNewGroup ? (
        <div className="matrix-newgroup">
          <input
            className="matrix-newgroup-name"
            placeholder="Group label (e.g. 'YC W26 founders')"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <textarea
            className="matrix-newgroup-items"
            placeholder="Items, one per line (or comma-separated)"
            value={newGroupItems}
            onChange={(e) => setNewGroupItems(e.target.value)}
            rows={3}
          />
          <div className="matrix-newgroup-actions">
            <button className="matrix-copy" onClick={submitNewGroup}>
              ✓ Add group
            </button>
            <button
              className="matrix-copy"
              onClick={() => {
                setShowNewGroup(false);
                setNewGroupName("");
                setNewGroupItems("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="matrix-newgroup-toggle"
          onClick={() => setShowNewGroup(true)}
        >
          + New group under {role.role}
        </button>
      )}
    </div>
  );
}

function TargetGroupBlock({
  label,
  items,
  collapseAt = 20,
  userOnly,
  onAddItems,
  onDeleteItem,
}: {
  label: string;
  items: string[];
  collapseAt?: number;
  userOnly?: Set<string>;
  onAddItems?: (items: string[]) => Promise<void>;
  onDeleteItem?: (item: string) => Promise<void>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addInput, setAddInput] = useState("");
  const overflow = items.length > collapseAt;
  const visible = showAll || !overflow ? items : items.slice(0, collapseAt);

  async function submitAdd() {
    if (!onAddItems) return;
    const parts = addInput
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    await onAddItems(parts);
    setAddInput("");
    setAdding(false);
  }

  async function copyList() {
    try {
      await navigator.clipboard.writeText(items.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <div className="matrix-group">
      <div className="matrix-group-head">
        <div className="matrix-group-label">
          {label} <span className="matrix-group-count">({items.length})</span>
        </div>
        <button
          className={`matrix-copy ${copied ? "copied" : ""}`}
          onClick={copyList}
          title="Copy list to clipboard (newline-separated)"
        >
          {copied ? "✓ Copied" : "⧉ Copy"}
        </button>
      </div>
      <div className="matrix-group-items">
        {visible.map((it, i) => {
          const isUser = userOnly?.has(it.toLowerCase()) ?? false;
          return (
            <span
              key={i}
              className={`matrix-chip ${isUser ? "user-added" : ""}`}
            >
              {it}
              {isUser && onDeleteItem && (
                <button
                  className="matrix-chip-x"
                  onClick={() => onDeleteItem(it)}
                  title="Remove this addition"
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
      </div>
      {overflow && (
        <button
          className="matrix-expand"
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll
            ? "Show fewer"
            : `Show ${items.length - collapseAt} more →`}
        </button>
      )}
      {onAddItems && (
        adding ? (
          <div className="matrix-additem">
            <textarea
              className="matrix-additem-input"
              placeholder="One item per line, or comma-separated"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              rows={2}
              autoFocus
            />
            <div className="matrix-additem-actions">
              <button className="matrix-copy" onClick={submitAdd}>
                ✓ Add
              </button>
              <button
                className="matrix-copy"
                onClick={() => {
                  setAdding(false);
                  setAddInput("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="matrix-additem-toggle"
            onClick={() => setAdding(true)}
          >
            + Add item
          </button>
        )
      )}
    </div>
  );
}
