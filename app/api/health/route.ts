import { NextResponse } from "next/server";
import { getEntries } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasUpstashUrl = Boolean(
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  );
  const hasUpstashToken = Boolean(
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  );
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);

  const storageMode =
    hasUpstashUrl && hasUpstashToken ? "persistent (Upstash Redis)" : "in-memory (DATA WILL BE LOST)";

  let entryCount: number | string;
  let storageReachable: boolean;
  try {
    const entries = await getEntries();
    entryCount = entries.length;
    storageReachable = true;
  } catch (err: any) {
    entryCount = `error: ${err?.message ?? "unknown"}`;
    storageReachable = false;
  }

  const allGood = hasUpstashUrl && hasUpstashToken && hasAnthropicKey && storageReachable;

  return NextResponse.json(
    {
      status: allGood ? "OK" : "ATTENTION NEEDED",
      storage: {
        mode: storageMode,
        reachable: storageReachable,
        entry_count: entryCount,
        upstash_url_set: hasUpstashUrl,
        upstash_token_set: hasUpstashToken,
      },
      llm: {
        anthropic_key_set: hasAnthropicKey,
        note: hasAnthropicKey
          ? "Generate next batch will work"
          : "Generate next batch will return an error until ANTHROPIC_API_KEY is set",
      },
      cross_device_sharing: hasUpstashUrl && hasUpstashToken
        ? "ENABLED — all visitors see the same data"
        : "DISABLED — each Vercel instance has its own ephemeral copy. Connect Upstash Redis from Vercel marketplace.",
    },
    { status: allGood ? 200 : 503 }
  );
}
