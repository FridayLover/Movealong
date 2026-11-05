import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";

// GET /api/conversations — inbox for current user
export async function GET(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const convs = await prisma.conversation.findMany({
    where: { OR: [{ buyerId: auth.id }, { sellerId: auth.id }] },
    orderBy: { updatedAt: "desc" },
    include: {
      listing: { select: { id: true, title: true, images: true, price: true, isFree: true } },
      buyer: { select: { id: true, name: true, avatar: true } },
      seller: { select: { id: true, name: true, avatar: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
  });
  // Unread = messages from the other party with no readAt yet
  const unreadByConv = new Map<string, number>();
  if (convs.length) {
    const unread = await prisma.message.groupBy({
      by: ["conversationId"],
      where: { conversationId: { in: convs.map((c) => c.id) }, senderId: { not: auth.id }, readAt: null },
      _count: { _all: true },
    });
    unread.forEach((u) => unreadByConv.set(u.conversationId, u._count._all));
  }
  const out = convs.map((c) => {
    const other = c.buyerId === auth.id ? c.seller : c.buyer;
    const listing = c.listing ? { ...c.listing, images: JSON.parse(c.listing.images) } : null;
    return {
      id: c.id,
      listing,
      other,
      role: c.buyerId === auth.id ? "buyer" : "seller",
      lastMessage: c.messages[0]?.body || null,
      lastMessageAt: c.messages[0]?.createdAt || c.updatedAt,
      messageCount: c._count.messages,
      unreadCount: unreadByConv.get(c.id) ?? 0,
      updatedAt: c.updatedAt,
    };
  });
  return NextResponse.json({ conversations: out });
}

// POST /api/conversations { listingId, body? } — find or create a thread with the listing's seller and optionally send the first message
export async function POST(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { listingId, sellerId, body } = await req.json().catch(() => ({}));
  let targetSellerId: string | null = sellerId || null;
  let resolvedListingId: string | null = listingId || null;

  if (listingId) {
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    targetSellerId = listing.sellerId;
    resolvedListingId = listing.id;
    if (targetSellerId === auth.id) return NextResponse.json({ error: "You cannot chat with yourself about your own listing" }, { status: 400 });
  }
  if (!targetSellerId) return NextResponse.json({ error: "listingId or sellerId required" }, { status: 400 });
  if (targetSellerId === auth.id) return NextResponse.json({ error: "You cannot chat with yourself" }, { status: 400 });

  const seller = await prisma.user.findUnique({ where: { id: targetSellerId } });
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

  // Buyer is always the initiator; if the seller initiates, swap so buyerId is the non-seller party is not needed —
  // we keep buyer = initiator, seller = listing owner for listing threads; for direct sellerId chats buyer = auth.
  const buyerId = auth.id;
  const sellerIdFinal = targetSellerId;

  let conv = await prisma.conversation.findFirst({
    where: { buyerId, sellerId: sellerIdFinal, listingId: resolvedListingId },
  });
  if (!conv) {
    conv = await prisma.conversation.create({
      data: { buyerId, sellerId: sellerIdFinal, listingId: resolvedListingId },
    });
  }

  let firstMessage = null;
  if (body && String(body).trim()) {
    firstMessage = await prisma.message.create({
      data: { conversationId: conv.id, senderId: auth.id, body: String(body).trim().slice(0, 2000) },
    });
    await prisma.conversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } });
  }

  return NextResponse.json({ conversation: conv, message: firstMessage });
}
