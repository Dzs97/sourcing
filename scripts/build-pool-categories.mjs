#!/usr/bin/env node
/**
 * One-shot: use Claude Haiku to categorize the top-sourced pools from
 * lib/local-rankings.ts into a small fixed taxonomy, and write the result
 * to lib/pool-categories.ts. PoolsPanel imports the mapping to render the
 * coverage rollup at the top of the tab and to filter by category.
 *
 * Reads ANTHROPIC_API_KEY from .env.local. Regenerate whenever you refresh
 * calibration data with many new companies.
 *
 * Usage:
 *   node scripts/build-pool-categories.mjs [limit]
 *   # limit defaults to 500 top-voted pools
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// --- minimal .env.local loader (no dep) ---------------------------------
function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error(
    "ANTHROPIC_API_KEY not set. Add it to .env.local or export it in your shell."
  );
  process.exit(1);
}

// --- categories --------------------------------------------------------
const CATEGORIES = [
  "foundation-lab", // OpenAI, Anthropic, xAI, Mistral
  "big-tech", // Google, Meta, Apple, Amazon, Microsoft, Nvidia
  "ai-startup", // Cursor, Decagon, Perplexity, Harvey
  "data-infra", // Databricks, Snowflake, Palantir, Confluent
  "devtools", // GitHub, Vercel, Linear, Notion, HashiCorp
  "fintech", // Stripe, Ramp, Brex, Coinbase, Robinhood
  "trading", // Jane Street, Citadel, Two Sigma, HRT, DE Shaw
  "robotics", // Tesla, Waymo, Cruise, Boston Dynamics
  "defense", // Anduril, SpaceX, Shield AI, Lockheed
  "research-lab", // DeepMind, FAIR, MSR, Meta AI, non-academic labs
  "university", // MIT, Stanford, CMU, Berkeley (and other schools)
  "consumer", // Discord, Instacart, Airbnb, Uber
  "healthtech", // Insitro, Recursion, Genesis, Isomorphic
  "other",
];

const CATEGORY_LIST = CATEGORIES.join(", ");

// --- read pools --------------------------------------------------------
const rankingsPath = path.join(ROOT, "lib/local-rankings.ts");
if (!fs.existsSync(rankingsPath)) {
  console.error(
    "lib/local-rankings.ts not found. Run scripts/build-local-rankings.mjs first."
  );
  process.exit(1);
}
const rankingsText = fs.readFileSync(rankingsPath, "utf8");
const jsonStart = rankingsText.indexOf("{");
const bundle = JSON.parse(rankingsText.slice(jsonStart).replace(/;\s*$/, ""));

const limit = parseInt(process.argv[2] ?? "500", 10);
const pools = bundle.rankings
  .filter((r) => r.total_votes > 0)
  .sort((a, b) => b.total_votes - a.total_votes)
  .slice(0, limit)
  .map((r) => r.company);
console.error(`Categorizing ${pools.length} pools with Claude Haiku…`);

// --- call Anthropic ----------------------------------------------------
async function categorizeBatch(batch) {
  const prompt = `Categorize each of the companies/organizations below into EXACTLY one of these categories: ${CATEGORY_LIST}.

Guidelines:
- foundation-lab: LLM foundation-model labs (OpenAI, Anthropic, xAI, Mistral, Cohere, AI21, Reka, Inflection)
- big-tech: Established tech giants over ~10k employees (Google, Meta, Apple, Amazon, Microsoft, Nvidia, IBM, Netflix, Oracle)
- ai-startup: AI product companies (Cursor, Decagon, Perplexity, Harvey, Hebbia, Rogo, Character.AI)
- data-infra: Data platforms, cloud/edge infra, security (Databricks, Snowflake, Palantir, Confluent, MongoDB, CoreWeave, HashiCorp)
- devtools: Developer productivity tools (GitHub, Vercel, Linear, Notion, Airtable, PlanetScale, Retool)
- fintech: Payments, banking, crypto, personal finance (Stripe, Ramp, Brex, Coinbase, Robinhood, Plaid, Square)
- trading: Quant / trading / market-making firms (Jane Street, Citadel, Two Sigma, HRT, DE Shaw, Optiver, Jump)
- robotics: Autonomy, cars, robots, drones (Tesla, Waymo, Cruise, Boston Dynamics, Zoox, Skydio)
- defense: Defense / aerospace / dual-use (Anduril, SpaceX, Shield AI, Lockheed, Raytheon, Palantir if primarily defense-facing)
- research-lab: Industry research labs (DeepMind, FAIR, MSR, Google Research). NOT academic universities.
- university: Universities, colleges, schools (MIT, Stanford, CMU, Berkeley, Harvard, IITs, KAIST, Tsinghua, high schools)
- consumer: Consumer products, marketplaces, gig apps (Discord, Instacart, Airbnb, Uber, DoorDash, Reddit, TikTok, Netflix if primarily consumer)
- healthtech: Bio/health AI, diagnostics, drug discovery (Insitro, Recursion, Genesis, Isomorphic, Freenome, PathAI)
- other: Anything that doesn't clearly fit

Rules:
- Output ONLY a JSON object mapping company name → category.
- Use the EXACT company name as given.
- Every company must have a category. If uncertain, use "other".
- Do not include any prose, markdown, or code fences.

Companies:
${batch.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  let text = data.content?.[0]?.text ?? "";
  // Strip accidental code fences
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(text);
}

const BATCH = 120;
const categories = {};
for (let i = 0; i < pools.length; i += BATCH) {
  const batch = pools.slice(i, i + BATCH);
  console.error(`  batch ${Math.floor(i / BATCH) + 1} — ${batch.length} pools…`);
  try {
    const mapping = await categorizeBatch(batch);
    for (const [name, cat] of Object.entries(mapping)) {
      const clean = CATEGORIES.includes(cat) ? cat : "other";
      categories[name] = clean;
    }
  } catch (e) {
    console.error(`  batch failed: ${e.message}`);
  }
}

// Any pool we sent but didn't get back → other
for (const p of pools) {
  if (!(p in categories)) categories[p] = "other";
}

// Distribution
const dist = {};
for (const c of Object.values(categories)) dist[c] = (dist[c] ?? 0) + 1;
console.error("\nDistribution:");
for (const [c, n] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  console.error(`  ${c.padEnd(16)} ${n}`);
}

// --- write file --------------------------------------------------------
const outPath = path.join(ROOT, "lib/pool-categories.ts");
const banner = `// Auto-generated by scripts/build-pool-categories.mjs on ${new Date().toISOString()}.
// Do not edit by hand. Regenerate:
//   node scripts/build-pool-categories.mjs [limit]
`;
const body = `export type PoolCategory =
  | "foundation-lab"
  | "big-tech"
  | "ai-startup"
  | "data-infra"
  | "devtools"
  | "fintech"
  | "trading"
  | "robotics"
  | "defense"
  | "research-lab"
  | "university"
  | "consumer"
  | "healthtech"
  | "other";

export const CATEGORY_LABELS: Record<PoolCategory, string> = {
  "foundation-lab": "Foundation labs",
  "big-tech": "Big tech",
  "ai-startup": "AI startups",
  "data-infra": "Data / infra",
  "devtools": "Devtools",
  "fintech": "Fintech",
  "trading": "Trading",
  "robotics": "Robotics",
  "defense": "Defense",
  "research-lab": "Research labs",
  "university": "Universities",
  "consumer": "Consumer",
  "healthtech": "Health tech",
  "other": "Other",
};

export const CATEGORY_ORDER: PoolCategory[] = [
  "foundation-lab",
  "big-tech",
  "ai-startup",
  "data-infra",
  "devtools",
  "fintech",
  "trading",
  "robotics",
  "defense",
  "research-lab",
  "university",
  "consumer",
  "healthtech",
  "other",
];

export const POOL_CATEGORIES: Record<string, PoolCategory> = ${JSON.stringify(
  categories,
  null,
  2
)};
`;
fs.writeFileSync(outPath, banner + "\n" + body, "utf8");
console.error(`\nWrote ${outPath} (${Object.keys(categories).length} entries)`);
