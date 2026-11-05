import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyPassword, signToken } from "@/lib/auth";

export async function POST(req: Request) {
  const raw = await req.json();
  const email = String(raw.email || "").trim().toLowerCase();
  const { password } = raw;
  if (!email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  const token = signToken({ id: user.id, email: user.email, name: user.name });
  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  res.cookies.set("movealong_token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV==="production", maxAge: 60*60*24*30, path: "/" });
  return res;
}
