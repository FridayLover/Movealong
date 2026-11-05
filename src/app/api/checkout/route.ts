import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authFromRequest } from "@/lib/auth";

// POST /api/checkout { paymentMethod: "card" | "pickup" }
// Second-hand checkout: card is a mock charge (wire Stripe later), pickup = pay the seller in person (recommended).
// All sales are as-is — no returns after payment/pickup (enforced in copy + order status; there is no return endpoint).
// On success we create one Order per cart item, reserve the listings, and clear the buyer's cart for those items.
export async function POST(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { paymentMethod } = await req.json().catch(() => ({}));
  if (paymentMethod !== "card" && paymentMethod !== "pickup") {
    return NextResponse.json({ error: "paymentMethod must be 'card' or 'pickup'" }, { status: 400 });
  }

  const items = await prisma.cartItem.findMany({
    where: { userId: auth.id },
    include: { listing: true },
  });
  if (items.length === 0) return NextResponse.json({ error: "Cart is empty" }, { status: 400 });

  const unavailable = items.filter((i) => i.listing.status !== "available");
  if (unavailable.length) {
    return NextResponse.json({ error: `Some items are no longer available: ${unavailable.map((i) => i.listing.title).join(", ")}`, code: "UNAVAILABLE" }, { status: 409 });
  }
  const own = items.filter((i) => i.listing.sellerId === auth.id);
  if (own.length) return NextResponse.json({ error: "You cannot buy your own listing" }, { status: 400 });

  const total = items.reduce((s, i) => s + (i.listing.isFree || !i.listing.price ? 0 : i.listing.price), 0);
  const status = paymentMethod === "card" ? "paid" : "pending_pickup";

  const orders = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const item of items) {
      const order = await tx.order.create({
        data: {
          buyerId: auth.id,
          sellerId: item.listing.sellerId,
          listingId: item.listing.id,
          price: item.listing.isFree || !item.listing.price ? 0 : item.listing.price,
          paymentMethod,
          status,
        },
      });
      await tx.listing.update({ where: { id: item.listing.id }, data: { status: "reserved" } });
      created.push(order);
    }
    await tx.cartItem.deleteMany({ where: { userId: auth.id, listingId: { in: items.map((i) => i.listing.id) } } });
    return created;
  });

  return NextResponse.json({
    orders,
    total,
    paymentMethod,
    notice: "Second-hand items are sold as-is. No returns or refunds after payment/pickup — please inspect photos, condition and size, and check the item in person at pickup.",
  });
}

// GET /api/checkout — buyer's orders (for profile)
export async function GET(req: Request) {
  const auth = authFromRequest(req);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const orders = await prisma.order.findMany({
    where: { OR: [{ buyerId: auth.id }, { sellerId: auth.id }] },
    orderBy: { createdAt: "desc" },
    include: {
      listing: { select: { id: true, title: true, images: true, price: true, isFree: true } },
      buyer: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
    },
  });
  const out = orders.map((o) => ({ ...o, listing: { ...o.listing, images: JSON.parse(o.listing.images) }, role: o.buyerId === auth.id ? "buyer" : "seller" }));
  return NextResponse.json({ orders: out });
}
