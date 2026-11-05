/**
 * Room-preservation prompt builder.
 * Goal: use ALL listing data (photos are passed as input_image refs, plus the text fields here)
 * so the model copies the exact second-hand object into the room without restyling the room
 * and without re-inventing the product. Two locks:
 *  1) Room lock — the room's style/palette/materials/camera must not change at all.
 *  2) Identity lock — each product must be an identical, pixel-faithful copy of its photos.
 */
export type PromptItem = {
  title: string;
  description: string;
  category: string;
  condition: string;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  unit?: string | null;
  imageCount?: number;
};

/** Deterministic generation where the provider supports it: temperature 0 everywhere;
 * the fixed seed is sent only to providers that accept it (Replicate) — Meta Muse Image
 * rejects `seed` as an unknown parameter, so it is never sent there. */
export const GEN_TEMPERATURE = 0;
export const GEN_SEED = 42;

const CONDITION_WORDS: Record<string, string> = {
  new: "brand new, no wear",
  like_new: "like new, minimal wear",
  good: "good used condition, light wear consistent with photos",
  fair: "fair used condition, visible wear consistent with photos",
  poor: "worn condition, keep existing scuffs/scratches visible — do not beautify",
};

export function buildRoomPrompt(input: {
  items: PromptItem[];
  userPrompt?: string;
}): string {
  const { items, userPrompt } = input;
  const lines: string[] = [];

  lines.push(
    "TASK: Edit the FIRST image (the user's real room photo) by inserting the exact second-hand products shown in the following images. This is a faithful copy-and-place edit, not a redesign, not a restyle, and not a new scene."
  );
  lines.push(
    "STYLE LOCK (room must not change): Keep the room exactly as photographed. Return the same room, pixel-faithful outside the inserted items — identical walls and wall colour/texture, floor material, ceiling, windows, doors, curtains, skirting, built-ins, existing furniture and objects, lighting direction, light temperature, white balance, camera angle, focal length, and perspective. Do not modernise, repaint, re-floor, widen, brighten, declutter, or move anything already in the room."
  );
  lines.push(
    "IDENTITY LOCK (products must not change): Each inserted item is an identical copy of the same physical second-hand object in its photos — exact silhouette, proportions, colour, material and texture, number of drawers/doors/shelves, legs and handles. Keep its real used condition: do not beautify, do not remove scratches, stains, fading or wear, do not make it look new, do not recolour it, and do not substitute a generic or similar-looking product; do not reinterpret it in another style. If the photos show 6 drawers, output 6 drawers; if they show oak, output that oak."
  );

  // Name exactly which input photos belong to which item (photo 1 is always the room).
  let photoIdx = 2;
  items.forEach((it, i) => {
    const count = Math.max(1, it.imageCount ?? 1);
    const range = count === 1 ? `photo ${photoIdx}` : `photos ${photoIdx}–${photoIdx + count - 1}`;
    photoIdx += count;
    const size = it.width || it.height || it.depth
      ? `, size ${it.width ?? "?"}×${it.height ?? "?"}×${it.depth ?? "?"} ${it.unit || "cm"}`
      : ", size unknown — infer scale from its photos against doors (about 200 cm) and floorboards";
    const cond = CONDITION_WORDS[it.condition] || it.condition;
    const desc = (it.description || "").replace(/\s+/g, " ").trim().slice(0, 400);
    lines.push(
      `Item ${i + 1} is shown in ${range}: "${it.title}" — category: ${it.category}, condition: ${it.condition} (${cond})${size}. Description: ${desc || "see photos"}. Copy this exact object; never replace it with a generic ${it.category}.`
    );
  });

  lines.push(
    "PLACEMENT: Put each listed item once, on the floor, at its stated real-world size — large and clearly readable, never shrunk into the background. Correct perspective, contact shadows, and occlusion; match the room's existing light and shadow direction. Keep walkways clear; never float items, clip them through walls, overlap them unnaturally, or resize the room to fit them. If an item cannot fit where it would naturally go, place it in the nearest plausible open spot rather than altering the room or the item."
  );
  lines.push(
    "NOTHING ELSE: Do not add anything else. Add only the items listed above — no extra furniture, rug, plant, picture, lamp, cushion, person, animal, packaging, price tag, watermark, or text of any kind."
  );
  lines.push(
    "OUTPUT: One photorealistic image — the same room, unchanged, with only those identical second-hand items added."
  );
  if (userPrompt?.trim()) lines.push(`User note (apply only where it does not conflict with the locks above): ${userPrompt.trim().slice(0, 300)}`);
  return lines.join("\n");
}

export const NEGATIVE_PROMPT =
  "changed room, restyled room, changed style, new style, modernised room, new walls, repainted, different colour palette, different floor, extra furniture, random objects, plant, rug, picture frame, people, animals, distorted furniture, floating, generic substitute, substituted product, different product, recolored product, different material, beautified, removed scratches, new-looking, colour change, watermark, text, blurry, cartoon, reinterpreted furniture";
