import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";

async function getOwnedConversation(id: string, userId: string) {
  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv) return null;
  if (conv.buyerId !== userId && conv.sellerId !== userId) return null;
  return conv;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const conv = await getOwnedConversation(params.id, auth.id);
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Opening a thread reads it: mark the other party's messages as read
  await prisma.message.updateMany({
    where: { conversationId: params.id, senderId: { not: auth.id }, readAt: null },
    data: { readAt: new Date() },
  });
  const full = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      listing: { select: { id: true, title: true, images: true, price: true, isFree: true, building: true } },
      buyer: { select: { id: true, name: true, avatar: true } },
      seller: { select: { id: true, name: true, avatar: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true } } } },
    },
  });
  const listing = full?.listing ? { ...full.listing, images: JSON.parse(full.listing.images) } : null;
  return NextResponse.json({
    conversation: { id: full!.id, listing, buyer: full!.buyer, seller: full!.seller, updatedAt: full!.updatedAt },
    messages: full!.messages.map((m) => ({ id: m.id, body: m.body, senderId: m.senderId, senderName: m.sender.name, createdAt: m.createdAt, mine: m.senderId === auth.id })),
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const conv = await getOwnedConversation(params.id, auth.id);
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { body } = await req.json().catch(() => ({}));
  if (!body || !String(body).trim()) return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  const msg = await prisma.message.create({
    data: { conversationId: params.id, senderId: auth.id, body: String(body).trim().slice(0, 2000) },
  });
  await prisma.conversation.update({ where: { id: params.id }, data: { updatedAt: new Date() } });
  return NextResponse.json({ message: msg });
}
