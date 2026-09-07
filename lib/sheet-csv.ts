/**
 * Small utilities for reading a Google Sheet as CSV.
 * The sheet must be link-viewable ("Anyone with the link → Viewer") for
 * the export endpoint to return without auth.
 */

/**
 * Extract sheetId + gid from a Google Sheets edit URL and produce the
 * public CSV export URL. Throws on a URL that isn't a Google Sheet.
 *
 * Accepted inputs:
 *   https://docs.google.com/spreadsheets/d/<id>/edit#gid=123
 *   https://docs.google.com/spreadsheets/d/<id>/edit?gid=123
 *   https://docs.google.com/spreadsheets/d/<id>/edit?usp=sharing
 *
 * gid defaults to 0 when not present in the URL.
 */
export function toCsvExportUrl(sheetUrl: string): string {
  const m = /\/spreadsheets\/d\/([^/]+)/.exec(sheetUrl);
  if (!m) throw new Error("Not a Google Sheets URL");
  const sheetId = m[1];
  const gidMatch = /[?#&]gid=(\d+)/.exec(sheetUrl);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

/**
 * RFC-4180-ish CSV parser. Handles quoted fields with embedded commas,
 * newlines, and doubled-quote escapes. Enough for Google Sheets output.
 * Returns rows of cells; trailing empty last-row is dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // drop
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop a fully-empty trailing row (common with CSV files ending in \n).
  if (rows.length > 0 && rows[rows.length - 1].every((c) => c === "")) {
    rows.pop();
  }
  return rows;
}
