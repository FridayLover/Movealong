import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(req: Request) {
  const raw = await req.json();
  // Normalize email so case/space variants can't create duplicate accounts or break login
  const email = String(raw.email || "").trim().toLowerCase();
  const { password, name, building, address, lat, lng } = raw;
  if (!email || !password || !name) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Password too short (min 6)" }, { status: 400 });
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Email already registered" }, { status: 400 });
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, building: building || null, address: address || null, lat: lat ? Number(lat) : null, lng: lng ? Number(lng) : null },
  });
  const token = signToken({ id: user.id, email: user.email, name: user.name });
  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  res.cookies.set("movealong_token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV==="production", maxAge: 60*60*24*30, path: "/" });
  return res;
}
