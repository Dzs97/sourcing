# Sourcing Dossier

Personal recruiting ops tracker. Tracks which talent pools you've **tried**, which you're **targeting**, which are in the **new** pool waiting for review, and which are **blacklisted**. The targeting list is featured at the top. When you've worked through it, hit **Generate next batch** — Claude analyzes your patterns and proposes a fresh batch of candidates.

## Stack

- Next.js 15 (App Router) + React 19
- Upstash Redis for storage (Vercel free tier)
- Anthropic API for batch generation
- TypeScript, hand-written CSS in editorial dossier aesthetic

## Local development

```bash
npm install
npm run dev
```

Without env credentials, the app uses an in-memory store seeded from `lib/seed.ts`. Useful for testing the UI; data resets on server restart.

## Deploy to Vercel (free tier)

1. Push this repo to GitHub.
2. Import into Vercel.
3. **Storage** → Marketplace → **Upstash Redis** → connect to project. Env vars (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) auto-inject.
4. **Project Settings** → **Environment Variables** → add `ANTHROPIC_API_KEY` from https://console.anthropic.com/settings/keys
5. Redeploy. First load seeds the database from `lib/seed.ts`.

## Status model

| Status | What it means | Where it shows |
|---|---|---|
| **targeting** | Actively being mined | Featured top block, grouped by domain |
| **tried** | Already mined / saturated | Archive section |
| **new** | In pool, awaiting attention | Archive section |
| **blacklisted** | Excluded forever | Hidden by default; filter to view |

## Generate next batch (LLM-powered)

Click **↻ Generate next batch** in the top dark block.

1. Claude reads your full sourcing state (tried, targeting, blacklisted, new pool).
2. It proposes 30 candidates with a one-line reason for each.
3. You review the list, uncheck any you don't want, click **Apply**.
4. Old targeting entries → marked `tried`. Selected candidates → promoted to `targeting`.

Tags:
- **NEW** badge means Claude proposed a brand-new entry not in your DB. It'll be added.
- No badge means it was already in your `new` pool, just being promoted.

The first call typically takes 20–40 seconds (Claude is reasoning over your full history).

## Reset targeting list to canonical 39

After deploy, GET `/api/admin/reset-targeting` for a dry run, then POST to apply. Forces your targeting list to exactly match the canonical 39 from the seed file.

## Manual admin actions

- **`POST /api/pools`** — add entry (UI does this)
- **`PATCH /api/pools/[id]`** — change status (UI does this)
- **`DELETE /api/pools/[id]`** — permanent delete (UI does this)
- **`POST /api/admin/reset-targeting`** — sync targeting to canonical seed
- **`POST /api/batch/generate`** — get LLM candidates (no DB mutation)
- **`POST /api/batch/apply`** — promote selected candidates, demote old targets
