import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";

function matches(l: any, s: any, since?: Date) {
  if (since && new Date(l.createdAt) <= since) return false;
  if (s.category && s.category !== "all" && l.category !== s.category) return false;
  if (s.freeOnly && !l.isFree) return false;
  if (s.maxPrice != null && !l.isFree && (l.price == null || l.price > s.maxPrice)) return false;
  if (s.building && !(l.building || "").toLowerCase().includes(s.building.toLowerCase())) return false;
  if (s.query) {
    const hay = (l.title + " " + l.description + " " + (l.building || "")).toLowerCase();
    if (!hay.includes(s.query.toLowerCase())) return false;
  }
  return true;
}

export async function GET(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const searches = await prisma.savedSearch.findMany({ where: { userId: auth.id }, orderBy: { createdAt: "desc" } });
  const available = await prisma.listing.findMany({ where: { status: "available" } });
  const out = searches.map((s) => ({
    ...s,
    newMatches: available.filter((l) => matches(l, s, s.createdAt)).length,
    totalMatches: available.filter((l) => matches(l, s)).length,
  }));
  return NextResponse.json({ savedSearches: out });
}

export async function POST(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { query, category, building, maxPrice, freeOnly } = body;
  if (!query && !building && (!category || category === "all") && maxPrice == null && !freeOnly) {
    return NextResponse.json({ error: "Save a more specific search (add text, building, category or price)" }, { status: 400 });
  }
  const saved = await prisma.savedSearch.create({
    data: {
      userId: auth.id,
      query: query ? String(query).slice(0, 80) : null,
      category: category ? String(category) : "all",
      building: building ? String(building).slice(0, 80) : null,
      maxPrice: maxPrice != null && maxPrice !== "" ? Number(maxPrice) : null,
      freeOnly: !!freeOnly,
    },
  });
  return NextResponse.json({ savedSearch: saved });
}

export async function DELETE(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.savedSearch.deleteMany({ where: { id, userId: auth.id } });
  return NextResponse.json({ ok: true });
}
