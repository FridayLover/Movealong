export const FREE_CREDITS_PER_MONTH = 3;
export const CREDIT_PACKAGES = [
  { id: "pack10", credits: 10, price: 4.99, label: "Starter — 10 credits" },
  { id: "pack50", credits: 50, price: 19.99, label: "Popular — 50 credits" },
  { id: "pack120", credits: 120, price: 39.99, label: "Pro — 120 credits" },
];
export const SUBSCRIPTIONS = [
  { id: "plus", tier: "plus", price: 9.99, credits: 60, label: "Plus — 60 gens / month" },
  { id: "pro", tier: "pro", price: 19.99, credits: 9999, label: "Pro — Unlimited" },
];

export function shouldResetCredits(lastReset: Date) {
  const now = new Date();
  return now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
}

// ── Tier limits (chosen for quality + cost) ──
// Why: AI placement gets messy >8 items in one photo; per-room composition also costs more tokens.
// Free proves the value (3 items = sofa + table + lamp), Plus covers most living rooms (5), Pro power-users (8).
export const TIER_LIMITS: Record<string, { maxItemsPerRoom: number; maxSavedRooms: number; maxGenerationsSaved: number; label: string }> = {
  free: { maxItemsPerRoom: 3, maxSavedRooms: 1, maxGenerationsSaved: 30, label: "Free" },
  plus: { maxItemsPerRoom: 5, maxSavedRooms: 5, maxGenerationsSaved: 200, label: "Plus" },
  pro: { maxItemsPerRoom: 8, maxSavedRooms: 30, maxGenerationsSaved: 9999, label: "Pro" },
};

export function getLimits(tier: string) {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

export function isUnlimited(tier: string) {
  return tier === "pro";
}

/** Display helper — Pro must read "Unlimited", never the raw 9999 sentinel. */
export function formatCredits(credits: number, tier: string): string {
  if (isUnlimited(tier)) return "Unlimited";
  return `${credits}`;
}
