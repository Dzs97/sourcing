"use client";

import { useEffect, useMemo, useState } from "react";
import type { PoolYield } from "@/lib/pool-yield";
import type { Ranking } from "@/lib/rankings-types";

export interface PromptSeed {
  tag: string;
  yield?: PoolYield & { ranking?: Ranking };
}

interface Props {
  open: boolean;
  seed: PromptSeed | null;
  onClose: () => void;
}

const LEVELS = ["junior", "mid", "senior", "staff+", "principal"] as const;
const FUNCTIONS = [
  "software engineer",
  "ML engineer",
  "infra / platform",
  "founding engineer",
  "product engineer",
  "design",
  "product",
] as const;

async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    return false;
  }
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default function PoolPromptModal({ open, seed, onClose }: Props) {
  const [tag, setTag] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("senior");
  const [fn, setFn] = useState<(typeof FUNCTIONS)[number]>("software engineer");
  const [location, setLocation] = useState("");
  const [roleContext, setRoleContext] = useState("");
  const [count, setCount] = useState(20);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTag(seed?.tag ?? "");
    setLevel("senior");
    setFn("software engineer");
    setLocation("");
    setRoleContext("");
    setCount(20);
    setCopied(null);
  }, [open, seed]);

  const claudePrompt = useMemo(() => {
    const r = seed?.yield?.ranking;
    const hasCal = r && r.total_votes > 0;
    const yieldSummary = seed?.yield
      ? hasCal
        ? `Context on this pool: ${seed.yield.sourced} sourced so far · calibration score ${r!.total_score.toFixed(1)} (★${r!.superstar} · Yes ${r!.yes} · Maybe ${r!.maybe} · No ${r!.no}). Prioritise candidates likely to match the pattern of the strong signals above.`
        : `Context on this pool: ${seed.yield.sourced} sourced so far; no calibration signal yet.`
      : "";
    return [
      `Find ${count} candidates currently at ${tag || "<pool>"} who match:`,
      `- Level: ${level}`,
      `- Function: ${fn}`,
      location ? `- Location: ${location}` : `- Location: any`,
      roleContext ? `- Role context: ${roleContext}` : null,
      "",
      "For each candidate return a table row with:",
      "1. Full name",
      "2. Current role and team",
      "3. Location",
      "4. LinkedIn profile URL",
      "5. One-line reason they might fit",
      "6. 1-3 links to relevant work (GitHub, papers, blog, prior product)",
      "",
      "Return as a markdown table. Skip anyone whose LinkedIn is not accessible.",
      yieldSummary && "",
      yieldSummary,
      "",
      "Also suggest 5 adjacent pools I might not have sourced from yet, and one",
      "line each explaining why they're structurally similar.",
    ]
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .join("\n");
  }, [tag, level, fn, location, roleContext, count, seed]);

  const linkedinUrl = useMemo(() => {
    const q = `${level} ${fn} ${tag}${location ? " " + location : ""}`.trim();
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
  }, [tag, level, fn, location]);

  const boolean = useMemo(() => {
    const parts = [
      `site:linkedin.com/in`,
      `"${level}"`,
      `"${fn}"`,
      `"${tag || "<pool>"}"`,
    ];
    if (location) parts.push(`"${location}"`);
    return parts.join(" ");
  }, [tag, level, fn, location]);

  async function copy(kind: string, text: string) {
    const ok = await copyText(text);
    if (ok) {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    }
  }

  if (!open) return null;

  return (
    <div className="palette-backdrop" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="handoff-modal ppm-modal" role="dialog" aria-label="Draft a sourcing prompt">
        <div className="handoff-head">
          <div>
            <div className="handoff-eyebrow">SOURCE MORE FROM</div>
            <h2 className="handoff-title">{tag || "New pool"}</h2>
            <div className="handoff-sub">
              Fills a Claude-in-Chrome prompt, a LinkedIn search URL, and a
              boolean X-ray string. Copy the one you use, paste, source.
            </div>
          </div>
          <button className="handoff-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {seed?.yield && (
          <div className="ppm-stats">
            <div><span>{seed.yield.sourced}</span>sourced</div>
            {seed.yield.ranking && seed.yield.ranking.total_votes > 0 ? (
              <>
                <div><span>{seed.yield.ranking.superstar || "·"}</span>★</div>
                <div><span>{seed.yield.ranking.yes || "·"}</span>Yes</div>
                <div><span>{seed.yield.ranking.maybe || "·"}</span>Maybe</div>
                <div><span>{seed.yield.ranking.no || "·"}</span>No</div>
                <div><span>{seed.yield.ranking.total_score.toFixed(1)}</span>score</div>
              </>
            ) : (
              <div><span>—</span>no calibration yet</div>
            )}
          </div>
        )}

        <div className="handoff-body">
          <div className="handoff-grid">
            <label>
              <span>Pool (Tag)<em>*</em></span>
              <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Anthropic" />
            </label>
            <label>
              <span>Level</span>
              <select value={level} onChange={(e) => setLevel(e.target.value as typeof LEVELS[number])}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label>
              <span>Function</span>
              <select value={fn} onChange={(e) => setFn(e.target.value as typeof FUNCTIONS[number])}>
                {FUNCTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label>
              <span>Location</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="SF, NYC, remote…" />
            </label>
            <label>
              <span>Count</span>
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 20)))}
              />
            </label>
          </div>
          <label className="handoff-full">
            <span>Role context (grounds the prompt — one line)</span>
            <input
              value={roleContext}
              onChange={(e) => setRoleContext(e.target.value)}
              placeholder="e.g. Need someone with payments infra depth and product taste"
            />
          </label>

          <div className="ppm-prompts">
            <div className="ppm-prompt">
              <div className="ppm-prompt-head">
                <div className="ppm-prompt-title">Claude-in-Chrome prompt</div>
                <button className="handoff-copy-again ppm-inline-copy" onClick={() => copy("claude", claudePrompt)}>
                  {copied === "claude" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="handoff-tsv ppm-pre"><code>{claudePrompt}</code></pre>
            </div>

            <div className="ppm-prompt">
              <div className="ppm-prompt-head">
                <div className="ppm-prompt-title">LinkedIn search</div>
                <div className="ppm-prompt-actions">
                  <button className="handoff-copy-again ppm-inline-copy" onClick={() => copy("li", linkedinUrl)}>
                    {copied === "li" ? "Copied" : "Copy URL"}
                  </button>
                  <a className="ppm-open-link" href={linkedinUrl} target="_blank" rel="noreferrer">Open ↗</a>
                </div>
              </div>
              <pre className="handoff-tsv ppm-pre ppm-pre-small"><code>{linkedinUrl}</code></pre>
            </div>

            <div className="ppm-prompt">
              <div className="ppm-prompt-head">
                <div className="ppm-prompt-title">Boolean X-ray (Google)</div>
                <button className="handoff-copy-again ppm-inline-copy" onClick={() => copy("bool", boolean)}>
                  {copied === "bool" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="handoff-tsv ppm-pre ppm-pre-small"><code>{boolean}</code></pre>
            </div>
          </div>

          <div className="handoff-actions">
            <button className="handoff-cancel" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
