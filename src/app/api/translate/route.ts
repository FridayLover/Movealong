import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
const NAMES: Record<string, string> = { th: "Thai", zh: "Simplified Chinese", es: "Spanish" };

// Translates user-written listing text on demand. Uses Meta Muse Spark
// (AGENT_MODEL) when a key is configured; otherwise returns the original
// text so the UI can keep the source wording (never a fake translation).
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rl = rateLimit(`translate:${ip}`, 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });

  const { text, target } = await req.json().catch(() => ({}));
  const clean = typeof text === "string" ? text.slice(0, 2000).trim() : "";
  const name = NAMES[target];
  if (!clean || !name) return NextResponse.json({ translation: clean, provider: "original" });
  if (target === "en") return NextResponse.json({ translation: clean, provider: "original" });

  const key = process.env.META_API_KEY || process.env.MODEL_API_KEY || process.env.META_MODEL_API_KEY || "";
  if (!key) return NextResponse.json({ translation: clean, provider: "original" });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    let res: Response;
    try {
      res = await fetch("https://api.meta.ai/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.AGENT_MODEL || "muse-spark-1.3",
          temperature: 0,
          input: [{ role: "user", content: [{ type: "input_text", text: `Translate the following second-hand marketplace text into ${name}. Preserve prices, sizes, brand names and numbers exactly. Return ONLY the translation, no quotes or notes.\n\n${clean}` }] }],
        }),
        signal: ctrl.signal,
      });
    } finally { clearTimeout(timer); }
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ translation: clean, provider: "original" });
    let out = "";
    for (const o of json.output || []) {
      if (o.type === "message" && Array.isArray(o.content)) for (const c of o.content) if (c.type === "output_text" && c.text) out += c.text;
      if (o.type === "output_text" && o.text) out += o.text;
    }
    if (!out && typeof json.output_text === "string") out = json.output_text;
    out = out.trim().replace(/^["“]|["”]$/g, "");
    return NextResponse.json({ translation: out || clean, provider: out ? "muse-spark" : "original" });
  } catch {
    return NextResponse.json({ translation: clean, provider: "original" });
  }
}
