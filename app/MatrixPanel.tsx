"use client";

import { useMemo, useState } from "react";
import matrixData from "@/lib/matrix-data.json";
import type { Entry, Domain } from "@/lib/types";
import { DOMAIN_LABELS } from "@/lib/types";

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Default: all sections open
    const m: Record<string, boolean> = {};
    for (const f of data.functions) m[f.function] = true;
    m["__eng_historical"] = true;
    return m;
  });

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
        <h2 className="matrix-title">{data.title}</h2>
        <div className="matrix-sub">
          Recruiting targets by function → role, with years of experience and
          grouped sourcing lists. Engineering historical tracker data is
          appended at the bottom of the Engineering section.
        </div>
      </div>

      {data.functions.map((f) => (
        <div key={f.function} className="matrix-function">
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

              {f.sharedTargets && (
                <SharedBlock title="Shared targets" groups={f.sharedTargets} />
              )}
              {f.sharedSchools && (
                <SharedBlock title="Shared schools" groups={f.sharedSchools} />
              )}

              {f.roles.map((r) => (
                <RoleCard key={r.role} role={r} />
              ))}

              {/* Engineering — historical tracker data */}
              {f.function === "Engineering" && (
                <div className="matrix-role">
                  <div className="matrix-role-head">
                    <div className="matrix-role-name">
                      Engineering — Historical Tracker Data
                    </div>
                    <div className="matrix-role-yoe">
                      {[...engHistorical.values()].reduce(
                        (n, arr) => n + arr.length,
                        0
                      )}{" "}
                      entries across {engHistorical.size} domains
                    </div>
                  </div>
                  {[...engHistorical.entries()]
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([domain, arr]) => (
                      <TargetGroupBlock
                        key={domain}
                        label={`${DOMAIN_LABELS[domain]} (${arr.length})`}
                        items={arr.map((e) => e.name)}
                        collapseAt={40}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
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

function RoleCard({ role }: { role: Role }) {
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
      {role.targets?.map((g) => (
        <TargetGroupBlock key={g.label} label={g.label} items={g.items} />
      ))}
    </div>
  );
}

function TargetGroupBlock({
  label,
  items,
  collapseAt = 20,
}: {
  label: string;
  items: string[];
  collapseAt?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const overflow = items.length > collapseAt;
  const visible = showAll || !overflow ? items : items.slice(0, collapseAt);
  return (
    <div className="matrix-group">
      <div className="matrix-group-label">
        {label} <span className="matrix-group-count">({items.length})</span>
      </div>
      <div className="matrix-group-items">
        {visible.map((it, i) => (
          <span key={i} className="matrix-chip">
            {it}
          </span>
        ))}
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
    </div>
  );
}
