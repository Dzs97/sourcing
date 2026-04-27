# Sourcing Dossier

Personal recruiting ops tracker. Tracks which talent pools you've **tried**, which you're **targeting**, and surfaces **new** ones based on the domains you've already engaged with. Pre-seeded with the lists from your conversation (companies, schools, communities, competitions).

## Stack

- Next.js 14 (App Router)
- Vercel KV for storage (free tier)
- TypeScript
- Zero CSS framework — hand-written editorial dossier aesthetic

## Local development

```bash
npm install
npm run dev
```

Without KV credentials in `.env.local`, the app uses an in-memory store seeded with the data in `lib/seed.ts`. Useful for testing the UI; data resets on server restart.

## Deploy to Vercel (free tier)

1. Push this repo to GitHub.
2. Import into Vercel.
3. In the Vercel dashboard → **Storage** → **Create Database** → **KV**. Connect it to your project. The env vars (`KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc.) are auto-injected.
4. Redeploy. First load seeds the KV store from `lib/seed.ts`.

## Data model

Each entry has:

- **status**: `tried` | `targeting` | `new`
- **type**: `company` | `school` | `community` | `competition`
- **domain**: `frontier-ai`, `healthcare-ai`, `defense`, `infra-devtools`, `cs-school`, `olympiad`, etc. (full list in `lib/types.ts`)
- **notes**: optional free text
- **name**: display name

## Suggestion engine

Rule-based for now (`lib/suggest.ts`):

1. Counts how many entries you've engaged with (tried + targeting) per domain.
2. For each active domain, surfaces `new` entries you haven't acted on.
3. Ranks by domain engagement (more activity = stronger signal that adjacent entries are relevant).
4. Filterable by entry type — pick "School" to see only school suggestions, etc.

To add LLM-powered suggestions later, swap or augment `generateSuggestions` to call the Anthropic API with the user's full entry list as context.

## Adding entries

Click **+ Add entry** at the top. Fill in name, status, type, domain. Hit save. New entries persist to KV immediately.

## Promoting suggestions

Each suggestion in the dark block has a **→ Move to targeting** button. Click it and the entry's status flips from `new` to `targeting`, so it shows up in your targeting list and stops appearing as a suggestion.

## Resetting / re-seeding

If you want to wipe and re-seed from `lib/seed.ts`:

```ts
import { resetToSeed } from "@/lib/storage";
await resetToSeed();
```

Easiest way: temporarily call this from a route handler, hit the URL once, then remove.
