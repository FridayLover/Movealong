import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";
import { haversine } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() || "";
  const category = searchParams.get("category") || "all";
  const freeOnly = searchParams.get("freeOnly") === "true";
  const building = searchParams.get("building")?.toLowerCase() || "";
  const lat = searchParams.get("lat") ? Number(searchParams.get("lat")) : null;
  const lng = searchParams.get("lng") ? Number(searchParams.get("lng")) : null;
  const maxDistance = searchParams.get("maxDistance") ? Number(searchParams.get("maxDistance")) : 50;

  const where: any = { status: "available" };
  if (category !== "all") where.category = category;
  if (freeOnly) where.isFree = true;

  let listings = await prisma.listing.findMany({
    where, orderBy: { createdAt: "desc" }, include: { seller: { select: { id: true, name: true, avatar: true } }, _count: { select: { favorites: true } } },
  });

  // JS filtering for text + distance + building (keeps SQLite simple)
  let filtered = listings;
  if (q) filtered = filtered.filter(l => (l.title + " " + l.description + " " + (l.building||"")).toLowerCase().includes(q));
  if (building) filtered = filtered.filter(l => (l.building||"").toLowerCase().includes(building));
  if (lat !== null && lng !== null) {
    filtered = filtered.map(l => ({
      // @ts-ignore
      ...l,
      _dist: l.lat && l.lng ? haversine(lat, lng, l.lat as number, l.lng as number) : Infinity
    }))
    // Listings without a pin are never hidden — they sort last with unknown distance.
    // (Sellers are nudged to set a building/pin; buyers still see the item.)
    .filter((l:any)=> l._dist === Infinity || l._dist <= maxDistance)
    .sort((a:any,b:any)=> a._dist - b._dist);
  }

  const out = filtered.map(l=> ({
    id: l.id, title: l.title, description: l.description, price: l.price, originalPrice: (l as any).originalPrice ?? null, moveOutDate: (l as any).moveOutDate ?? null, pickupNote: (l as any).pickupNote ?? null, isFree: l.isFree, category: l.category, condition: l.condition,
    images: JSON.parse(l.images), building: l.building, address: l.address, lat: l.lat, lng: l.lng, seller: (l as any).seller,
    favoriteCount: (l as any)._count?.favorites ?? 0,
    distanceKm: (l as any)._dist ?? null, createdAt: l.createdAt, views: l.views, status: l.status
  }));
  return NextResponse.json({ listings: out });
}

export async function POST(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json();
  const { title, description, category, condition, price, originalPrice, moveOutDate, pickupNote, isFree, images, width, height, depth, unit, building, address, lat, lng, delivery } = body;
  if (!title || !description || !category || !condition || !images || images.length===0) {
    return NextResponse.json({ error: "Missing required fields (title, description, category, condition, at least 1 image)" }, { status: 400 });
  }
  if (images.length > 8) return NextResponse.json({ error: "Max 8 images" }, { status: 400 });
  const listing = await prisma.listing.create({
    data: {
      title: String(title).slice(0,120),
      description: String(description).slice(0,2000),
      category, condition,
      price: isFree ? 0 : (price ? Number(price) : null),
      originalPrice: originalPrice ? Number(originalPrice) : null,
      moveOutDate: moveOutDate ? String(moveOutDate).slice(0, 10) : null,
      pickupNote: pickupNote ? String(pickupNote).slice(0, 120) : null,
      isFree: !!isFree,
      images: JSON.stringify(images),
      width: width ? Number(width) : null,
      height: height ? Number(height) : null,
      depth: depth ? Number(depth) : null,
      unit: unit || "cm",
      building: building || null,
      address: address || null,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      delivery: delivery || "pickup",
      sellerId: auth.id,
    },
  });
  return NextResponse.json({ listing });
}
