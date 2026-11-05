import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";
import { CREDIT_PACKAGES, SUBSCRIPTIONS, getLimits } from "@/lib/credits";

export async function GET(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  const tier = user?.subscriptionTier || "free";
  return NextResponse.json({ credits: user?.credits ?? 0, subscriptionTier: tier, packages: CREDIT_PACKAGES, subscriptions: SUBSCRIPTIONS, limits: getLimits(tier) });
}

export async function POST(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { packageId, subscriptionTier } = await req.json();

  const user = await prisma.user.findUnique({ where: { id: auth.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Mock purchase — in real life integrate Stripe Checkout
  if (packageId) {
    const pack = CREDIT_PACKAGES.find(p=> p.id===packageId);
    if (!pack) return NextResponse.json({ error: "Invalid package" }, { status: 400 });
    await prisma.user.update({ where: { id: auth.id }, data: { credits: { increment: pack.credits } } });
    await prisma.transaction.create({ data: { userId: auth.id, type: "purchase", amount: pack.credits, price: pack.price, meta: packageId } });
    const fresh = await prisma.user.findUnique({ where: { id: auth.id } });
    return NextResponse.json({ ok: true, credits: fresh?.credits, limits: getLimits(fresh?.subscriptionTier || "free") });
  }

  if (subscriptionTier) {
    const sub = SUBSCRIPTIONS.find(s=> s.tier===subscriptionTier);
    if (!sub) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    const credits = sub.credits === 9999 ? 9999 : sub.credits;
    await prisma.user.update({ where: { id: auth.id }, data: { subscriptionTier, credits } });
    await prisma.transaction.create({ data: { userId: auth.id, type: "subscription", amount: credits, price: sub.price, meta: subscriptionTier } });
    const fresh = await prisma.user.findUnique({ where: { id: auth.id } });
    return NextResponse.json({ ok: true, credits: fresh?.credits, subscriptionTier: fresh?.subscriptionTier, limits: getLimits(fresh?.subscriptionTier || "free") });
  }

  return NextResponse.json({ error: "Provide packageId or subscriptionTier" }, { status: 400 });
}
