export type AccentId = "terracotta" | "sage" | "slate" | "rose" | "ochre" | "forest";

export const ACCENTS: { id: AccentId; label: string; hex: string; dark: string; soft: string }[] = [
  { id: "terracotta", label: "Terracotta", hex: "#9a3412", dark: "#7c2d12", soft: "#fff7ed" },
  { id: "sage", label: "Sage", hex: "#4d6b57", dark: "#3a5242", soft: "#f0f5f1" },
  { id: "slate", label: "Slate", hex: "#334155", dark: "#1e293b", soft: "#f1f5f9" },
  { id: "rose", label: "Rosewood", hex: "#9f123f", dark: "#7f0e33", soft: "#fff1f2" },
  { id: "ochre", label: "Ochre", hex: "#92400e", dark: "#78350f", soft: "#fffbeb" },
  { id: "forest", label: "Forest", hex: "#14532d", dark: "#052e16", soft: "#f0fdf4" },
];

export function accentOf(id?: string | null) {
  return ACCENTS.find((a) => a.id === id) || ACCENTS[0];
}

export const PRONOUN_OPTIONS = ["she/her", "he/him", "they/them", "other", "prefer not to say"] as const;
export const LANGUAGE_OPTIONS = ["English", "Thai", "Chinese", "Japanese", "Korean", "Spanish", "French", "German", "Other"] as const;
export const PICKUP_BADGES: { id: string; label: string }[] = [
  { id: "elevator", label: "Elevator building" },
  { id: "step-free", label: "Step-free access" },
  { id: "evenings", label: "Evenings OK" },
  { id: "weekends", label: "Weekends OK" },
  { id: "help-carry", label: "Can help carry" },
  { id: "pet-friendly", label: "Pet-friendly pickup" },
];

export function parseJsonArray(v?: string | null): string[] {
  if (!v) return [];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
}
