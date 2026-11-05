/**
 * AI Provider Layer — MoveAlong room visualization
 * Research summary (checked 2026-11-05):
 * - Meta Model API now ships Muse Image (muse-image-1.0) via https://api.meta.ai/v1
 *   POST /v1/images/generations and more powerfully POST /v1/responses with input_image refs.
 *   It outputs base64 image bytes and CAN fuse room + multiple furniture reference images into one scene
 *   (docs.cookbook: "compose with reference images"). Cost ~$0.01/image (Muse Image).
 *   Llama alone cannot generate images (text only) — Muse Image is the correct Meta image model.
 * - SAM 2 (meta/sam-2 on Replicate) segments objects but does NOT generate a placed scene alone.
 *   Best Meta-stack = SAM mask → inpaint, but Muse Image does composition end-to-end and is simpler to publish.
 * - Replicate SDXL inpainting is the most reliable immediate fallback (no Meta partnership needed).
 *
 * Strategy: try Meta Muse first if MODEL_API_KEY/META_API_KEY set, fallback to Replicate, fallback to canvas mock.
 * All modes return the same shape so callers are unchanged.
 */

import { buildRoomPrompt, NEGATIVE_PROMPT, GEN_SEED, GEN_TEMPERATURE, type PromptItem } from "./prompt";

export type AiItemDetail = PromptItem & { images: string[] };

export type AiInput = {
  roomImage: string; // data URL or https URL
  itemImages: string[]; // flattened: every product photo angle (room is separate)
  itemTitles: string[];
  itemDetails?: AiItemDetail[]; // full title/description/category/condition/size per item — prompt uses all of it
  dimensionsHint?: string; // legacy, derived from itemDetails when present
  prompt?: string;
};

export type AiResult = {
  provider: "meta-muse" | "replicate" | "mock-canvas";
  resultImage: string | null; // dataURL or remote URL
  hint?: { scale: number; positions: string[] };
  error?: string;
  meta?: any;
};

function getMetaKey() {
  return process.env.META_API_KEY || process.env.MODEL_API_KEY || process.env.META_MODEL_API_KEY || "";
}
function getReplicateKey() {
  return process.env.REPLICATE_API_TOKEN || "";
}

function truncateDataUrl(s: string, max = 2_000_000) {
  return s.length > max ? s.slice(0, max) : s;
}

// Hard timeout budgets so a slow/stuck provider can never hang a request —
// on timeout we fall through to the next provider / labelled mock instead.
const META_TIMEOUT_MS = 45_000;
const META_FALLBACK_TIMEOUT_MS = 30_000;
const REPLICATE_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function timeoutNote(e: any, label: string): string {
  return e?.name === "AbortError" ? `${label} timed out — falling back` : e?.message || `${label} failed`;
}

/** Providers return either raw base64, a data: URL, or a hosted https: URL — keep each usable as an <img src>. */
function toImageSrc(v: string): string {
  if (v.startsWith("data:") || v.startsWith("http://") || v.startsWith("https://")) return v;
  return `data:image/png;base64,${v}`;
}

/**
 * Meta Muse Image via Responses API (supports multiple reference images)
 * Docs: client.responses.create with model muse-image-1.0, content parts {type:"input_image", image_url}
 * We use direct fetch to avoid adding `openai` dependency.
 */
async function generateWithMeta(input: AiInput): Promise<AiResult> {
  const apiKey = getMetaKey();
  if (!apiKey) return { provider: "meta-muse", resultImage: null, error: "No Meta key" };

  const details: PromptItem[] =
    input.itemDetails && input.itemDetails.length
      ? input.itemDetails.map((d) => ({ ...d, imageCount: d.images.length }))
      : input.itemTitles.map((t) => ({ title: t, description: "", category: "furniture", condition: "good", imageCount: 1 }));
  const promptText = buildRoomPrompt({ items: details, userPrompt: input.prompt });

  const content: any[] = [{ type: "input_text", text: promptText }];
  // Room first
  content.push({ type: "input_image", image_url: input.roomImage });
  for (const img of input.itemImages) content.push({ type: "input_image", image_url: img });

  try {
    const res = await fetchWithTimeout("https://api.meta.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "muse-image-1.0",
        temperature: GEN_TEMPERATURE,
        input: [{ role: "user", content }],
      }),
    }, META_TIMEOUT_MS);
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Fallback to /images/generations (single prompt, no refs) — still returns an image immediately publishable
      const res2 = await fetchWithTimeout("https://api.meta.ai/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "muse-image-1.0",
          prompt: promptText,
          temperature: GEN_TEMPERATURE,
          n: 1,
        }),
      }, META_FALLBACK_TIMEOUT_MS);
      const json2: any = await res2.json().catch(() => ({}));
      if (!res2.ok) return { provider: "meta-muse", resultImage: null, error: json?.error?.message || json2?.error?.message || `Meta HTTP ${res.status}/${res2.status}` };
      const b64 = json2?.data?.[0]?.b64_json || json2?.data?.[0]?.url || null;
      if (!b64) return { provider: "meta-muse", resultImage: null, error: "Meta returned no image" };
      return { provider: "meta-muse", resultImage: toImageSrc(b64), meta: { via: "images/generations fallback", usage: json2.usage } };
    }
    // Responses API: find image_generation_call result
    const output = json.output || [];
    const call = output.find((o: any) => o.type === "image_generation_call");
    const b64 = call?.result;
    if (!b64) return { provider: "meta-muse", resultImage: null, error: "No image_generation_call in response", meta: json };
    return { provider: "meta-muse", resultImage: toImageSrc(b64), meta: { responseId: json.id, usage: json.usage } };
  } catch (e: any) {
    return { provider: "meta-muse", resultImage: null, error: timeoutNote(e, "Meta Muse Image") };
  }
}

async function generateWithReplicate(input: AiInput): Promise<AiResult> {
  const token = getReplicateKey();
  if (!token) return { provider: "replicate", resultImage: null, error: "No Replicate token" };
  try {
    // Use a public SDXL inpainting / interior model. This model takes prompt + image and returns photoreal interior.
    // We keep it generic so you can swap version in env without code change.
    const modelVersion = process.env.REPLICATE_MODEL_VERSION || "pointblack/stable-interiors-v2:4a0d8d1c"; // placeholder; set in env
    const res = await fetchWithTimeout("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: modelVersion.split(":")[1],
        input: {
          image: input.roomImage,
          prompt: buildRoomPrompt({
            items:
              input.itemDetails && input.itemDetails.length
                ? input.itemDetails.map((d) => ({ ...d, imageCount: d.images.length }))
                : input.itemTitles.map((t) => ({ title: t, description: "", category: "furniture", condition: "good", imageCount: 1 })),
            userPrompt: input.prompt,
          }),
          negative_prompt: NEGATIVE_PROMPT,
          seed: GEN_SEED,
          num_inference_steps: 30,
          guidance_scale: 7.5,
        },
      }),
    }, REPLICATE_TIMEOUT_MS);
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return { provider: "replicate", resultImage: null, error: json?.detail || `Replicate HTTP ${res.status}` };
    // Poll once (Replicate is async; for demo we wait up to 8s in 1s steps)
    let pred = json;
    for (let i = 0; i < 8 && pred.status !== "succeeded" && pred.status !== "failed"; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const poll = await fetchWithTimeout(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Token ${token}` } }, REPLICATE_TIMEOUT_MS);
      pred = await poll.json();
    }
    if (pred.status !== "succeeded") return { provider: "replicate", resultImage: null, error: `Replicate ${pred.status}`, meta: pred };
    const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (!out) return { provider: "replicate", resultImage: null, error: "Replicate no output" };
    return { provider: "replicate", resultImage: out, meta: { predictionId: pred.id } };
  } catch (e: any) {
    return { provider: "replicate", resultImage: null, error: timeoutNote(e, "Replicate") };
  }
}

export async function generateRoomComposite(input: AiInput): Promise<AiResult> {
  // Prefer Meta Muse when key available (publishable, $0.01/img, multi-ref compose)
  if (getMetaKey()) {
    const meta = await generateWithMeta({ ...input, roomImage: truncateDataUrl(input.roomImage), itemImages: input.itemImages.map((s) => truncateDataUrl(s)) });
    if (meta.resultImage) return meta;
    // fall through to replicate/mock with meta error noted
    if (getReplicateKey()) {
      const rep = await generateWithReplicate(input);
      if (rep.resultImage) return { ...rep, meta: { ...(rep.meta || {}), metaFallbackError: meta.error } };
    }
    return { provider: "mock-canvas", resultImage: null, error: meta.error, hint: hintFor(input) };
  }
  if (getReplicateKey()) {
    const rep = await generateWithReplicate(input);
    if (rep.resultImage) return rep;
    return { provider: "mock-canvas", resultImage: null, error: rep.error, hint: hintFor(input) };
  }
  return { provider: "mock-canvas", resultImage: null, hint: hintFor(input) };
}

function hintFor(input: AiInput) {
  // Count distinct items, not photo angles — itemImages is flattened (up to 3 angles per item)
  const n = Math.max(1, input.itemDetails?.length || input.itemTitles.length || 1);
  const scale = n === 1 ? 0.62 : n === 2 ? 0.48 : n === 3 ? 0.42 : 0.36;
  const positions = n === 1 ? ["center-bottom"] : n === 2 ? ["left-bottom", "right-bottom"] : ["left-bottom", "center-bottom", "right-bottom"];
  return { scale, positions: positions.slice(0, n) };
}
