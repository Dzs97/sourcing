# Handoff setup

The `↗ Handoff` button on Rankings rows opens a modal that:

1. Formats a tab-separated row matching the 13 named columns of your **Sourced Candidates** sheet.
2. Formats a markdown block ready to paste under a stage heading in your **feedback Doc**.
3. Copies each to your clipboard on demand and opens three launch tiles: Sheet, Doc, and a prefilled Google Calendar quick-create.

No Google Cloud project, no service account, no API keys.

Time budget: **~2 minutes**. Your sheet + doc already exist; you just paste their URLs.

---

## 1. Add a **Ranking** column to your sheet

The handoff row assumes a **Ranking** column sits between **Calibration** and **Current Stage**. That is the only structural change to your sheet.

Open your Sourced Candidates sheet → right-click the header of the **Current Stage** column → **Insert 1 column left** → name it `Ranking`.

*Why:* the Rankings tab in the app produces a numeric score from calibration data uploads. The **Calibration** column stays your written one-liner; **Ranking** captures the number so both live side-by-side without one overwriting the other.

The final column order the handoff row targets is:

| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cohort | Tag | Date | Name | Current Company | Location | Calibration | **Ranking** | Current Stage | Recent message date | Current Owner | Response date | Notes |

The message-tracking columns after **Notes** (`Message 1 date / from / type` × ~13) stay as they are — the handoff row leaves them blank because they're outreach-time, not handoff-time.

## 2. Paste the two URLs into `.env.local`

Create `~/Downloads/sourcing-tracker/.env.local` if it doesn't exist, and add:

```env
NEXT_PUBLIC_HANDOFF_SHEET_URL=https://docs.google.com/spreadsheets/d/…/edit
NEXT_PUBLIC_HANDOFF_DOC_URL=https://docs.google.com/document/d/…/edit
```

## 3. Restart the dev server

`Ctrl-C` in the `npm run dev` terminal, then `npm run dev` again. `NEXT_PUBLIC_*` vars only load on server start.

## 4. Try it

Open <http://localhost:3000> → **Rankings** → hit **↗ Handoff** on any scored row.

- Fill Cohort, Tag (prefilled from the row's company), Current stage (defaults to *To be scheduled*), Calibration (prefilled with a Rankings summary — overwrite with your one-liner), and Notes.
- Click **Format & copy**.
- You'll see two preview blocks + three launch tiles.
- **1** → Sheet opens → paste at the next empty row. The 13 tab-separated cells drop into A–M.
- **2** → Doc opens → scroll to the right stage heading → paste the block.
- **3** → Google Calendar's event editor opens, prefilled with title + candidate context.

---

## Rolling back

Everything is client-side and env-driven. To disable handoff, remove the two env vars — the modal keeps working for formatting/copying but the launch tiles show "URL not set".

To restore the earlier service-account version (auto-append to Sheet, auto-create Doc, auto-draft Cal): the code lives in git history before the zero-API rebuild.
