# Sourcing Tracker

Personal recruiting ops tracker. Tracks talent pools you've **tried**, are **targeting**, have in your **new** pool, or have **blacklisted**. The targeting list is featured at the top. When you've worked through it, hit **Generate next batch** — Claude analyzes your patterns and proposes a fresh batch of candidates.

## Quick start

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
5. Redeploy.

## Cross-device data persistence

**This is critical.** Whether your data persists across devices and users depends entirely on whether Upstash Redis is connected.

| Scenario | What happens |
|---|---|
| Upstash IS connected | All visitors (any device, any browser) see the same shared dataset. Changes save immediately. |
| Upstash IS NOT connected | Each Vercel serverless instance keeps its own ephemeral copy. Different visitors may see different data. Data resets when functions cold-start. |

**To verify your setup:** visit `https://your-app.vercel.app/api/health` after deploying. The response tells you exactly which mode you're in:

```json
{
  "status": "OK",
  "storage": {
    "mode": "persistent (Upstash Redis)",
    "reachable": true,
    "entry_count": 250,
    "upstash_url_set": true,
    "upstash_token_set": true
  },
  "llm": {
    "anthropic_key_set": true,
    "note": "Generate next batch will work"
  },
  "cross_device_sharing": "ENABLED — all visitors see the same data"
}
```

If `cross_device_sharing` says **DISABLED**, you need to:
1. Go to your Vercel project → **Storage** tab
2. Click **Marketplace** → search **Upstash Redis** → **Add integration**
3. Connect it to this project. Vercel auto-injects the env vars.
4. Redeploy.

After that, hit `/api/health` again to confirm.

## Status model

| Status | What it means | Where it shows |
|---|---|---|
| **targeting** | Actively being mined | Featured top block, grouped by domain |
| **tried** | Already mined / saturated | Archive section |
| **new** | In pool, awaiting attention | Archive section |
| **blacklisted** | Excluded forever | Hidden by default; filter to view |

## Generate next batch (LLM-powered)

Click **↻ Generate next batch** in the dark featured block.

1. Claude reads your full sourcing state (tried, targeting, blacklisted, new pool).
2. It proposes 30 candidates with a one-line reason for each.
3. You review and uncheck any you don't want, then click **Apply**.
4. Old targeting entries → marked `tried`. Selected candidates → promoted to `targeting`.

Tags:
- **NEW** badge means Claude proposed a brand-new entry not in your DB. It'll be added.
- No badge means it was already in your `new` pool, just being promoted.

The first call typically takes 20–40 seconds.

## Reset targeting list to canonical 39

After deploy, GET `/api/admin/reset-targeting` for a dry run, then POST to apply.

## Manual admin actions

- **`POST /api/pools`** — add entry (UI does this)
- **`PATCH /api/pools/[id]`** — change status (UI does this)
- **`DELETE /api/pools/[id]`** — permanent delete (UI does this)
- **`POST /api/admin/reset-targeting`** — sync targeting to canonical seed
- **`POST /api/batch/generate`** — get LLM candidates (no DB mutation)
- **`POST /api/batch/apply`** — promote selected candidates, demote old targets
- **`GET /api/health`** — verify storage and LLM config
