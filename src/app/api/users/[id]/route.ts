import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { parseJsonArray } from "@/lib/profileTheme";

// GET /api/users/[id] — public chic storefront (no email/phone). Anyone can view it.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const listings = await prisma.listing.findMany({
    where: { sellerId: user.id, status: "available" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { favorites: true } } },
  });
  const showcaseOrder = parseJsonArray(user.showcaseIds);
  const byId = new Map(listings.map((l) => [l.id, l]));
  const showcase = showcaseOrder.map((id) => byId.get(id)).filter(Boolean) as typeof listings;
  const rest = listings.filter((l) => !showcaseOrder.includes(l.id));

  const totalFavorites = listings.reduce((s, l) => s + ((l as any)._count?.favorites ?? 0), 0);
  const soldCount = await prisma.order.count({ where: { sellerId: user.id } });

  const pub = (l: any) => ({
    id: l.id, title: l.title, description: l.description, price: l.price, originalPrice: l.originalPrice, moveOutDate: l.moveOutDate,
    isFree: l.isFree, category: l.category, condition: l.condition, images: JSON.parse(l.images), building: l.building,
    lat: l.lat, lng: l.lng, favoriteCount: l._count?.favorites ?? 0, createdAt: l.createdAt,
    seller: { name: user.name, avatar: user.avatar },
  });

  return NextResponse.json({
    seller: {
      id: user.id, name: user.name, avatar: user.avatar, coverImage: user.coverImage, tagline: user.tagline,
      pronouns: user.pronouns, languages: parseJsonArray(user.languages), accent: user.accent || "terracotta",
      pickupBadges: parseJsonArray(user.pickupBadges), building: user.building, address: user.address, bio: user.bio,
      memberSince: user.createdAt,
    },
    stats: { listings: listings.length, totalFavorites, sold: soldCount },
    showcase: showcase.map(pub),
    listings: rest.map(pub),
  });
}
