import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";
import { parseJsonArray } from "@/lib/profileTheme";

function pubUser(user: any) {
  return {
    id: user.id, email: user.email, name: user.name, avatar: user.avatar, coverImage: user.coverImage, tagline: user.tagline,
    pronouns: user.pronouns, languages: parseJsonArray(user.languages), accent: user.accent || "terracotta",
    pickupBadges: parseJsonArray(user.pickupBadges), showcaseIds: parseJsonArray(user.showcaseIds),
    prefDistanceKm: user.prefDistanceKm ?? 10, prefBudgetMax: user.prefBudgetMax, prefCategories: parseJsonArray(user.prefCategories), prefStyle: user.prefStyle,
    phone: user.phone, building: user.building, address: user.address, lat: user.lat, lng: user.lng, bio: user.bio,
    credits: user.credits, subscriptionTier: user.subscriptionTier, createdAt: user.createdAt,
  };
}

export async function GET(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user: pubUser(user) });
}

export async function PATCH(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const allowed: Record<string, any> = {};
  if (typeof body.name === "string" && body.name.trim()) allowed.name = body.name.trim().slice(0, 60);
  if (typeof body.avatar === "string") allowed.avatar = body.avatar.slice(0, 500_000) || null;
  if (typeof body.coverImage === "string") allowed.coverImage = body.coverImage.slice(0, 1_000_000) || null;
  if (typeof body.tagline === "string") allowed.tagline = body.tagline.slice(0, 90) || null;
  if (typeof body.pronouns === "string") allowed.pronouns = body.pronouns.slice(0, 30) || null;
  if (Array.isArray(body.languages) || typeof body.languages === "string") allowed.languages = JSON.stringify(Array.isArray(body.languages) ? body.languages.slice(0, 8).map(String) : parseJsonArray(body.languages));
  if (typeof body.accent === "string") allowed.accent = body.accent.slice(0, 20) || "terracotta";
  if (Array.isArray(body.pickupBadges) || typeof body.pickupBadges === "string") allowed.pickupBadges = JSON.stringify(Array.isArray(body.pickupBadges) ? body.pickupBadges.slice(0, 8).map(String) : parseJsonArray(body.pickupBadges));
  if (Array.isArray(body.showcaseIds) || typeof body.showcaseIds === "string") allowed.showcaseIds = JSON.stringify(Array.isArray(body.showcaseIds) ? body.showcaseIds.slice(0, 8).map(String) : parseJsonArray(body.showcaseIds));
  if (body.prefDistanceKm != null && body.prefDistanceKm !== "") allowed.prefDistanceKm = Math.min(50, Math.max(1, Number(body.prefDistanceKm)));
  if (body.prefBudgetMax === null || body.prefBudgetMax === "") allowed.prefBudgetMax = null;
  else if (body.prefBudgetMax != null) allowed.prefBudgetMax = Math.max(0, Number(body.prefBudgetMax));
  if (Array.isArray(body.prefCategories) || typeof body.prefCategories === "string") allowed.prefCategories = JSON.stringify(Array.isArray(body.prefCategories) ? body.prefCategories.slice(0, 8).map(String) : parseJsonArray(body.prefCategories));
  if (typeof body.prefStyle === "string") allowed.prefStyle = body.prefStyle.slice(0, 40) || null;
  if (typeof body.phone === "string") allowed.phone = body.phone.slice(0, 30) || null;
  if (typeof body.building === "string") allowed.building = body.building.slice(0, 80) || null;
  if (typeof body.address === "string") allowed.address = body.address.slice(0, 200) || null;
  if (typeof body.bio === "string") allowed.bio = body.bio.slice(0, 800) || null;
  if (typeof body.lat === "number" || body.lat === null) allowed.lat = body.lat;
  if (typeof body.lng === "number" || body.lng === null) allowed.lng = body.lng;
  if (Object.keys(allowed).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const user = await prisma.user.update({ where: { id: auth.id }, data: allowed });
  return NextResponse.json({ user: pubUser(user) });
}
