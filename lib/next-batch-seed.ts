// April 29 2026 next-batch — 30 companies, small/early-stage with strong VC backing,
// avoiding healthcare/bio. Names include lead VC in parens.
//
// Two kinds of entries:
//   - "rename": entries that already exist in the tracker under a plain name;
//     this endpoint will delete the old entry and re-add with the VC-suffixed name as targeting.
//   - "new": entries to add fresh.
//
// All entries get status=targeting, targetedAt=now.

import type { EntryType, Domain } from "./types";

export interface NextBatchSeed {
  /** Final name including lead VC in parens, e.g., "Goodfire (Menlo)" */
  finalName: string;
  /** If this is a rename of an existing tracker entry, the old name to look up. */
  renameFrom?: string;
  /** Status is always targeting. domain & type are required for new entries / re-adds. */
  type: EntryType;
  domain: Domain;
  note?: string;
}

export const NEXT_BATCH_2026_04_29: NextBatchSeed[] = [
  // === Renames of existing "new" pool entries ===
  { finalName: "Goodfire (Menlo)", renameFrom: "Goodfire", type: "company", domain: "frontier-ai", note: "Mech interp lab, ~15 ppl, ex-Anthropic researchers" },
  { finalName: "Reflection AI (Sequoia)", renameFrom: "Reflection AI", type: "company", domain: "frontier-ai", note: "Coding agents, ex-DeepMind founders" },
  { finalName: "Sakana AI (Lux)", renameFrom: "Sakana AI", type: "company", domain: "frontier-ai", note: "Tokyo+SF, ex-Google Brain (Llion Jones)" },
  { finalName: "Thinking Machines Lab (a16z)", renameFrom: "Thinking Machines Lab", type: "company", domain: "frontier-ai", note: "Mira Murati's lab, OpenAI alumni magnet" },
  { finalName: "Physical Intelligence (Thrive)", renameFrom: "Physical Intelligence", type: "company", domain: "defense", note: "Robotics foundation models, ex-Tesla AI / Google Brain" },
  { finalName: "Skild AI (Lightspeed)", renameFrom: "Skild AI", type: "company", domain: "defense", note: "Robot foundation models, CMU pedigree" },
  { finalName: "1X (OpenAI Startup Fund)", renameFrom: "1X", type: "company", domain: "defense", note: "Humanoid robots, Norway+Bay Area" },
  { finalName: "Helsing (General Catalyst)", renameFrom: "Helsing", type: "company", domain: "defense", note: "European defense AI, post-Anduril parallel" },
  { finalName: "Chalk (a16z)", renameFrom: "Chalk", type: "company", domain: "infra-devtools", note: "Feature platform for ML, ex-Affirm/Coinbase" },
  { finalName: "Baseten (IVP)", renameFrom: "Baseten", type: "company", domain: "infra-devtools", note: "Model serving, ex-Snorkel/Gumroad" },
  { finalName: "Modal (Redpoint)", renameFrom: "Modal", type: "company", domain: "infra-devtools", note: "Serverless GPU compute, ex-Spotify infra" },
  { finalName: "Inngest (a16z)", renameFrom: "Inngest", type: "company", domain: "infra-devtools", note: "Durable workflows for devs" },
  { finalName: "Resend (Founders Fund)", renameFrom: "Resend", type: "company", domain: "infra-devtools", note: "Email API for devs, developer-loved" },
  { finalName: "Mintlify (Bain Capital Ventures)", renameFrom: "Mintlify", type: "company", domain: "infra-devtools", note: "Docs platform, high-velocity" },

  // === Brand-new entries ===
  { finalName: "Tessl (Index Ventures)", type: "company", domain: "infra-devtools", note: "AI-native dev, ex-Snyk founder" },
  { finalName: "Speakeasy (Quiet Capital)", type: "company", domain: "infra-devtools", note: "API tooling, ex-LaunchDarkly/Apollo" },
  { finalName: "Attio (Redpoint)", type: "company", domain: "vertical-saas", note: "Modern CRM, polished eng craft" },
  { finalName: "Eleven Labs (a16z)", type: "company", domain: "frontier-ai", note: "Voice AI synthesis" },
  { finalName: "Together AI (Salesforce Ventures)", type: "company", domain: "infra-devtools", note: "OSS model inference, ex-Apple/Google ML infra" },
  { finalName: "Fireworks AI (Benchmark)", type: "company", domain: "infra-devtools", note: "Inference platform, ex-Meta PyTorch core" },
  { finalName: "Replicate (a16z)", type: "company", domain: "infra-devtools", note: "Run ML models, designer-engineer crossover" },
  { finalName: "Browserbase (a16z)", type: "company", domain: "frontier-ai", note: "Headless browsers for agents, tiny + hot" },
  { finalName: "Composio (Lightspeed)", type: "company", domain: "frontier-ai", note: "Tools for AI agents, Indian tech talent" },
  { finalName: "Letta (Felicis)", type: "company", domain: "frontier-ai", note: "Stateful AI agents, Berkeley AI lab spinout, formerly MemGPT" },
  { finalName: "Patronus AI (Notable Capital)", type: "company", domain: "frontier-ai", note: "LLM eval/safety, ex-Meta AI safety" },
  { finalName: "Braintrust (a16z)", type: "company", domain: "infra-devtools", note: "LLM observability, ex-Figma/Stripe" },
  { finalName: "Langfuse (Lightspeed)", type: "company", domain: "infra-devtools", note: "OSS LLM observability, YC W23" },
  { finalName: "PostHog (Y Combinator)", type: "company", domain: "infra-devtools", note: "OSS product analytics, engineer-heavy" },
  { finalName: "Tinybird (CRV)", type: "company", domain: "infra-devtools", note: "Real-time analytics on ClickHouse" },
  { finalName: "Mercury (CRV)", type: "company", domain: "fintech", note: "Banking for startups" },
];
