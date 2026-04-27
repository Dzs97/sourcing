import { NextResponse } from "next/server";
import { getEntries } from "@/lib/storage";
import { getHistory } from "@/lib/history-storage";
import { DOMAIN_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

function csvCell(v: string | number | undefined): string {
  if (v === undefined || v === null) return "";
  const s = String(v);
  // Escape if contains comma, quote, or newline
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtDate(ts: number | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

export async function GET() {
  const entries = await getEntries();
  const history = await getHistory();

  // Sort: targeting first, then new, tried, blacklisted; alpha within
  const statusOrder: Record<string, number> = {
    targeting: 0,
    new: 1,
    tried: 2,
    blacklisted: 3,
  };
  const sorted = [...entries].sort((a, b) => {
    const so = statusOrder[a.status] - statusOrder[b.status];
    if (so !== 0) return so;
    return a.name.localeCompare(b.name);
  });

  const lines: string[] = [];
  lines.push("Name,Status,Type,Domain,Date Targeted,Date Added,Notes");
  for (const e of sorted) {
    lines.push(
      [
        csvCell(e.name),
        csvCell(STATUS_LABELS[e.status]),
        csvCell(TYPE_LABELS[e.type]),
        csvCell(DOMAIN_LABELS[e.domain]),
        csvCell(fmtDate(e.targetedAt)),
        csvCell(fmtDate(e.addedAt)),
        csvCell(e.notes),
      ].join(",")
    );
  }

  // Append history section as a separate block
  lines.push("");
  lines.push("");
  lines.push("# TARGETING COHORT HISTORY");
  lines.push(
    "Cohort Archived,Entry Name,Type,Domain,Date Targeted (if known)"
  );
  const sortedHistory = [...history].sort((a, b) => b.archivedAt - a.archivedAt);
  for (const cohort of sortedHistory) {
    const dateStr = fmtDate(cohort.archivedAt);
    for (const entry of cohort.entries) {
      lines.push(
        [
          csvCell(dateStr),
          csvCell(entry.name),
          csvCell(TYPE_LABELS[entry.type]),
          csvCell(DOMAIN_LABELS[entry.domain]),
          csvCell(fmtDate(entry.targetedAt)),
        ].join(",")
      );
    }
  }

  const csv = lines.join("\n");
  const filename = `sourcing-tracker-${fmtDate(Date.now())}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
