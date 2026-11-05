import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";
import { getLimits } from "@/lib/credits";

export async function GET(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const rooms = await prisma.room.findMany({ where: { userId: auth.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ rooms });
}

export async function POST(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { name, image } = await req.json();
  if (!name || !image) return NextResponse.json({ error: "name and image required" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const limits = getLimits(user.subscriptionTier);
  const count = await prisma.room.count({ where: { userId: auth.id } });
  if (count >= limits.maxSavedRooms) {
    return NextResponse.json({ error: `Room limit reached for ${limits.label} (${limits.maxSavedRooms}). Upgrade to save more.`, code: "ROOM_LIMIT" }, { status: 403 });
  }
  const room = await prisma.room.create({ data: { userId: auth.id, name: String(name).slice(0, 80), image: String(image).slice(0, 2_000_000) } });
  return NextResponse.json({ room });
}

export async function DELETE(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room || room.userId !== auth.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.room.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
