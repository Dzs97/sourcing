import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getEntries } from "@/lib/storage";
import { DOMAIN_LABELS, TYPE_LABELS } from "@/lib/types";
import type { Entry, EntryType, Domain } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // generous for LLM call

interface BatchCandidate {
  name: string;
  type: EntryType;
  domain: Domain;
  reason: string;
  is_existing_entry: boolean; // true if already in DB as 'new'/'blacklisted', false = brand new
}

const VALID_DOMAINS = Object.keys(DOMAIN_LABELS) as Domain[];
const VALID_TYPES = Object.keys(TYPE_LABELS) as EntryType[];

function buildContext(entries: Entry[]): string {
  const tried = entries.filter((e) => e.status === "tried");
  const targeting = entries.filter((e) => e.status === "targeting");
  const blacklisted = entries.filter((e) => e.status === "blacklisted");
  const newPool = entries.filter((e) => e.status === "new");

  const summarize = (xs: Entry[], cap = 80) => {
    const grouped: Record<string, string[]> = {};
    for (const e of xs) {
      const key = `${TYPE_LABELS[e.type]} / ${DOMAIN_LABELS[e.domain]}`;
      grouped[key] = grouped[key] ?? [];
      grouped[key].push(e.name);
    }
    return Object.entries(grouped)
      .map(([k, names]) => {
        const truncated =
          names.length > cap ? `${names.slice(0, cap).join(", ")}, +${names.length - cap} more` : names.join(", ");
        return `  ${k} (${names.length}): ${truncated}`;
      })
      .join("\n");
  };

  return `## TRIED (${tried.length}) — already mined, do not re-suggest
${summarize(tried)}

## CURRENTLY TARGETING (${targeting.length}) — being mined now, do not re-suggest
${summarize(targeting)}

## BLACKLISTED (${blacklisted.length}) — explicitly excluded, NEVER suggest these
${summarize(blacklisted, 200)}

## EXISTING IN 'NEW' POOL (${newPool.length}) — already in the database awaiting attention; you can recommend these AND brand-new ones
${summarize(newPool)}`;
}

const SYSTEM_PROMPT = `You are an elite recruiting strategist helping a user identify the next batch of engineering talent pools (companies, schools, communities, competitions) to source from.

The user is recruiting strong engineers for a US-based AI-powered dermatology platform. They have already mined certain pools heavily and are looking for adjacent pools that share talent characteristics.

Your job: based on the user's engagement patterns (what they've TRIED and what they're currently TARGETING), suggest exactly 30 NEW pools to target next. Each suggestion needs:
- name: the canonical name of the company/school/community/competition
- type: one of: company, school, community, competition
- domain: one of: frontier-ai, healthcare-ai, insurtech, defense, infra-devtools, bio-ai, research-lab, fintech, vertical-saas, cs-school, elite-hs, fellowship, olympiad, open-source, other
- reason: ONE concise sentence explaining why this is a good adjacent target given their engagement patterns
- is_existing_entry: true if you're recommending an entry already in their NEW pool, false if it's brand-new

Rules:
- Strongly prefer entries from their existing NEW pool when relevant — they've already curated those.
- You may also introduce brand-new pools (set is_existing_entry: false) when there's a clear strategic gap.
- DO NOT suggest anything in TRIED, TARGETING, or BLACKLISTED.
- Bias toward US-based talent pools.
- Mix of company types, school types, and communities — don't just return 30 companies.
- Each reason should be specific and grounded in the user's actual patterns ("you've engaged with X frontier AI labs, Y is similar in talent profile").
- Output ONLY valid JSON. No prose, no markdown fences. Schema: { "candidates": [...] }`;

export async function POST(_req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY env var not set. Add it in Vercel project settings.",
      },
      { status: 500 }
    );
  }

  const entries = await getEntries();
  const context = buildContext(entries);

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is my current sourcing state:\n\n${context}\n\nGenerate 30 candidates for my next targeting batch. Return ONLY a JSON object with shape: { "candidates": [{name, type, domain, reason, is_existing_entry}, ...] }`,
        },
      ],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Claude API error: ${err?.message ?? "unknown"}` },
      { status: 500 }
    );
  }

  // Extract text from response
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json(
      { error: "Claude returned no text content" },
      { status: 500 }
    );
  }

  // Strip any accidental markdown fences and parse
  let raw = textBlock.text.trim();
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

  let parsed: { candidates?: any[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      {
        error: "Claude returned invalid JSON",
        raw_response: raw.slice(0, 500),
      },
      { status: 500 }
    );
  }

  if (!Array.isArray(parsed.candidates)) {
    return NextResponse.json(
      { error: "Response missing 'candidates' array" },
      { status: 500 }
    );
  }

  // Validate and sanitize each candidate
  const candidates: BatchCandidate[] = [];
  for (const c of parsed.candidates) {
    if (typeof c?.name !== "string" || !c.name.trim()) continue;
    const type = VALID_TYPES.includes(c.type) ? c.type : "company";
    const domain = VALID_DOMAINS.includes(c.domain) ? c.domain : "other";
    candidates.push({
      name: c.name.trim(),
      type,
      domain,
      reason: typeof c.reason === "string" ? c.reason.trim() : "",
      is_existing_entry: Boolean(c.is_existing_entry),
    });
  }

  return NextResponse.json({ candidates });
}
