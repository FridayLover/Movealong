import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const gens = await prisma.generation.findMany({
    where: { userId: auth.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { listing: { select: { title: true } } },
  });
  return NextResponse.json({ generations: gens });
}

export async function DELETE(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const g = await prisma.generation.findUnique({ where: { id } });
  if (!g || g.userId !== auth.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.generation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
