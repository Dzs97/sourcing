"use client";

import { useEffect, useMemo, useState } from "react";

export interface HandoffSeed {
  candidateName: string;
  currentCompany?: string;
  pool?: string;
  score?: number | string;
  scoreBreakdown?: string;
}

interface Props {
  open: boolean;
  seed: HandoffSeed | null;
  onClose: () => void;
}

/**
 * Column order MUST match your Sourced sheet's row-1 headers exactly.
 * These are the 13 named columns up through "Notes"; the message columns
 * that follow (Message 1 date / from / type × ~13) are left blank because
 * they are outreach-time, not handoff-time.
 *
 * IMPORTANT: this assumes a "Ranking" column between Calibration and
 * Current Stage. Add that column to your sheet or the row will land
 * one cell off. Everything else matches your current headers verbatim.
 */
const COLUMNS = [
  "Cohort",
  "Tag",
  "Date",
  "Name",
  "Current Company",
  "Location",
  "Calibration",
  "Ranking",
  "Current Stage",
  "Recent message date",
  "Current Owner",
  "Response date",
  "Notes",
] as const;

const STAGES = [
  "To be scheduled",
  "Initial Screen",
  "On-site/Build",
  "Offer stage",
  "Pending start",
  "On Hold",
  "Drop",
] as const;

const SHEET_URL = process.env.NEXT_PUBLIC_HANDOFF_SHEET_URL ?? "";
const DOC_URL = process.env.NEXT_PUBLIC_HANDOFF_DOC_URL ?? "";

function calRenderUrl(title: string, body: string): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details: body,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** TSV-safe: tabs and newlines become spaces. */
function tsvCell(v: string | number | undefined | null): string {
  return String(v ?? "").replace(/[\t\r\n]+/g, " ").trim();
}

/** YYYY-MM-DD in local time — matches how the sheet displays dates. */
function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    return false;
  }
}

export default function HandoffModal({ open, seed, onClose }: Props) {
  const [cohort, setCohort] = useState("");
  const [tag, setTag] = useState("");
  const [name, setName] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [location, setLocation] = useState("");
  const [calibration, setCalibration] = useState("");
  const [stage, setStage] = useState<(typeof STAGES)[number]>("To be scheduled");
  const [owner, setOwner] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rowCopied, setRowCopied] = useState(false);
  const [blockCopied, setBlockCopied] = useState(false);
  const [staged, setStaged] = useState(false);

  const ranking = seed?.score ?? "";

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRowCopied(false);
    setBlockCopied(false);
    setStaged(false);
    setCohort("");
    setTag(seed?.pool ?? seed?.currentCompany ?? "");
    setName(seed?.candidateName ?? "");
    setCurrentRole("");
    setCurrentCompany(seed?.currentCompany ?? "");
    setLocation("");
    // Pre-fill Calibration with a Rankings summary as a starting one-liner
    // — the sourcer overwrites with their own narrative before submitting.
    setCalibration(
      seed?.scoreBreakdown
        ? `${seed.scoreBreakdown}${seed?.score !== undefined ? ` · score ${seed.score}` : ""}`
        : ""
    );
    setStage("To be scheduled");
    setOwner("");
    setNotes("");
  }, [open, seed]);

  const dateIso = useMemo(() => todayIso(), [staged]);

  const row = useMemo(() => {
    return [
      cohort,
      tag,
      dateIso,
      name,
      currentCompany,
      location,
      calibration,
      ranking,
      stage,
      "", // Recent message date — outreach-time
      owner,
      "", // Response date — outreach-time
      notes,
    ].map(tsvCell);
  }, [cohort, tag, dateIso, name, currentCompany, location, calibration, ranking, stage, owner, notes]);

  const tsv = row.join("\t");

  const docBlock = useMemo(() => {
    const bg = [currentRole, currentCompany].filter(Boolean).join(" @ ");
    const lines = [
      `**${name || "(no name)"}** — ${stage}`,
      bg && `- Background: ${bg}`,
      tag && `- Source pool: ${tag}`,
      location && `- Location: ${location}`,
      ranking !== "" && `- Ranking: ${ranking}${seed?.scoreBreakdown ? ` (${seed.scoreBreakdown})` : ""}`,
      calibration && `- Calibration: ${calibration}`,
      owner && `- Owner: ${owner}`,
      notes && `- Sourcer note: ${notes}`,
      `- Added: ${dateIso}`,
    ].filter(Boolean);
    return lines.join("\n");
  }, [name, stage, currentRole, currentCompany, tag, location, ranking, seed, calibration, owner, notes, dateIso]);

  async function stage_() {
    if (!name.trim() || !tag.trim()) {
      setError("Candidate name and Tag (pool) are required.");
      return;
    }
    setError(null);
    const ok = await copyText(tsv);
    if (ok) setRowCopied(true);
    setStaged(true);
  }

  async function copyRow() {
    const ok = await copyText(tsv);
    setRowCopied(ok);
    if (!ok) setError("Clipboard denied — select the row below and ⌘C.");
    else setTimeout(() => setRowCopied(false), 1600);
  }
  async function copyBlock() {
    const ok = await copyText(docBlock);
    setBlockCopied(ok);
    if (!ok) setError("Clipboard denied — select the block below and ⌘C.");
    else setTimeout(() => setBlockCopied(false), 1600);
  }

  if (!open) return null;

  const sheetConfigured = !!SHEET_URL;
  const docConfigured = !!DOC_URL;
  const anyConfigured = sheetConfigured || docConfigured;

  const calTitle = `Intro — ${name || "candidate"}`;
  const calBody = `${name}${currentRole ? " · " + currentRole : ""}${currentCompany ? " @ " + currentCompany : ""}\nSource pool: ${tag}\nCurrent stage: ${stage}\n${location ? "Location: " + location + "\n" : ""}${calibration ? "\nCalibration: " + calibration + "\n" : ""}${notes ? "\nSourcer note: " + notes : ""}`;

  return (
    <div className="palette-backdrop" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="handoff-modal" role="dialog" aria-label="Handoff a candidate">
        <div className="handoff-head">
          <div>
            <div className="handoff-eyebrow">HANDOFF</div>
            <h2 className="handoff-title">Push a candidate to your Sheet + Doc</h2>
            <div className="handoff-sub">
              Formats the row against your real Sourced sheet columns, copies it to your clipboard, and gives you a formatted block for the feedback Doc under the right stage heading. No API keys needed.
            </div>
          </div>
          <button className="handoff-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {!anyConfigured && (
          <div className="handoff-warn">
            No destination URLs set. Add <code>NEXT_PUBLIC_HANDOFF_SHEET_URL</code> and <code>NEXT_PUBLIC_HANDOFF_DOC_URL</code> to <code>.env.local</code> — see <code>SETUP-HANDOFF.md</code>. You can still format + copy without them.
          </div>
        )}

        {staged ? (
          <div className="handoff-body">
            <div className="handoff-ok-title">
              {rowCopied ? "✓ Sheet row copied" : "Row ready"}
            </div>

            <div className="handoff-tsv-preview" aria-label="Row that was copied">
              <div className="handoff-tsv-label">Sheet row · 13 tab-separated cells (Cohort → Notes)</div>
              <pre className="handoff-tsv"><code>{tsv}</code></pre>
              <button className="handoff-copy-again" onClick={copyRow}>
                {rowCopied ? "Copied" : "Copy again"}
              </button>
            </div>

            <div className="handoff-tsv-preview" aria-label="Doc block">
              <div className="handoff-tsv-label">Doc block · paste under the <b>{stage}</b> heading</div>
              <pre className="handoff-tsv"><code>{docBlock}</code></pre>
              <button className="handoff-copy-again" onClick={copyBlock}>
                {blockCopied ? "Copied" : "Copy block"}
              </button>
            </div>

            <div className="handoff-actions-grid">
              <a
                className={`handoff-launch ${sheetConfigured ? "" : "disabled"}`}
                href={sheetConfigured ? SHEET_URL : undefined}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => { if (!sheetConfigured) e.preventDefault(); }}
              >
                <span className="handoff-launch-verb">1 · Paste row into Sheet</span>
                <span className="handoff-launch-what">{sheetConfigured ? "Sourced Candidates ↗" : "Sheet URL not set"}</span>
              </a>
              <a
                className={`handoff-launch ${docConfigured ? "" : "disabled"}`}
                href={docConfigured ? DOC_URL : undefined}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => { if (!docConfigured) e.preventDefault(); }}
              >
                <span className="handoff-launch-verb">2 · Paste block into Doc</span>
                <span className="handoff-launch-what">{docConfigured ? `Under "${stage}" ↗` : "Doc URL not set"}</span>
              </a>
              <a
                className="handoff-launch"
                href={calRenderUrl(calTitle, calBody)}
                target="_blank"
                rel="noreferrer"
              >
                <span className="handoff-launch-verb">3 · Draft Cal event</span>
                <span className="handoff-launch-what">Google Calendar (prefilled) ↗</span>
              </a>
            </div>

            <div className="handoff-actions">
              <button className="handoff-cancel" onClick={() => setStaged(false)}>← Back to edit</button>
              <button className="handoff-submit" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <div className="handoff-body">
            <div className="handoff-grid">
              <label>
                <span>Candidate name<em>*</em></span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </label>
              <label>
                <span>Tag (pool)<em>*</em></span>
                <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Ramp, KAIST '22 CS" />
              </label>
              <label>
                <span>Current role</span>
                <input value={currentRole} onChange={(e) => setCurrentRole(e.target.value)} placeholder="For the Doc block; not a sheet column" />
              </label>
              <label>
                <span>Current company</span>
                <input value={currentCompany} onChange={(e) => setCurrentCompany(e.target.value)} />
              </label>
              <label>
                <span>Location</span>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="SF, NYC, remote…" />
              </label>
              <label>
                <span>Cohort</span>
                <input value={cohort} onChange={(e) => setCohort(e.target.value)} placeholder="e.g. Q4-2026" />
              </label>
              <label>
                <span>Current stage</span>
                <select value={stage} onChange={(e) => setStage(e.target.value as typeof STAGES[number])}>
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>
                <span>Current owner</span>
                <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="your name" />
              </label>
            </div>
            <label className="handoff-full">
              <span>Calibration (one-line narrative — prefilled from Rankings)</span>
              <input value={calibration} onChange={(e) => setCalibration(e.target.value)} placeholder="e.g. Strong payments infra background; light on ML" />
            </label>
            <label className="handoff-full">
              <span>Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything the sheet + doc should carry."
              />
            </label>
            <details className="handoff-columns">
              <summary>Sheet columns (13, in order) — assumes a "Ranking" column exists</summary>
              <div className="handoff-columns-list">{COLUMNS.join(" · ")}</div>
            </details>
            {error && <div className="handoff-error">{error}</div>}
            <div className="handoff-actions">
              <button className="handoff-cancel" onClick={onClose}>Cancel</button>
              <button className="handoff-submit" onClick={stage_}>
                Format &amp; copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
