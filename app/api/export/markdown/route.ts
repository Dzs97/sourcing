import { NextResponse } from "next/server";
import { getEntries } from "@/lib/storage";
import { getHistory } from "@/lib/history-storage";
import { DOMAIN_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/types";
import type { Entry } from "@/lib/types";

export const dynamic = "force-dynamic";

function fmtDate(ts: number | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtDateShort(ts: number | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function groupByDomain(entries: Entry[]): Record<string, Entry[]> {
  const groups: Record<string, Entry[]> = {};
  for (const e of entries) {
    const key = DOMAIN_LABELS[e.domain];
    groups[key] = groups[key] ?? [];
    groups[key].push(e);
  }
  return groups;
}

export async function GET() {
  const entries = await getEntries();
  const history = await getHistory();

  const targeting = entries
    .filter((e) => e.status === "targeting")
    .sort((a, b) => a.name.localeCompare(b.name));
  const tried = entries.filter((e) => e.status === "tried");
  const newPool = entries.filter((e) => e.status === "new");
  const blacklisted = entries.filter((e) => e.status === "blacklisted");

  const today = fmtDate(Date.now());

  const lines: string[] = [];
  lines.push(`# Sourcing Tracker — ${today}`);
  lines.push("");
  lines.push(
    `**Total entries:** ${entries.length} · **Currently targeting:** ${targeting.length} · **Tried:** ${tried.length} · **New pool:** ${newPool.length} · **Blacklisted:** ${blacklisted.length}`
  );
  lines.push("");

  // Currently targeting (most important section)
  lines.push("## Currently targeting");
  lines.push("");
  if (targeting.length === 0) {
    lines.push("_No active targets._");
  } else {
    const grouped = groupByDomain(targeting);
    for (const [domain, items] of Object.entries(grouped).sort(
      (a, b) => b[1].length - a[1].length
    )) {
      lines.push(`### ${domain} (${items.length})`);
      lines.push("");
      for (const e of items) {
        const date = e.targetedAt
          ? ` — _added ${fmtDateShort(e.targetedAt)}_`
          : "";
        lines.push(`- **${e.name}**${date}`);
      }
      lines.push("");
    }
  }

  // Targeting history (cohorts)
  lines.push("## Targeting history");
  lines.push("");
  if (history.length === 0) {
    lines.push(
      "_No archived cohorts yet. Cohorts are recorded when you apply a new batch._"
    );
  } else {
    const sortedHistory = [...history].sort(
      (a, b) => b.archivedAt - a.archivedAt
    );
    for (const cohort of sortedHistory) {
      lines.push(
        `### Cohort archived ${fmtDate(cohort.archivedAt)} — ${cohort.entries.length} entries`
      );
      lines.push("");
      const grouped = groupByDomain(
        cohort.entries.map((e) => ({
          ...e,
          id: "",
          status: "tried" as const,
          addedAt: 0,
        }))
      );
      for (const [domain, items] of Object.entries(grouped)) {
        const names = items.map((i) => i.name).join(", ");
        lines.push(`- **${domain}** (${items.length}): ${names}`);
      }
      lines.push("");
    }
  }

  // Tried (collapsed by default in the doc — too long otherwise)
  lines.push(`## Tried (${tried.length})`);
  lines.push("");
  if (tried.length > 0) {
    lines.push("<details>");
    lines.push("<summary>Click to expand the tried list</summary>");
    lines.push("");
    const grouped = groupByDomain(tried);
    for (const [domain, items] of Object.entries(grouped).sort(
      (a, b) => b[1].length - a[1].length
    )) {
      const names = items
        .map((i) => i.name)
        .sort((a, b) => a.localeCompare(b))
        .join(", ");
      lines.push(`- **${domain}** (${items.length}): ${names}`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  // New pool
  lines.push(`## In new pool (${newPool.length})`);
  lines.push("");
  if (newPool.length > 0) {
    lines.push("<details>");
    lines.push("<summary>Click to expand the new pool</summary>");
    lines.push("");
    const grouped = groupByDomain(newPool);
    for (const [domain, items] of Object.entries(grouped).sort(
      (a, b) => b[1].length - a[1].length
    )) {
      const names = items
        .map((i) => i.name)
        .sort((a, b) => a.localeCompare(b))
        .join(", ");
      lines.push(`- **${domain}** (${items.length}): ${names}`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  // Blacklisted
  if (blacklisted.length > 0) {
    lines.push(`## Blacklisted (${blacklisted.length})`);
    lines.push("");
    for (const e of blacklisted) {
      lines.push(`- ~~${e.name}~~ (${DOMAIN_LABELS[e.domain]})`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`_Exported from Sourcing Tracker on ${today}_`);

  const md = lines.join("\n");
  const filename = `sourcing-tracker-${new Date().toISOString().split("T")[0]}.md`;

  return new NextResponse(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
