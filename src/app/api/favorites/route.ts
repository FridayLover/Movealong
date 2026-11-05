import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";

// GET /api/favorites -> list of favorited listings for current user
export async function GET(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const favs = await prisma.favorite.findMany({
    where: { userId: auth.id },
    include: { listing: { include: { seller: { select: { name: true, avatar: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const listings = favs.map((f) => ({
    id: f.listing.id,
    title: f.listing.title,
    description: f.listing.description,
    price: f.listing.price,
    isFree: f.listing.isFree,
    category: f.listing.category,
    condition: f.listing.condition,
    images: JSON.parse(f.listing.images),
    building: f.listing.building,
    lat: f.listing.lat,
    lng: f.listing.lng,
    seller: (f.listing as any).seller,
    createdAt: f.listing.createdAt,
  }));
  return NextResponse.json({ favorites: listings, ids: favs.map((f) => f.listingId) });
}

// POST /api/favorites { listingId }
export async function POST(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { listingId } = await req.json();
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  try {
    const fav = await prisma.favorite.create({ data: { userId: auth.id, listingId } });
    return NextResponse.json({ favorite: fav });
  } catch (e: any) {
    // unique constraint => already favorited, return existing
    if (e.code === "P2002") {
      const existing = await prisma.favorite.findUnique({ where: { userId_listingId: { userId: auth.id, listingId } } });
      return NextResponse.json({ favorite: existing });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// DELETE /api/favorites { listingId }
export async function DELETE(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { listingId } = await req.json();
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });
  await prisma.favorite.deleteMany({ where: { userId: auth.id, listingId } });
  return NextResponse.json({ ok: true });
}
