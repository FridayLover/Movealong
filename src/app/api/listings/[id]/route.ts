import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";
import { haversine } from "@/lib/utils";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");
  // Public endpoint: never select the seller's email (private contact detail)
  const listing = await prisma.listing.findUnique({ where: { id: params.id }, include: { seller: { select: { id: true, name: true, building: true, createdAt: true } }, _count: { select: { favorites: true } } } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.listing.update({ where: { id: params.id }, data: { views: { increment: 1 } } });
  const [sellerListings, sellerCount] = await Promise.all([
    prisma.listing.findMany({ where: { sellerId: listing.sellerId, status: "available", id: { not: listing.id } }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.listing.count({ where: { sellerId: listing.sellerId } }),
  ]);
  const bundle = sellerListings.map((l) => ({ id: l.id, title: l.title, price: l.price, isFree: l.isFree, images: JSON.parse(l.images) }));
  const bundleTotal = bundle.reduce((s, l) => s + (l.isFree || !l.price ? 0 : l.price), 0) + (listing.isFree || !listing.price ? 0 : listing.price || 0);
  const distanceKm = !Number.isNaN(lat) && !Number.isNaN(lng) && listing.lat && listing.lng
    ? haversine(lat, lng, listing.lat, listing.lng)
    : null;
  return NextResponse.json({
    listing: { ...listing, images: JSON.parse(listing.images), seller: (listing as any).seller, favoriteCount: (listing as any)._count?.favorites ?? 0, distanceKm, sameBuilding: distanceKm !== null && distanceKm <= 0.08 },
    sellerStats: { totalListings: sellerCount, memberSince: (listing as any).seller?.createdAt, sameSeller: bundle, bundleTotal, bundleCount: bundle.length + 1 },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const listing = await prisma.listing.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.sellerId !== auth.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const allowed = ["title","description","price","originalPrice","moveOutDate","pickupNote","isFree","status","building","address","lat","lng","category","condition","width","height","depth","unit","delivery","images"];
  const data:any = {};
  for (const k of allowed) if (k in body) data[k]=body[k];
  if ("images" in data) data.images = JSON.stringify(data.images);
  if ("price" in data && data.price !== null) data.price = Number(data.price);
  const updated = await prisma.listing.update({ where: { id: params.id }, data });
  return NextResponse.json({ listing: updated });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const listing = await prisma.listing.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.sellerId !== auth.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.listing.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
