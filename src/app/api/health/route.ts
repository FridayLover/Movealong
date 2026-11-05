import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/health — smoke check for Docker/judges: app up, DB reachable, and
// whether the Meta providers are configured (booleans only, never key values).
export async function GET() {
  let db = false;
  try {
    await prisma.user.count();
    db = true;
  } catch {}
  const metaConfigured = Boolean(process.env.META_API_KEY || process.env.MODEL_API_KEY || process.env.META_MODEL_API_KEY);
  const replicateConfigured = Boolean(process.env.REPLICATE_API_TOKEN);
  return NextResponse.json(
    {
      ok: db,
      db,
      ai: {
        metaConfigured,
        replicateConfigured,
        imageModel: "muse-image-1.0",
        agentModel: process.env.AGENT_MODEL || "muse-spark-1.3",
        mode: metaConfigured ? "meta" : replicateConfigured ? "replicate" : "local-fallback",
      },
      time: new Date().toISOString(),
    },
    { status: db ? 200 : 503 },
  );
}
