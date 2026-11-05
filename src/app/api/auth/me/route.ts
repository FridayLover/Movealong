import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAuthFromCookie } from "@/lib/auth";
import { shouldResetCredits, FREE_CREDITS_PER_MONTH, getLimits } from "@/lib/credits";
import { parseJsonArray } from "@/lib/profileTheme";

export async function GET() {
  const auth = getAuthFromCookie();
  if (!auth) return NextResponse.json({ user: null });
  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user) return NextResponse.json({ user: null });
  // monthly reset
  if (shouldResetCredits(user.lastCreditReset)) {
    await prisma.user.update({ where: { id: user.id }, data: { credits: FREE_CREDITS_PER_MONTH, creditsUsedThisMonth: 0, lastCreditReset: new Date() } });
    user.credits = FREE_CREDITS_PER_MONTH;
    user.creditsUsedThisMonth = 0;
  }
  const [favCount, cartCount, roomCount, genCount, unreadCount] = await Promise.all([
    prisma.favorite.count({ where: { userId: user.id } }),
    prisma.cartItem.count({ where: { userId: user.id } }),
    prisma.room.count({ where: { userId: user.id } }),
    prisma.generation.count({ where: { userId: user.id } }),
    // Unread chat messages addressed to me across all my conversations
    prisma.message.count({
      where: {
        senderId: { not: user.id }, readAt: null,
        conversation: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
      },
    }),
  ]);
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      coverImage: (user as any).coverImage,
      tagline: (user as any).tagline,
      pronouns: (user as any).pronouns,
      languages: parseJsonArray((user as any).languages),
      accent: (user as any).accent || "terracotta",
      pickupBadges: parseJsonArray((user as any).pickupBadges),
      showcaseIds: parseJsonArray((user as any).showcaseIds),
      prefDistanceKm: (user as any).prefDistanceKm ?? 10,
      prefBudgetMax: (user as any).prefBudgetMax,
      prefCategories: parseJsonArray((user as any).prefCategories),
      prefStyle: (user as any).prefStyle,
      phone: user.phone,
      building: user.building,
      address: user.address,
      lat: user.lat,
      lng: user.lng,
      bio: user.bio,
      credits: user.credits,
      subscriptionTier: user.subscriptionTier,
      favCount,
      cartCount,
      roomCount,
      genCount,
      unreadCount,
    },
    limits: getLimits(user.subscriptionTier),
  });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("movealong_token", "", { maxAge: 0, path: "/" });
  return res;
}
