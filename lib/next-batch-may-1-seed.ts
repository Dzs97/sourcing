// May 1 2026 next-batch — 30 net-new companies.
// All confirmed not in tracker (any status) and not in rankings file.
// Strict criteria: small Series A/B, strong VC, non-health, non-defense, non-bio.
// Names include lead VC in parens.

import type { EntryType, Domain } from "./types";

export interface NextBatchSeed {
  finalName: string;
  /** If renaming an existing tracker entry, the old name. None of these are renames. */
  renameFrom?: string;
  type: EntryType;
  domain: Domain;
  note?: string;
}

export const NEXT_BATCH_2026_05_01: NextBatchSeed[] = [
  // === Coding agents & AI dev tools (10) ===
  { finalName: "Lovable (Accel)", type: "company", domain: "frontier-ai", note: "Fastest-growing AI app builder, Stockholm, ~25 ppl" },
  { finalName: "Vapi (Bessemer)", type: "company", domain: "frontier-ai", note: "Voice AI agents platform, ~30 ppl" },
  { finalName: "Retell AI (Y Combinator)", type: "company", domain: "frontier-ai", note: "Voice AI infra, YC W24, ~10 ppl" },
  { finalName: "Continue (Heavybit)", type: "company", domain: "infra-devtools", note: "OSS coding assistant, ~15 ppl, ex-GitHub" },
  { finalName: "Stagehand (Browserbase)", type: "company", domain: "infra-devtools", note: "OSS browser automation framework, tiny team" },
  { finalName: "CrewAI (a16z)", type: "company", domain: "frontier-ai", note: "Multi-agent framework, ~20 ppl, hot OSS pull" },
  { finalName: "Dust (Sequoia)", type: "company", domain: "frontier-ai", note: "AI assistants for teams, Paris, ~30 ppl, ex-OpenAI/Stripe" },
  { finalName: "E2B (Sunflower)", type: "company", domain: "infra-devtools", note: "Sandboxes for AI agents, ~15 ppl, Czech+SF" },
  { finalName: "Helicone (Y Combinator)", type: "company", domain: "infra-devtools", note: "OSS LLM observability, YC W23, ~10 ppl" },
  { finalName: "Humanloop (Index Ventures)", type: "company", domain: "infra-devtools", note: "LLM dev platform, London, ~25 ppl" },

  // === ML infra & data (8) ===
  { finalName: "LlamaIndex (Greylock)", type: "company", domain: "infra-devtools", note: "Leading RAG framework, ~30 ppl" },
  { finalName: "Galileo (Battery)", type: "company", domain: "infra-devtools", note: "LLM eval/observability, ~50 ppl, ex-Google/Uber ML" },
  { finalName: "WhyLabs (Bezos Expeditions)", type: "company", domain: "infra-devtools", note: "ML observability, Seattle, ~30 ppl" },
  { finalName: "Argilla (Felicis)", type: "company", domain: "infra-devtools", note: "OSS data curation for LLMs, Spain, ~25 ppl" },
  { finalName: "Weaviate (NEA)", type: "company", domain: "infra-devtools", note: "OSS vector DB, ~80 ppl, Amsterdam" },
  { finalName: "Chroma (a16z)", type: "company", domain: "infra-devtools", note: "Vector DB, ~15 ppl, premier infra eng pull" },
  { finalName: "Lambda Labs (Crescent Cove)", type: "company", domain: "infra-devtools", note: "GPU cloud, ~120 ppl, strong infra culture" },
  { finalName: "Zed Industries (GitHub)", type: "company", domain: "infra-devtools", note: "Modern code editor, ~20 ppl, Atom team alumni" },

  // === Auth/identity infra (3) ===
  { finalName: "Clerk (CRV)", type: "company", domain: "infra-devtools", note: "Auth for modern apps, ~40 ppl, premium frontend eng" },
  { finalName: "WorkOS (Lightspeed)", type: "company", domain: "infra-devtools", note: "Enterprise SSO/auth APIs, ~80 ppl, ex-Stripe" },
  { finalName: "Stytch (Coatue)", type: "company", domain: "infra-devtools", note: "Passwordless auth platform, ~80 ppl, ex-Plaid founders" },

  // === Generative media AI (3) ===
  { finalName: "Krea (a16z)", type: "company", domain: "frontier-ai", note: "Real-time generative image AI, ~20 ppl, Spain+SF" },
  { finalName: "Hedra (Index)", type: "company", domain: "frontier-ai", note: "Character video generation, ~15 ppl, ex-character.ai" },
  { finalName: "Tavus (Sequoia)", type: "company", domain: "frontier-ai", note: "Personalized video AI, ~40 ppl" },

  // === Fintech infra (3) ===
  { finalName: "Privy (Sequoia)", type: "company", domain: "fintech", note: "Embedded crypto wallets, ~30 ppl, ex-Affirm/Stripe" },
  { finalName: "Bridge (Sequoia)", type: "company", domain: "fintech", note: "Stablecoin payments, ~50 ppl, acquired by Stripe but team intact" },
  { finalName: "Rho (Peter Thiel)", type: "company", domain: "fintech", note: "Modern business banking, ~150 ppl" },

  // === Vertical SaaS (3) ===
  { finalName: "Plain (Index)", type: "company", domain: "vertical-saas", note: "Modern customer support, London, ~25 ppl, ex-Deliveroo/Stripe" },
  { finalName: "Common Room (Index)", type: "company", domain: "vertical-saas", note: "Community intelligence, ~80 ppl, ex-Google/Reddit" },
  { finalName: "Default (Sequoia)", type: "company", domain: "vertical-saas", note: "Inbound revenue automation, ~25 ppl" },
];
