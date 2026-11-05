import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const items = await prisma.cartItem.findMany({
    where: { userId: auth.id },
    include: { listing: { include: { seller: { select: { name: true, avatar: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const listings = items.map((item) => ({
    id: item.listing.id,
    title: item.listing.title,
    description: item.listing.description,
    price: item.listing.price,
    isFree: item.listing.isFree,
    category: item.listing.category,
    condition: item.listing.condition,
    images: JSON.parse(item.listing.images),
    building: item.listing.building,
    lat: item.listing.lat,
    lng: item.listing.lng,
    seller: (item.listing as any).seller,
    createdAt: item.listing.createdAt,
  }));
  const total = listings.reduce((sum, l) => sum + (l.isFree || !l.price ? 0 : l.price), 0);
  return NextResponse.json({ cart: listings, ids: items.map((i) => i.listingId), total });
}

export async function POST(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { listingId } = await req.json();
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (listing.sellerId === auth.id) return NextResponse.json({ error: "You cannot add your own listing to cart" }, { status: 400 });
  try {
    const item = await prisma.cartItem.create({ data: { userId: auth.id, listingId } });
    return NextResponse.json({ cartItem: item });
  } catch (e: any) {
    if (e.code === "P2002") {
      const existing = await prisma.cartItem.findUnique({ where: { userId_listingId: { userId: auth.id, listingId } } });
      return NextResponse.json({ cartItem: existing });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { listingId, clearAll } = await req.json().catch(() => ({}));
  if (clearAll) {
    await prisma.cartItem.deleteMany({ where: { userId: auth.id } });
    return NextResponse.json({ ok: true });
  }
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });
  await prisma.cartItem.deleteMany({ where: { userId: auth.id, listingId } });
  return NextResponse.json({ ok: true });
}
