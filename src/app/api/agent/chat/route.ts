import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";
import { parseJsonArray } from "@/lib/profileTheme";
import { haversine } from "@/lib/utils";
import { runAgent, type AgentPreferences, type Candidate } from "@/lib/agent";
import { rateLimit } from "@/lib/rateLimit";

// GET /api/agent/chat — last agent messages for this user (so the panel isn't empty on return).
// Saved meta.recommendedIds are resolved back into full listing cards so the
// item boxes in history survive a page refresh / switching widget <-> /agent.
export async function GET(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  // Latest 50, in chronological order (asc+take would freeze history at the oldest 50 forever)
  const msgs = (await prisma.agentMessage.findMany({ where: { userId: auth.id }, orderBy: { createdAt: "desc" }, take: 50 })).reverse();

  const wanted = new Set<string>();
  const parsed = msgs.map((m) => {
    let meta: any = null;
    try { meta = m.meta ? JSON.parse(m.meta) : null; } catch {}
    if (Array.isArray(meta?.recommendedIds)) meta.recommendedIds.forEach((id: string) => wanted.add(String(id)));
    return { m, meta };
  });

  const found = wanted.size
    ? await prisma.listing.findMany({ where: { id: { in: Array.from(wanted) } }, include: { _count: { select: { favorites: true } } } })
    : [];
  const byId = new Map(found.map((l) => [l.id, l]));
  const origin = { lat: user?.lat ?? 13.7563, lng: user?.lng ?? 100.5018 };
  const toCard = (l: any) => ({
    id: l.id, title: l.title, price: l.price, originalPrice: l.originalPrice, isFree: l.isFree, category: l.category, condition: l.condition,
    images: JSON.parse(l.images), building: l.building,
    distanceKm: l.lat && l.lng ? haversine(origin.lat, origin.lng, l.lat, l.lng) : null,
    favoriteCount: l._count?.favorites ?? 0, status: l.status,
  });

  return NextResponse.json({
    messages: parsed.map(({ m, meta }) => ({
      id: m.id, role: m.role, body: m.body, createdAt: m.createdAt,
      meta: meta
        ? {
            ...meta,
            // The actual cards (in the model's original order); client renders from here after refresh
            recommendedListings: Array.isArray(meta.recommendedIds)
              ? meta.recommendedIds.map((id: string) => byId.get(String(id))).filter(Boolean).map(toCard)
              : [],
          }
        : null,
    })),
  });
}

export async function DELETE(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await prisma.agentMessage.deleteMany({ where: { userId: auth.id } });
  return NextResponse.json({ ok: true });
}

// POST /api/agent/chat — Muse Spark concierge (full: room picks / sell auto-fill / chat draft)
// Body: { messages, roomImage?, roomId?, productImages?, preferences?, lat?, lng? }
// `preferences` carries the chosen Saved-rooms + sliders values: maxDistanceKm (distance), budgetMax (budget), categories, style, freeOnly.
export async function POST(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const history: { role: string; content: string }[] = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const latest = String(history.filter((h) => h.role === "user").pop()?.content || body.message || "").slice(0, 2000);
  if (!latest) return NextResponse.json({ error: "Say something first — e.g. “What should I add in my room?”" }, { status: 400 });

  // Rate limit: 20 agent turns/minute/user protects the Meta budget
  const rl = rateLimit(`agent-chat:${auth.id}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Baan needs a breather — wait ${rl.retryAfterSec}s and ask again.`, code: "RATE_LIMIT", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Preferences: sliders in the panel win, then the user's saved profile prefs, then defaults.
  const prefsIn = body.preferences || {};
  const preferences: AgentPreferences = {
    maxDistanceKm: Math.min(50, Math.max(1, Number(prefsIn.maxDistanceKm ?? (user as any).prefDistanceKm ?? 10))),
    budgetMax: prefsIn.budgetMax != null && prefsIn.budgetMax !== "" ? Math.max(0, Number(prefsIn.budgetMax)) : ((user as any).prefBudgetMax ?? null),
    categories: Array.isArray(prefsIn.categories) ? prefsIn.categories.map(String) : parseJsonArray((user as any).prefCategories),
    style: prefsIn.style ?? (user as any).prefStyle ?? null,
    freeOnly: !!prefsIn.freeOnly,
  };

  // Room image: explicit upload wins, else a saved room the user picked.
  let roomImage: string | null = body.roomImage ? String(body.roomImage).slice(0, 2_000_000) : null;
  if (!roomImage && body.roomId) {
    const room = await prisma.room.findUnique({ where: { id: String(body.roomId) } });
    if (room && room.userId === auth.id) roomImage = room.image;
  }
  const productImages: string[] = Array.isArray(body.productImages)
    ? body.productImages.map((s: any) => String(s).slice(0, 2_000_000)).slice(0, 4)
    : [];
  const imageIntent = ["sell", "similar", "ask"].includes(body.imageIntent) ? body.imageIntent : null;

  const origin = {
    lat: typeof body.lat === "number" ? body.lat : user.lat ?? 13.7563,
    lng: typeof body.lng === "number" ? body.lng : user.lng ?? 100.5018,
  };

  const listings = await prisma.listing.findMany({
    where: { status: "available", sellerId: { not: auth.id } },
    include: { _count: { select: { favorites: true } } },
  });
  const candidates: Candidate[] = listings
    .map((l) => ({
      id: l.id, title: l.title, description: l.description, category: l.category, condition: l.condition,
      price: l.price, originalPrice: (l as any).originalPrice, isFree: l.isFree, building: l.building,
      distanceKm: l.lat && l.lng ? haversine(origin.lat, origin.lng, l.lat, l.lng) : 999,
      favoriteCount: (l as any)._count?.favorites ?? 0,
      width: l.width, height: l.height, depth: l.depth, unit: l.unit, images: JSON.parse(l.images),
    }))
    .filter((c) => c.distanceKm <= 50);

  const out = await runAgent({
    userName: user.name,
    history,
    latest,
    roomImage,
    productImages,
    imageIntent,
    prefs: preferences,
    candidates,
  });

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const recommendedListings = out.recommendedIds.map((id) => byId.get(id)).filter(Boolean).map((c: any) => ({
    id: c.id, title: c.title, price: c.price, originalPrice: c.originalPrice, isFree: c.isFree, category: c.category, condition: c.condition,
    images: c.images, building: c.building, distanceKm: c.distanceKm, favoriteCount: c.favoriteCount,
  }));

  const meta = { recommendedIds: out.recommendedIds, draftListing: out.draftListing, draftReply: out.draftReply, provider: out.provider, preferences, imageIntent };
  await prisma.agentMessage.create({
    data: { userId: auth.id, role: "user", body: latest, meta: JSON.stringify({ imageIntent, imageCount: productImages.length }) },
  });
  await prisma.agentMessage.create({ data: { userId: auth.id, role: "assistant", body: out.reply, meta: JSON.stringify(meta) } });

  return NextResponse.json({
    reply: out.reply,
    provider: out.provider,
    model: out.model,
    recommendedListings,
    draftListing: out.draftListing,
    draftReply: out.draftReply,
    imageIntent,
    preferencesUsed: preferences,
    maxDistanceKm: preferences.maxDistanceKm,
    budgetMax: preferences.budgetMax,
  });
}
