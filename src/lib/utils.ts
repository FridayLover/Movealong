import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPrice(price: number | null | undefined, isFree?: boolean) {
  if (isFree || price === 0 || price === null || price === undefined) return "FREE";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "furniture", label: "Furniture" },
  { id: "appliance", label: "Appliances" },
  { id: "decor", label: "Decor" },
  { id: "kitchen", label: "Kitchen" },
  { id: "electronics", label: "Electronics" },
  { id: "other", label: "Other" },
] as const;

export function discountPercent(price: number | null | undefined, originalPrice: number | null | undefined, isFree?: boolean): number | null {
  if (isFree) return 100;
  if (!originalPrice || originalPrice <= 0 || price == null) return null;
  const pct = Math.round((1 - price / originalPrice) * 100);
  return pct > 0 ? pct : null;
}

export function daysUntil(dateStr: string | null | undefined, from = new Date()): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T23:59:59");
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - from.getTime()) / 86_400_000);
}

export function urgencyLabel(moveOutDate: string | null | undefined): { label: string; tone: "urgent" | "soon" | "normal" } | null {
  const d = daysUntil(moveOutDate);
  if (d === null) return null;
  if (d < 0) return { label: "Past move-out date", tone: "urgent" };
  if (d === 0) return { label: "Must go today", tone: "urgent" };
  if (d <= 3) return { label: `Must go in ${d}d`, tone: "urgent" };
  if (d <= 7) return { label: `Must go by ${moveOutDate} · ${d}d left`, tone: "soon" };
  return { label: `Available until ${moveOutDate}`, tone: "normal" };
}

/** Neutral real-photo fallback (warm room, not a random picsum image). */
export const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80";
export const FALLBACK_ROOM_IMAGE =
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80";

export const CONDITIONS = [
  { id: "new", label: "New" },
  { id: "like_new", label: "Like New" },
  { id: "good", label: "Good" },
  { id: "fair", label: "Fair" },
  { id: "poor", label: "Poor" },
];
