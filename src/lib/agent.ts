/**
 * Muse Spark concierge — MoveAlong's do-anything agent.
 * Model: muse-spark-1.3 on Meta Model API (https://api.meta.ai/v1, Responses API, multimodal, 1M ctx).
 * Docs/research (Oct 2026): muse-spark-1.3 is the current Spark on the Model API (also 1.1/1.2);
 * auth is Bearer MODEL_API_KEY / META_API_KEY and the API is OpenAI/Anthropic-SDK compatible.
 * Strategy: try Muse Spark first; on any failure (or no key) fall back to a deterministic
 * rule-based agent so the concierge always answers — recommendations are still filtered by
 * the user's distance/budget preferences and ranked, sell drafts and chat drafts still work.
 */
import { haversine, discountPercent } from "./utils";

export const AGENT_MODEL = process.env.AGENT_MODEL || "muse-spark-1.3";

export type AgentPreferences = {
  maxDistanceKm: number;
  budgetMax?: number | null;
  categories: string[];
  style?: string | null;
  freeOnly?: boolean;
};

export type Candidate = {
  id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price: number | null;
  originalPrice: number | null;
  isFree: boolean;
  building: string | null;
  distanceKm: number;
  favoriteCount: number;
  width: number | null;
  height: number | null;
  depth: number | null;
  unit: string | null;
  images: string[];
};

function getKey() {
  return process.env.META_API_KEY || process.env.MODEL_API_KEY || process.env.META_MODEL_API_KEY || "";
}

const CONDITION_RANK: Record<string, number> = { new: 4, like_new: 3, good: 2, fair: 1, poor: 0 };

/** Filter by hard preferences (distance/budget/category/free) then rank for a room. Exported for tests. */
export function rankCandidates(all: Candidate[], prefs: AgentPreferences): Candidate[] {
  const filtered = all.filter((c) => {
    if (c.distanceKm > prefs.maxDistanceKm) return false;
    if (prefs.freeOnly && !c.isFree) return false;
    if (prefs.budgetMax != null && !c.isFree && (c.price ?? Infinity) > prefs.budgetMax) return false;
    if (prefs.categories.length && !prefs.categories.includes(c.category)) return false;
    return true;
  });
  const scored = filtered.map((c) => {
    const distScore = Math.max(0, 30 - c.distanceKm * 3); // nearer is better, 0 at 10km+
    const pct = discountPercent(c.price, c.originalPrice, c.isFree) ?? 0;
    const valueScore = Math.min(25, pct * 0.35) + (c.isFree ? 12 : 0);
    const condScore = (CONDITION_RANK[c.condition] ?? 1) * 4;
    const popScore = Math.min(10, c.favoriteCount * 2);
    const styleHit = prefs.style && (c.title + " " + c.description).toLowerCase().includes(prefs.style.toLowerCase().split(" ")[0]) ? 6 : 0;
    return { c, score: distScore + valueScore + condScore + popScore + styleHit };
  });
  return scored.sort((a, b) => b.score - a.score).map((s) => s.c);
}

export function candidateLine(c: Candidate): string {
  const pct = discountPercent(c.price, c.originalPrice, c.isFree);
  const size = c.width ? ` ${c.width}×${c.height}×${c.depth} ${c.unit || "cm"}` : "";
  return `- id=${c.id} | ${c.title} | ${c.category} · ${c.condition} · ${c.isFree ? "FREE" : "$" + c.price}${pct ? ` (-${pct}% vs new)` : ""} · ${c.distanceKm.toFixed(1)}km · ${c.building || "nearby"} · fav ${c.favoriteCount}${size} | ${(c.description || "").slice(0, 140)}`;
}

export function buildAgentSystemPrompt(opts: {
  userName: string;
  prefs: AgentPreferences;
  hasRoom: boolean;
  hasProductImages?: boolean;
  imageIntent?: ImageIntent | null;
  candidateCount: number;
}): string {
  return [
    `You are MoveAlong's concierge, powered by Muse Spark (${AGENT_MODEL}). You help movers buy, sell and arrange pickup in Thai condos/apartments. Be warm, concise and practical. Reply in the user's language (Thai if they write Thai, otherwise English).`,
    `User: ${opts.userName}. Preferences for this chat: within ${opts.prefs.maxDistanceKm}km${opts.prefs.budgetMax != null ? `, budget up to $${opts.prefs.budgetMax}` : ", no budget cap"}${opts.prefs.categories.length ? `, categories ${opts.prefs.categories.join(", ")}` : ", any category"}${opts.prefs.style ? `, room style: ${opts.prefs.style}` : ""}${opts.prefs.freeOnly ? ", FREE only" : ""}.`,
    opts.hasRoom
      ? "The user shared a room photo (first image). Look at its style, colours, light and empty space, then recommend only products below that would actually fit that room and style. Mention what fits where (e.g. 'against the white wall'). Never recommend something that clashes in scale or style without warning."
      : "No room photo in this turn. Still recommend from the products below, and invite the user to pick a saved room or upload one for style-matched picks.",
    opts.hasProductImages
      ? opts.imageIntent === "similar"
        ? "The user ALSO attached a photo of an item they LIKE and wants items like this / similar to this photo (imageIntent=similar). Identify the item type, shape, colour/material and style from the photo, then recommend ONLY candidates that look like or do the same job as that item. Explain each match honestly ('closest in shape/colour', 'same job, different finish') — never claim an exact visual match you cannot support. Do NOT draft a sell listing for this photo."
        : opts.imageIntent === "ask"
          ? "The user ALSO attached a photo and is asking about that item (imageIntent=ask). Say what it appears to be, visible condition clues, what to check in person (size, joints, power, stains), and a fair second-hand price range from the candidates — then optionally recommend nearby alternatives from the list. Do NOT draft a sell listing unless they then ask to sell it."
          : "The user ALSO attached product photo(s) of an item they want to SELL (imageIntent=sell, the default). Base the draftListing on what is actually visible (type, colour, material, condition clues) plus their words; never invent exact dimensions — leave size null unless stated."
      : "No attached product photo this turn (the user can attach one with the Attach button to sell it, find items like it, or ask about it).",
    `Candidate products already filtered to the preferences (${opts.candidateCount} items, nearest/value ranked). Recommend ONLY ids from this list — never invent products, prices, distances or buildings:`,
    `You can do three jobs: (1) ROOM PICKS — recommend 2-4 candidates with a one-line reason each (distance, value vs new, condition, fit). (2) SELL AUTO-FILL — if the user wants to sell (or shares product photos), produce a draftListing with a clear title, honest description from what you can see + their words, category, condition, a fair second-hand price (typically 40-60% below new; explain briefly), originalPrice if you can estimate retail, and size only if visible/ stated — never invent exact cm. (3) CHAT DRAFT — if asked to write/reply to a buyer/seller message, produce a short polite draftReply (propose a lobby pickup time, confirm size/condition, second-hand as-is note).`,
    `Always end by offering the next tap: preview in AI Room, favourite/cart, chat the seller, or use the sell draft. Second-hand is as-is, no returns — remind gently only when drafting a sale/purchase message.`,
    `Output format: first a friendly reply in plain text, then on a new line a JSON block exactly like: {"recommendedIds":["..."],"draftListing":null,"draftReply":null} — fill draftListing/draftReply only when relevant, otherwise null. Keep recommendedIds to ids from the list (empty array if none fit; say so honestly).`,
  ].join("\n");
}

function parseSparkOutput(text: string): { reply: string; recommendedIds: string[]; draftListing: any; draftReply: string | null } {
  const m = text.match(/\{[\s\S]*"recommendedIds"[\s\S]*\}/);
  if (!m) return { reply: text.trim(), recommendedIds: [], draftListing: null, draftReply: null };
  try {
    const j = JSON.parse(m[0]);
    const reply = text.slice(0, m.index).trim() || "Here you go —";
    return {
      reply,
      recommendedIds: Array.isArray(j.recommendedIds) ? j.recommendedIds.map(String) : [],
      draftListing: j.draftListing || null,
      draftReply: j.draftReply || null,
    };
  } catch {
    return { reply: text.trim(), recommendedIds: [], draftListing: null, draftReply: null };
  }
}

export type ImageIntent = "sell" | "similar" | "ask";

export type AgentTurnInput = {
  userName: string;
  history: { role: string; content: string }[];
  latest: string;
  roomImage?: string | null;
  productImages?: string[];
  /** What attached images are for: sell this item, find items like it, or ask about it. */
  imageIntent?: ImageIntent | null;
  prefs: AgentPreferences;
  candidates: Candidate[];
};

async function callMuseSpark(input: AgentTurnInput): Promise<{ reply: string; recommendedIds: string[]; draftListing: any; draftReply: string | null } | null> {
  const apiKey = getKey();
  if (!apiKey) return null;
  const system = buildAgentSystemPrompt({
    userName: input.userName,
    prefs: input.prefs,
    hasRoom: !!input.roomImage,
    hasProductImages: (input.productImages?.length ?? 0) > 0,
    imageIntent: input.imageIntent ?? null,
    candidateCount: input.candidates.length,
  });
  const candidateText = input.candidates.slice(0, 20).map(candidateLine).join("\n") || "(no products match the current preferences)";

  const content: any[] = [{ type: "input_text", text: `${system}\n\nProducts:\n${candidateText}\n\nConversation:\n${input.history.slice(-8).map((h) => `${h.role}: ${h.content}`).join("\n")}\nuser: ${input.latest}` }];
  if (input.roomImage) content.push({ type: "input_image", image_url: input.roomImage });
  for (const img of (input.productImages || []).slice(0, 4)) content.push({ type: "input_image", image_url: img });

  try {
    // 30s budget: on timeout/error we return null and runAgent answers with the
    // labelled local concierge instead of hanging the chat.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    let res: Response;
    try {
      res = await fetch("https://api.meta.ai/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: AGENT_MODEL, temperature: 0, input: [{ role: "user", content }] }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    // Responses API: collect output_text parts
    let text = "";
    for (const o of json.output || []) {
      if (o.type === "message" && Array.isArray(o.content)) {
        for (const c of o.content) if (c.type === "output_text" && c.text) text += c.text;
      }
      if (o.type === "output_text" && o.text) text += o.text;
    }
    if (!text && typeof json.output_text === "string") text = json.output_text;
    if (!text.trim()) return null;
    return parseSparkOutput(text);
  } catch {
    return null;
  }
}

const SELL_WORDS = ["sell", "selling", "list it", "list my", "ขาย", "ลงขาย", "อยากขาย"];
const REPLY_WORDS = ["reply", "draft", "write back", "answer", "ตอบ", "ร่าง", "ช่วยตอบ"];

const SIMILAR_WORDS = ["similar", "like this", "like my", "look like", "looks like", "find like", "แบบนี้", "คล้าย", "เหมือนรูป"];
const ASK_WORDS = ["what is this", "tell me about", "how much is this worth", "worth", "อันนี้คือ", "ราคาเท่าไหร่"];

export function mockAgent(input: AgentTurnInput): { reply: string; recommendedIds: string[]; draftListing: any; draftReply: string | null } {
  const latest = input.latest || "";
  const lower = latest.toLowerCase();
  const thai = /[\u0E00-\u0E7F]/.test(latest);
  const ranked = rankCandidates(input.candidates, input.prefs);
  const hasImages = (input.productImages?.length ?? 0) > 0;
  const intent: ImageIntent | null = input.imageIntent
    || (SIMILAR_WORDS.some((w) => lower.includes(w)) ? "similar" : null)
    || (hasImages && ASK_WORDS.some((w) => lower.includes(w)) ? "ask" : null);
  const wantsSell = intent !== "similar" && intent !== "ask" && (hasImages || SELL_WORDS.some((w) => lower.includes(w)));
  const wantsReply = REPLY_WORDS.some((w) => lower.includes(w));

  // FIND-SIMILAR: user attached a photo of something they like — recommend the
  // closest real listings (category hint from their words first), never draft a listing.
  if (intent === "similar") {
    const catWord = ["sofa", "couch", "table", "desk", "lamp", "tv", "shelf", "dresser", "chair", "เตียง", "โต๊ะ", "โคม"].find((w) => lower.includes(w));
    const catGuess = catWord ? (["lamp", "โคม"].includes(catWord) ? "decor" : ["tv"].includes(catWord) ? "electronics" : "furniture") : null;
    const pool = catGuess ? [...ranked.filter((c) => c.category === catGuess), ...ranked.filter((c) => c.category !== catGuess)] : ranked;
    const top = pool.slice(0, 4);
    if (!top.length) {
      return {
        reply: thai
          ? `ดูรูปที่คุณแนบแล้ว แต่ตอนนี้ยังไม่มีของคล้าย ๆ กันในระยะ ${input.prefs.maxDistanceKm} กม. เลย ลองขยายระยะ/งบด้านบน หรือแนบรูปมุมอื่นให้ผมช่วยเทียบอีกที`
          : `I looked at your photo, but nothing similar is listed within ${input.prefs.maxDistanceKm}km right now. Try widening distance/budget above, or attach another angle and I'll compare again.`,
        recommendedIds: [], draftListing: null, draftReply: null,
      };
    }
    const lines = top.map((c, i) => {
      const pct = discountPercent(c.price, c.originalPrice, c.isFree);
      return `${i + 1}. ${c.title} — ${c.distanceKm.toFixed(1)}km${c.isFree ? ", FREE" : `, $${c.price}${pct ? ` (-${pct}% vs new)` : ""}`}, ${c.condition.replace("_", " ")}, ${c.building || "nearby"}`;
    });
    return {
      reply: (thai
        ? `จากรูปที่คุณแนบ ผมเจอของที่ใกล้เคียงที่สุดในระยะ ${input.prefs.maxDistanceKm} กม. (เรียงจากใกล้และคุ้มสุด):\n`
        : `From your photo, here are the closest matches within ${input.prefs.maxDistanceKm}km (nearest + best value first):\n`)
        + lines.join("\n")
        + (thai ? "\nอันไหนใกล้รูปสุด แตะ Preview เพื่อลองวางในห้องของคุณก่อนไปรับได้เลย" : "\nTap Preview on the closest one to try it in your room before you go."),
      recommendedIds: top.map((c) => c.id), draftListing: null, draftReply: null,
    };
  }

  // ASK-ABOUT-THIS: describe/checklist guidance + fair-price anchor from nearby listings.
  if (intent === "ask" && hasImages) {
    const top = ranked.slice(0, 3);
    const prices = ranked.map((c) => c.price).filter((p): p is number => typeof p === "number" && p > 0).sort((a, b) => a - b);
    const range = prices.length ? `$${prices[0]}–$${prices[prices.length - 1]}` : "the going rate nearby";
    return {
      reply: (thai
        ? `จากรูปที่แนบมา เช็กตามนี้ก่อนตัดสินใจ: สภาพพื้นผิว/รอย, ความแน่นของข้อต่อ, ขนาดจริงเทียบพื้นที่ของคุณ และถ้าเป็นเครื่องใช้ไฟฟ้าให้ลองเสียบใช้งาน ของมือสองแถวนี้ขายกันราว ${range} — `
        : `From your photo, check these in person: surface wear/scratches, joint sturdiness, exact size vs your space, and (for electrics) plug it in and test. Similar second-hand items near you run about ${range}. `)
        + (top.length
          ? (thai ? `เทียบกับของที่ขายอยู่ใกล้ ๆ ได้จากตัวเลือกด้านล่าง ถ้าอยากขายต่อ บอกผมว่า “ขายอันนี้” พร้อมแนบรูปอีกครั้ง ผมร่างรายการให้เลย` : `Compare with the live picks below. Want to sell yours instead? Say “sell this” with the photo attached and I'll draft the listing.`)
          : (thai ? `ตอนนี้ยังไม่มีของเทียบใกล้ ๆ ให้ดู ลองขยายระยะด้านบนอีกนิด` : `No nearby comparisons right now — widen the distance above a touch.`)),
      recommendedIds: top.map((c) => c.id), draftListing: null, draftReply: null,
    };
  }

  if (wantsSell) {
    // Guess category from words, price from similar nearby listings (median) so the draft is editable, not fantasy.
    const catGuess = ["sofa", "couch", "โต๊ะ", "table", "desk", "lamp", "โคม", "tv", "ทีวี", "wash", "dress", "shelf"].find((w) => lower.includes(w));
    const category = lower.includes("lamp") || lower.includes("โคม") ? "decor" : lower.includes("tv") || lower.includes("ทีวี") ? "electronics" : lower.includes("wash") ? "appliance" : "furniture";
    const peers = ranked.filter((c) => c.category === category);
    const median = peers.length ? [...peers].sort((a, b) => (a.price || 0) - (b.price || 0))[Math.floor(peers.length / 2)].price : null;
    // Title from the user's own words only — never from the canned send-text
    // ("I want to sell this product — fill my listing…") or a long sentence.
    let titleHint = latest
      .replace(/^(help me sell|i want to sell|sell my|sell this|sell|ขาย|ช่วยขาย)\s*/i, "")
      .replace(/—?\s*fill my listing.*$/i, "")
      .replace(/from the photo.*$/i, "")
      .replace(/\s*\(condition:[^)]*\)/i, "")
      .trim()
      .slice(0, 60);
    if (!titleHint || /fill my listing|product —|this product/i.test(titleHint)) {
      titleHint = catGuess ? `${catGuess.charAt(0).toUpperCase() + catGuess.slice(1)} — edit my title` : "";
    }
    const draftListing = {
      title: titleHint ? titleHint.charAt(0).toUpperCase() + titleHint.slice(1) : "My item — tap to edit title",
      description: thai
        ? "สภาพตามรูป ถ่ายจากของจริงหลายมุม นัดรับที่ล็อบบี้ได้เลย (มือสอง ขายตามสภาพ ไม่มีรับคืน — เช็กขนาดและสภาพก่อนรับนะครับ/ค่ะ)"
        : "Condition as shown — photos are the actual item, multiple angles. Lobby pickup. Second-hand, sold as-is (no returns), please check size and condition at pickup.",
      category,
      condition: (["like_new", "new", "good", "fair", "poor"].find((c) => lower.includes(`condition: ${c}`)) as string) || "good",
      price: median ?? 1500,
      originalPrice: median ? Math.round(median * 2.2) : null,
      width: null, height: null, depth: null, unit: "cm",
    };
    return {
      reply: thai
        ? `ได้เลย — ผมร่างรายการให้จาก${(input.productImages?.length ?? 0) ? "รูปสินค้า" : "ข้อความ"}ของคุณแล้ว ราคาตั้งจากของใกล้เคียงในระยะ ${input.prefs.maxDistanceKm} กม. แตะ “Use this draft” เพื่อไปเติมรูป/ขนาดที่หน้า Sell ได้เลย (แก้ราคาได้ตามสภาพจริง)`
        : `Done — I drafted your listing${(input.productImages?.length ?? 0) ? " from your product photos" : ""} and priced it from similar items within ${input.prefs.maxDistanceKm}km. Tap “Use this draft” to land on Sell with everything filled — just add photos, exact size and your must-go-by date.`,
      recommendedIds: [],
      draftListing,
      draftReply: null,
    };
  }

  if (wantsReply) {
    const draftReply = thai
      ? "สวัสดีครับ/ค่ะ ยังอยู่ครับ สภาพตามรูปเลย ขนาดตามที่ลงไว้ นัดรับที่ล็อบบี้วันนี้ 18:00 สะดวกไหมครับ? (มือสองขายตามสภาพ เช็กของก่อนจ่ายได้เลยครับ)"
      : "Hi! Yes, still available and the condition is exactly as in the photos. Size is as listed — happy for you to check it in person. Could we meet at the lobby today around 18:00?";
    return {
      reply: thai ? "ร่างให้แล้ว — ปรับเวลา/น้ำเสียงได้ แล้วแตะ Copy หรือส่งในแชทได้เลย:" : "Here’s a draft you can copy or send — tweak the time to suit you:",
      recommendedIds: [],
      draftListing: null,
      draftReply,
    };
  }

  const top = ranked.slice(0, 4);
  if (!top.length) {
    return {
      reply: thai
        ? `ตอนนี้ยังไม่มีของที่ตรงเงื่อนไขในระยะ ${input.prefs.maxDistanceKm} กม.${input.prefs.budgetMax != null ? ` งบ $${input.prefs.budgetMax}` : ""} เลย ลองขยายระยะ/งบ หรือเลือกห้องที่บันทึกไว้ให้ผมดูสไตล์ห้องก่อน — ผมจะช่วยจับคู่ให้ตรงกว่านี้`
        : `Nothing matches within ${input.prefs.maxDistanceKm}km${input.prefs.budgetMax != null ? ` under $${input.prefs.budgetMax}` : ""} right now. Try widening distance/budget above, or pick a saved room so I can match your room's style — I'll re-rank instantly.`,
      recommendedIds: [],
      draftListing: null,
      draftReply: null,
    };
  }
  const reasons = top.map((c) => {
    const pct = discountPercent(c.price, c.originalPrice, c.isFree);
    return `${c.title} — ${c.distanceKm.toFixed(1)}km${c.isFree ? ", FREE" : `, $${c.price}${pct ? ` (-${pct}% vs new)` : ""}`}, ${c.condition.replace("_", " ")}${input.roomImage ? ", fits your room's tones/scale" : ""}`;
  });
  return {
    reply: (thai
      ? `ดู${input.roomImage ? "ห้องของคุณ" : "ของใกล้คุณ"}แล้ว ในระยะ ${input.prefs.maxDistanceKm} กม. ผมว่า ${top.length} ชิ้นนี้น่าเริ่มสุด:\n`
      : `Looking at ${input.roomImage ? "your room photo" : "what's near you"} within ${input.prefs.maxDistanceKm}km, I'd start with these ${top.length}:\n`) +
      reasons.map((r, i) => `${i + 1}. ${r}`).join("\n") +
      (thai ? "\nแตะที่การ์ดเพื่อ Preview ในห้อง, ใส่ตะกร้า หรือแชทกับผู้ขายได้เลย" : "\nTap a card to preview it in your room, add to cart, or chat the seller."),
    recommendedIds: top.map((c) => c.id),
    draftListing: null,
    draftReply: null,
  };
}

export async function runAgent(input: AgentTurnInput): Promise<{ reply: string; recommendedIds: string[]; draftListing: any; draftReply: string | null; provider: "muse-spark" | "mock-agent"; model: string }> {
  const spark = await callMuseSpark(input);
  if (spark && spark.reply) {
    // Keep only ids the server actually offered, so the model can never invent a product.
    const allowed = new Set(input.candidates.map((c) => c.id));
    const out = { ...spark, recommendedIds: spark.recommendedIds.filter((id) => allowed.has(id)) };
    // Intent guarantees, whichever provider answered:
    // sell -> there MUST be a draft to take to the Sell page (fall back locally if the model only chatted)
    if (input.imageIntent === "sell" && !out.draftListing) {
      const local = mockAgent(input);
      return { reply: local.reply, recommendedIds: [], draftListing: local.draftListing, draftReply: null, provider: "muse-spark", model: AGENT_MODEL };
    }
    // similar/ask -> a sell draft is the wrong artefact; drop it and keep recommendations
    if ((input.imageIntent === "similar" || input.imageIntent === "ask") && out.draftListing) {
      return { ...out, draftListing: null, provider: "muse-spark", model: AGENT_MODEL };
    }
    return { ...out, provider: "muse-spark", model: AGENT_MODEL };
  }
  return { ...mockAgent(input), provider: "mock-agent", model: AGENT_MODEL };
}
