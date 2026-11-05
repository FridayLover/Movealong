import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";
import { FREE_CREDITS_PER_MONTH, getLimits } from "@/lib/credits";
import { generateRoomComposite } from "@/lib/ai";
import { rateLimit } from "@/lib/rateLimit";

function shouldReset(last: Date) {
  const now = new Date();
  return now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear();
}

export async function POST(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json();
  // Accept both legacy single and new multi
  const listingIds: string[] = Array.isArray(body.listingIds) ? body.listingIds : body.listingId ? [body.listingId] : [];
  const roomImage: string = body.roomImage || "";
  const roomId: string | null = body.roomId ? String(body.roomId) : null;
  const prompt: string | undefined = body.prompt;

  if (listingIds.length === 0) return NextResponse.json({ error: "listingIds required (1-8 items)" }, { status: 400 });
  if (!roomImage && !roomId) return NextResponse.json({ error: "roomImage or roomId required" }, { status: 400 });

  // Rate limit: 10 generations/minute/user protects credits + Meta budget
  const rl = rateLimit(`ai-generate:${auth.id}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many generations in a row — wait ${rl.retryAfterSec}s and try again.`, code: "RATE_LIMIT", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // monthly reset
  if (shouldReset(user.lastCreditReset)) {
    await prisma.user.update({ where: { id: user.id }, data: { credits: FREE_CREDITS_PER_MONTH, creditsUsedThisMonth: 0, lastCreditReset: new Date() } });
    user.credits = FREE_CREDITS_PER_MONTH;
  }

  if (user.subscriptionTier !== "pro" && user.credits <= 0) {
    return NextResponse.json({ error: "No credits left. Buy a pack or upgrade subscription.", code: "NO_CREDITS" }, { status: 402 });
  }

  // Room: resolve if roomId given and roomImage missing
  let effectiveRoomImage = roomImage;
  let resolvedRoomId: string | null = null;
  if (roomId) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.userId !== auth.id) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    resolvedRoomId = room.id;
    if (!effectiveRoomImage) effectiveRoomImage = room.image;
  }
  if (!effectiveRoomImage) return NextResponse.json({ error: "roomImage required" }, { status: 400 });

  // Tier limit: items per room
  const limits = getLimits(user.subscriptionTier);
  if (listingIds.length > limits.maxItemsPerRoom) {
    return NextResponse.json({
      error: `Too many items for ${limits.label} plan: max ${limits.maxItemsPerRoom} per room preview. Upgrade to place more.`,
      code: "ITEM_LIMIT",
      limits,
      requested: listingIds.length,
    }, { status: 403 });
  }
  if (listingIds.length > 8) {
    return NextResponse.json({ error: "Max 8 items per scene for quality" }, { status: 400 });
  }

  const listings = await prisma.listing.findMany({ where: { id: { in: listingIds } } });
  if (listings.length !== listingIds.length) return NextResponse.json({ error: "One or more listings not found" }, { status: 404 });

  const byId = new Map(listings.map((l) => [l.id, l]));
  const ordered = listingIds.map((id) => byId.get(id)!).filter(Boolean);

  // Use ALL product photos (every angle, capped at 3 per item to bound tokens) — the prompt builder
  // references imageCount so the model knows it has multiple views of the same object.
  const itemDetails = ordered.map((l) => {
    const imgs: string[] = JSON.parse(l.images);
    return {
      title: l.title,
      description: l.description,
      category: l.category,
      condition: l.condition,
      width: l.width,
      height: l.height,
      depth: l.depth,
      unit: l.unit,
      images: imgs.slice(0, 3),
    };
  });
  const itemImages: string[] = itemDetails.flatMap((d) => d.images);
  const itemTitles: string[] = ordered.map((l) => l.title);
  const dimensionsHint = ordered
    .map((l) => (l.width && l.height ? `${l.title}: ${l.width}×${l.height}×${l.depth || "?"} ${l.unit || "cm"}` : null))
    .filter(Boolean)
    .join("; ");

  // Call AI provider (Meta Muse → Replicate → mock) with full listing context
  const ai = await generateRoomComposite({
    roomImage: effectiveRoomImage,
    itemImages,
    itemTitles,
    itemDetails,
    dimensionsHint: dimensionsHint || undefined,
    prompt,
  });

  // Deduct credit (unless pro unlimited) — 1 credit per scene regardless of item count (chosen to keep simple and generous)
  if (user.subscriptionTier !== "pro") {
    await prisma.user.update({ where: { id: user.id }, data: { credits: { decrement: 1 }, creditsUsedThisMonth: { increment: 1 } } });
  }

  const primaryId = ordered[0].id;
  const resultToStore = (ai.resultImage || effectiveRoomImage).slice(0, 2_000_000);

  const gen = await prisma.generation.create({
    data: {
      userId: user.id,
      listingId: primaryId,
      listingIds: JSON.stringify(listingIds),
      roomId: resolvedRoomId,
      roomImage: effectiveRoomImage.slice(0, 2_000_000),
      resultImage: resultToStore,
      prompt: prompt || null,
      provider: ai.provider,
      creditsUsed: user.subscriptionTier === "pro" ? 0 : 1,
    },
  });

  const fresh = await prisma.user.findUnique({ where: { id: user.id } });

  return NextResponse.json({
    generation: gen,
    creditsLeft: fresh?.credits ?? 0,
    provider: ai.provider,
    providerError: ai.error || null,
    itemImages,
    itemTitles,
    dimensions: ordered.map((l) => ({ id: l.id, width: l.width, height: l.height, depth: l.depth, unit: l.unit })),
    compositeHint: ai.hint || { scale: listingIds.length === 1 ? 0.42 : 0.32, positions: [] },
    limits,
  });
}
