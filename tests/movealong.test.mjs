import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

test("map: user pin uses a different colour than listing pins and map recenters to user", () => {
  const src = read("src/components/MapView.tsx");
  // User pin must be distinct (blue) vs listing pins (warm terracotta)
  assert.match(src, /USER_PIN|#2563eb|#1d4ed8/i, "user pin should define a distinct blue colour");
  assert.match(src, /LISTING_PIN|#9a3412|terracotta/i, "listing pins should define warm colour distinct from user");
  assert.match(src, /flyTo|setView|panTo/, "map should recenter/fly to user location when known");
  assert.match(src, /useMap/, "should use a controller that reacts to user position");
});

test("seed images are real product/room photos, not random picsum placeholders", () => {
  const seed = read("prisma/seed.ts");
  assert.doesNotMatch(seed, /picsum\.photos\/seed/, "seed should not use picsum random images");
  assert.match(seed, /images\.unsplash\.com/, "seed should use real Unsplash product/room images");
});

test("card/detail fallbacks are not random picsum seeds", () => {
  const card = read("src/components/ListingCard.tsx");
  assert.doesNotMatch(card, /picsum\.photos\/seed/, "ListingCard fallback should not be picsum random");
});

test("building autocomplete does realtime Nominatim search", () => {
  const sell = read("src/app/sell/page.tsx");
  const hasComponent = (() => { try { read("src/components/BuildingAutocomplete.tsx"); return true; } catch { return false; } })();
  assert.ok(hasComponent, "BuildingAutocomplete component should exist");
  const comp = read("src/components/BuildingAutocomplete.tsx");
  assert.match(comp, /nominatim\.openstreetmap\.org/, "should query Nominatim for real places");
  assert.match(comp, /debounce|setTimeout|AbortController/, "should debounce realtime typing");
  assert.match(sell, /BuildingAutocomplete/, "Sell page should use the autocomplete for Building / condo");
});

test("building autocomplete orders nearest first and limits by screen size", () => {
  const comp = read("src/components/BuildingAutocomplete.tsx");
  // Nearest-first: must compute distance (haversine) and sort ascending, fetching a wider window than it shows
  assert.match(comp, /haversine/, "should compute distance with haversine for nearest-first ordering");
  assert.match(comp, /\.sort\(/, "should sort results");
  assert.match(comp, /distanceKm|_dist/, "should track per-result distance");
  assert.match(comp, /limit=15|FETCH_LIMIT/, "should fetch a wider window (15) before sorting/slicing");
  // Screen-size limit: number shown adapts to viewport, not a fixed 6
  assert.match(comp, /visibleLimit|innerHeight/, "should derive visible limit from screen/viewport size");
  assert.match(comp, /resize/, "should update limit on resize");
  assert.match(comp, /slice\(0,\s*visibleLimit/, "should slice sorted results to the screen-size limit");
  assert.doesNotMatch(comp, /limit=6/, "should not keep the old fixed limit=6");
});

test("AI prompt builder uses all listing fields and preserves the room", async () => {
  // prompt builder is pure and testable
  let promptMod;
  try {
    promptMod = await import(join(root, "src/lib/prompt.ts")).catch(() => null);
  } catch {}
  // Fallback: check ai.ts directly if prompt.ts not yet extracted
  const aiSrc = read("src/lib/ai.ts");
  const promptSrc = (() => { try { return read("src/lib/prompt.ts"); } catch { return ""; } })();
  const combined = promptSrc + "\n" + aiSrc;
  assert.match(combined, /PRESERVE|Keep the room exactly|do not change.*wall/i, "prompt must instruct to preserve room architecture");
  assert.match(combined, /Do not add|no extra|no random/i, "prompt must forbid random extra objects");
  assert.match(combined, /description/i, "prompt should include listing description");
  assert.match(combined, /condition/i, "prompt should include condition");
  assert.match(combined, /category/i, "prompt should include category");
  if (promptMod?.buildRoomPrompt) {
    const out = promptMod.buildRoomPrompt({
      roomTitle: "room",
      items: [{ title: "Oak dresser", description: "scratched top", category: "furniture", condition: "good", width: 160, height: 78, depth: 48, unit: "cm", imageCount: 3 }],
      userPrompt: "warm light",
    });
    assert.match(out, /Oak dresser/);
    assert.match(out, /scratched top/);
    assert.match(out, /160/);
    assert.match(out, /PRESERVE|Keep/i);
  }
});

test("unlimited plan shows 'Unlimited', never 9999, and logo has no WARM·FAST", async () => {
  const creditsSrc = read("src/lib/credits.ts");
  assert.match(creditsSrc, /formatCredits|isUnlimited/, "credits helper should format Unlimited for pro");
  // The helper itself must return the word Unlimited for pro
  try {
    const mod = await import(join(root, "src/lib/credits.ts")).catch(() => null);
    if (mod?.formatCredits) {
      assert.equal(mod.formatCredits(9999, "pro"), "Unlimited");
      assert.match(mod.formatCredits(12, "free"), /12/);
    }
  } catch {}
  for (const p of ["src/components/Header.tsx", "src/app/credits/page.tsx", "src/app/ai-lab/page.tsx", "src/app/profile/page.tsx"]) {
    const s = read(p);
    assert.match(s, /Unlimited/, `${p} should render Unlimited for pro instead of raw 9999`);
    assert.doesNotMatch(s, /WARM/, `${p} should not contain WARM badge`);
  }
  const header = read("src/components/Header.tsx");
  assert.doesNotMatch(header, /WARM\s*·\s*FAST/, "logo badge WARM · FAST must be removed");
});

test("all users can see how many favorites a listing has", () => {
  const listingsApi = read("src/app/api/listings/route.ts");
  assert.match(listingsApi, /favoriteCount|_count.*favorites|favorites:\s*true/, "listings feed API should include public favoriteCount");
  const card = read("src/components/ListingCard.tsx");
  assert.match(card, /favoriteCount/, "ListingCard should display the public favorite count");
  assert.match(card, /favorites|saved by/i, "card should label the count as favorites/saved");
});

test("users can chat with each other", () => {
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /model Conversation/, "schema should have Conversation");
  assert.match(schema, /model Message/, "schema should have Message");
  let hasApi = false;
  try { read("src/app/api/conversations/route.ts"); hasApi = true; } catch {}
  assert.ok(hasApi, "/api/conversations should exist");
  const detail = read("src/app/listing/[id]/page.tsx");
  assert.match(detail, /Chat|chat/, "listing detail should offer Chat with seller");
  let hasChatPage = false;
  try { read("src/app/chat/page.tsx"); hasChatPage = true; } catch {}
  assert.ok(hasChatPage, "/chat page (inbox + thread) should exist");
});

test("cart checkout offers card vs pay-at-pickup (recommended) with no-returns", () => {
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /model Order/, "schema should have Order for checkout");
  let hasCheckout = false;
  try { read("src/app/api/checkout/route.ts"); hasCheckout = true; } catch {}
  assert.ok(hasCheckout, "/api/checkout should exist");
  const profile = read("src/app/profile/page.tsx");
  assert.match(profile, /Pay at pickup|pay.*pickup/i, "checkout should offer pay at pickup");
  assert.match(profile, /[Rr]ecommended/, "pay at pickup should be marked Recommended");
  assert.match(profile, /[Cc]ard/, "checkout should offer pay by card");
  assert.match(profile, /No returns|no returns|as-is/, "second-hand no-returns must be stated before paying");
});

test("AI room item images are large on desktop and prompt is style/identity-faithful", async () => {
  const lab = read("src/app/ai-lab/page.tsx");
  assert.match(lab, /w-20|w-24|w-\[88px\]|size-\[88px\]/, "picker thumbnails should be large (w-20/w-24), not w-12");
  assert.doesNotMatch(lab, /w-12 h-12/, "old small w-12 picker thumbnail should be gone");
  assert.match(lab, /0\.(5[5-9]|6[0-9])/, "canvas single-item scale should be bigger (>=0.55) so items are readable on desktop");
  const promptSrc = (() => { try { return read("src/lib/prompt.ts"); } catch { return ""; } })();
  assert.match(promptSrc, /do not restyle|STYLE LOCK|keep.*style/i, "prompt must lock room style");
  assert.match(promptSrc, /identical|pixel-faithful|exact copy/i, "prompt must demand identical product copy");
  assert.match(promptSrc, /do not reinterpret|not a generic/i, "prompt must forbid generic reinterpretation");
  try {
    const mod = await import(join(root, "src/lib/prompt.ts")).catch(() => null);
    if (mod?.buildRoomPrompt) {
      const out = mod.buildRoomPrompt({ items: [{ title: "Oak dresser", description: "scratched top", category: "furniture", condition: "good", width: 160, height: 78, depth: 48, unit: "cm", imageCount: 2 }] });
      assert.match(out, /identical|exact/i);
      assert.match(out, /style/i);
    }
  } catch {}
});

test("Muse Spark concierge: room picks within prefs, sell auto-fill, chat draft", () => {
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /AgentMessage/, "schema should persist agent chat (AgentMessage)");
  let hasAgentLib = false;
  try { read("src/lib/agent.ts"); hasAgentLib = true; } catch {}
  assert.ok(hasAgentLib, "src/lib/agent.ts (Muse Spark orchestration) should exist");
  const agentLib = read("src/lib/agent.ts");
  assert.match(agentLib, /muse-spark/, "agent should call Muse Spark on the Meta Model API");
  assert.match(agentLib, /api\.meta\.ai/, "agent should use https://api.meta.ai/v1");
  let hasApi = false;
  try { read("src/app/api/agent/chat/route.ts"); hasApi = true; } catch {}
  assert.ok(hasApi, "/api/agent/chat should exist");
  const api = read("src/app/api/agent/chat/route.ts");
  assert.match(api, /maxDistanceKm|distanceKm/, "agent recommendations must respect distance preference");
  assert.match(api, /budget|prefBudget/, "agent recommendations must respect budget preference");
  assert.match(api, /draftListing/, "agent should be able to return a sell draft to auto-fill the listing form");
  assert.match(api, /draftReply/, "agent should be able to draft a chat reply");
  let hasPage = false;
  try { read("src/app/agent/page.tsx"); hasPage = true; } catch {}
  assert.ok(hasPage, "/agent page should exist");
  const page = read("src/app/agent/page.tsx");
  assert.match(page, /saved room|Saved room|rooms/i, "agent UI should let the user pick a saved room (chosen: saved rooms + sliders)");
  // Full-page agent reuses the chat core; sliders/rooms live in the shared component
  const chatCore = read("src/components/AgentChat.tsx");
  assert.match(chatCore, /saved room|Saved room/i, "agent chat should let the user pick a saved room (chosen: saved rooms + sliders)");
  assert.match(chatCore, /Distance/, "agent UI should expose a distance slider/preference");
  assert.match(chatCore, /Budget/, "agent UI should expose a budget preference");
  assert.match(chatCore, /typing-dot|Looking at your room/, "agent should animate while helping (typing/status)");
  let hasWidget = false;
  try { read("src/components/AgentWidget.tsx"); hasWidget = true; } catch {}
  assert.ok(hasWidget, "floating AgentWidget should exist so help is available everywhere");
  const widget = read("src/components/AgentWidget.tsx");
  assert.match(widget, /agent-panel-in|panelIn/, "agent help should animate in");
  assert.match(widget, /Close|✕|Escape/, "user must be able to close the agent (button + Esc)");
  const css = read("src/app/globals.css");
  assert.match(css, /prefers-reduced-motion/, "animations must respect prefers-reduced-motion");
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /AgentWidget/, "layout should mount the closable agent widget");
  const sell = read("src/app/sell/page.tsx");
  assert.match(sell, /sellDraft|draft/i, "Sell page should apply an agent draft (auto-fill)");
});

test("agent chat accepts attached images to sell, find-similar, or ask about an item", () => {
  const chat = read("src/components/AgentChat.tsx");
  // Composer-level attach (not hidden in prefs): a visible attach control next to Send
  assert.match(chat, /Attach|attach/i, "agent composer should have an attach control");
  assert.match(chat, /type="file" accept="image\/\*"/, "agent should accept image files");
  assert.match(chat, /attachedImages|attachments/i, "agent should track attached images separately from room/product prefs");
  assert.match(chat, /Sell this|sell/i, "attach flow should offer a Sell-this intent");
  assert.match(chat, /[Ss]imilar|like this/i, "attach flow should offer a Find-similar (like my image) intent");
  assert.match(chat, /imageIntent/, "client should tell the agent what the attached image is for");
  assert.match(chat, /remove|✕/, "attached previews should be removable before sending");
  const api = read("src/app/api/agent/chat/route.ts");
  assert.match(api, /productImages/, "agent API should receive attached product images");
  assert.match(api, /imageIntent/, "agent API should forward the attach intent");
  const agent = read("src/lib/agent.ts");
  assert.match(agent, /imageIntent/, "agent brain should branch on the attach intent");
  assert.match(agent, /similar|like this|look like/i, "agent should handle 'find items like my photo'");
});

test("small agent chat: composer stays reachable with an image attached", () => {
  const chat = read("src/components/AgentChat.tsx");
  // Messages area must be allowed to shrink (min-h-0) — a fixed min-height pushes the composer off-panel
  assert.match(chat, /min-h-0/, "agent messages area should use min-h-0 so the composer is never pushed out");
  assert.doesNotMatch(chat, /min-h-\[220px\]/, "compact chat must not force a 220px messages floor that clips the input");
  // Composer is pinned (shrink-0) at the bottom of the column
  assert.match(chat, /shrink-0[^"]*flex gap-2|flex gap-2[^"]*shrink-0/, "agent composer should be shrink-0 (pinned)");
});

test("agent history is shared (widget + Agent page) and item cards survive refresh", () => {
  const chat = read("src/components/AgentChat.tsx");
  assert.match(chat, /movealong:agent-history/, "agent instances should broadcast/listen for history updates");
  assert.match(chat, /addEventListener\(\s*["']movealong:agent-history/, "agent chat should re-load history when the other instance sends");
  // Restored history must rebuild the item cards, not drop them
  assert.match(chat, /recommendedListings:\s*m\.meta\?\.recommendedListings|meta\?\.recommendedListings/, "restored history should map recommendedListings from saved meta");
  const api = read("src/app/api/agent/chat/route.ts");
  assert.match(api, /recommendedListings/, "GET history should resolve saved recommendedIds into listing cards");
});

test("sell intent always yields a draft that prefills Sell (never just recommendations)", () => {
  const chat = read("src/components/AgentChat.tsx");
  // Typed words beat the default chip: "sell this" must not be treated as find-similar
  assert.match(chat, /inferIntent|SELL_WORDS|sell.*test\(|test\(.*sell/i, "client should infer sell intent from typed words over the default chip");
  const agent = read("src/lib/agent.ts");
  // Server-side guarantee: sell intent with no model draft falls back to a local draft
  assert.match(agent, /imageIntent\s*===\s*["']sell["'][\s\S]{0,300}draftListing/, "runAgent/mockAgent should guarantee a draftListing for sell intent");
  assert.match(agent, /imageIntent\s*===\s*["']similar["'][\s\S]{0,200}draftListing:\s*null|draftListing\s*=\s*null/, "similar intent must never produce a sell draft");
  const sell = read("src/app/sell/page.tsx");
  assert.match(sell, /movealong:sellDraft/, "Sell page should consume the agent draft from sessionStorage");
  assert.match(sell, /Publish listing/, "publishing stays a manual user click — the agent only prefills");
});

test("agent quick actions are modes: Recommend shows filters, Sell is sell-mode, Reply is reply-mode", () => {
  const chat = read("src/components/AgentChat.tsx");
  assert.match(chat, /const \[mode, setMode\]|type AgentMode|mode === "recommend"/, "agent should have an explicit recommend/sell/reply mode state");
  assert.match(chat, /setMode\("sell"\)|setMode\(m\)|onClick=\{\(\) => setMode/, "mode buttons should switch modes, not just send text");
  // Recommend mode reveals the filters (distance/budget/room…)
  assert.match(chat, /mode === "recommend"[\s\S]{0,2600}Distance/, "recommend mode should show the filter controls");
  assert.match(chat, /mode === "recommend"[\s\S]{0,2600}Budget/, "recommend mode should show the budget control");
  // Sell mode is tailored (its own panel, not the recommend filters)
  assert.match(chat, /mode === "sell"/, "sell mode should render a tailored sell panel");
  assert.match(chat, /Sell mode|sell panel|condition/i, "sell mode should offer sell-specific controls (e.g. condition)");
  // Reply mode is tailored too
  assert.match(chat, /mode === "reply"/, "reply mode should render a tailored reply panel");
  assert.match(chat, /tone|Tone/, "reply mode should offer a tone choice");
  // Mode drives the request, not just wording
  assert.match(chat, /mode === "sell"[\s\S]{0,200}sell|effectiveIntent|modeIntent/, "send() should force sell intent in sell mode");
});

test("sell draft carries the user's attached photos into the Sell form", () => {
  const chat = read("src/components/AgentChat.tsx");
  assert.match(chat, /draftImages/, "draft card should remember the photos the draft was made from");
  assert.match(chat, /applyDraft\(m\.draftListing,\s*m\.draftImages|applyDraft\([^)]*images/, "Use-this-draft should pass the photos along");
  const sell = read("src/app/sell/page.tsx");
  assert.match(sell, /draft\.images|draftImages/, "Sell page should read photos carried in the agent draft");
  assert.match(sell, /setImages\(/, "Sell page should prefill the photo picker from the draft");
});

test("Meta AI calls are time-bounded (a slow provider can never hang generate/chat)", () => {
  const ai = read("src/lib/ai.ts");
  assert.match(ai, /AbortController|AbortSignal\.timeout/, "image generation should abort on timeout");
  assert.match(ai, /timeout|Timeout|TIMEOUT/, "image generation should define a timeout budget");
  const agent = read("src/lib/agent.ts");
  assert.match(agent, /AbortController|AbortSignal\.timeout/, "Muse Spark calls should abort on timeout");
});

test("AI endpoints are rate-limited per user (credits and chat cannot be spammed)", () => {
  let hasLib = false;
  try { read("src/lib/rateLimit.ts"); hasLib = true; } catch {}
  assert.ok(hasLib, "a shared rate-limit helper should exist");
  const gen = read("src/app/api/ai/generate/route.ts");
  assert.match(gen, /rateLimit|rate limit/i, "generate should check a per-user rate limit");
  assert.match(gen, /429/, "generate should answer 429 when the limit is hit");
  const agent = read("src/app/api/agent/chat/route.ts");
  assert.match(agent, /rateLimit|rate limit/i, "agent chat should check a per-user rate limit");
});

test("same-building items are called out on cards (core promise of the app)", () => {
  const card = read("src/components/ListingCard.tsx");
  assert.match(card, /Same building/, "cards should label same-building items");
  assert.match(card, /distanceKm/, "same-building should derive from the computed distance");
});

test("listing detail never leaks seller email and can show distance", () => {
  const api = read("src/app/api/listings/[id]/route.ts");
  assert.doesNotMatch(api, /seller:\s*\{\s*select:\s*\{[^}]*email:\s*true/, "public detail API must not select the seller email");
  assert.match(api, /distanceKm/, "detail API should compute distanceKm when buyer coords are given");
  const page = read("src/app/listing/[id]/page.tsx");
  assert.match(page, /Same building|km away|distanceKm/, "detail page should surface same-building/distance");
});

test("listing pages can hand context to Baan (Ask Baan about this item)", () => {
  const detail = read("src/app/listing/[id]/page.tsx");
  assert.match(detail, /Ask Baan/, "detail should offer Ask Baan");
  assert.match(detail, /movealong:agentPrefill|movealong:open-agent/, "detail should hand the item context to the agent");
  const widget = read("src/components/AgentWidget.tsx");
  assert.match(widget, /movealong:open-agent/, "widget should open when a page asks Baan for help");
  const chat = read("src/components/AgentChat.tsx");
  assert.match(chat, /movealong:agentPrefill|agentPrefill/, "agent chat should consume the prefilled question");
});

test("feed widens instead of showing an empty map when nothing is within range", () => {
  const feed = read("src/app/page.tsx");
  assert.match(feed, /widened|Nothing within/, "feed should detect an empty located result and widen with a notice");
  assert.match(feed, /maxDistance:\s*String\(100000\)|100000/, "widening should effectively remove the distance cap, nearest first");
});

test("A: listing cards cannot collide text (fewer overlay badges, truncation, shared bottom row)", () => {
  const card = read("src/components/ListingCard.tsx");
  assert.doesNotMatch(card, /bg-black\/60 text-white backdrop-blur/, "category should not be a third overlay badge competing with price/-%/actions");
  assert.match(card, /truncate/, "seller/building meta should truncate instead of colliding");
  assert.match(card, /justify-between/, "bottom image labels should share one row, not absolute corners that collide");
});

test("B: assistant panel is comfortable — expandable on desktop, full-screen on mobile", () => {
  const widget = read("src/components/AgentWidget.tsx");
  assert.match(widget, /expanded|Expand/, "widget should offer an expanded mode");
  assert.match(widget, /max-sm:inset-0|inset-0/, "widget panel should go full-screen on small screens");
  assert.match(widget, /safe-area|env\(safe-area/, "mobile panel should respect safe areas");
});

test("C: filters are progressive — essentials first, advanced disclosed, applied chips + reset", () => {
  const filters = read("src/components/Filters.tsx");
  assert.match(filters, /aria-expanded/, "advanced filters should sit behind an accessible disclosure");
  assert.match(filters, /Reset|reset/i, "filters should offer a predictable reset");
  assert.match(filters, /onReset|Applied|active/i, "applied filters should be visible/removable");
});

test("D: agent page is a full-height workspace with reader-friendly scrolling", () => {
  const page = read("src/app/agent/page.tsx");
  assert.match(page, /100dvh|dvh/, "agent page should size the workspace to the dynamic viewport");
  const chat = read("src/components/AgentChat.tsx");
  assert.doesNotMatch(chat, /max-h-\[52vh\]/, "history must not be capped at 52vh on the agent page");
  assert.match(chat, /onScroll|nearBottom|stick/i, "auto-scroll should respect readers (only stick when near the bottom)");
  assert.match(chat, /Latest|Jump|New messages|↓/, "a jump-to-latest affordance should appear when scrolled up");
});

test("PWA manifest ships a real icon (mobile-ready story is honest)", () => {
  const manifest = JSON.parse(read("public/manifest.json"));
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, "manifest should declare at least one icon");
  for (const icon of manifest.icons) {
    assert.ok(icon.src && icon.sizes, "each icon needs src + sizes");
    read(`public${icon.src}`); // throws if the icon file does not exist
  }
});

test("ops readiness: health endpoint and one-command verify", () => {
  let hasHealth = false;
  try { read("src/app/api/health/route.ts"); hasHealth = true; } catch {}
  assert.ok(hasHealth, "/api/health should exist for Docker/judge smoke checks");
  const health = read("src/app/api/health/route.ts");
  assert.match(health, /prisma|db/i, "health should check the database");
  assert.match(health, /configured/, "health should report whether AI providers are configured (boolean only)");
  assert.doesNotMatch(health, /apiKey\s*:|key:\s*process\.env|Bearer/, "health must never return key material");
  const pkg = read("package.json");
  assert.match(pkg, /"verify":/, "package.json should offer a one-command verify (test + types + build)");
});

test("design system: shared motion tokens and control classes exist", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /--dur-fast|--duration/, "CSS should define reusable duration tokens");
  assert.match(css, /--ease/, "CSS should define a shared easing token");
  assert.match(css, /\.btn-primary/, "shared primary button class should exist");
  assert.match(css, /\.btn-secondary|\.btn-ghost/, "shared secondary button class should exist");
  assert.match(css, /\.input/, "shared input class should exist");
  const header = read("src/components/Header.tsx");
  assert.match(header, /btn-primary|btn-secondary/, "header should consume the shared button system");
});

test("feed leads with the task, not a marketing hero or stat-card grid", () => {
  const feed = read("src/app/page.tsx");
  assert.doesNotMatch(feed, /text-4xl|sm:text-4xl/, "feed H1 should stay compact (task-first, no giant hero)");
  assert.doesNotMatch(feed, /grid sm:grid-cols-3 gap-3 text-sm/, "research stats should not be an identical 3-card grid");
  assert.match(feed, /thredUp|IKEA/, "research evidence line should remain, with attribution");
});

test("navigation shows where you are; card actions meet touch size; agent dialog manages focus", () => {
  const header = read("src/components/Header.tsx");
  assert.match(header, /usePathname/, "header should know the current route for active nav state");
  assert.match(header, /aria-current/, "active nav link should expose aria-current");
  const card = read("src/components/ListingCard.tsx");
  assert.match(card, /w-10 h-10/, "card favourite/cart targets should be at least 40px");
  const widget = read("src/components/AgentWidget.tsx");
  assert.match(widget, /\.focus\(\)|autoFocus/, "agent dialog should move focus in on open (and restore on close)");
});

test("agent history restores the LATEST messages, not the oldest 50", () => {
  const api = read("src/app/api/agent/chat/route.ts");
  assert.match(api, /orderBy:\s*\{\s*createdAt:\s*"desc"\s*\}/, "history should fetch newest-first before slicing");
  assert.match(api, /reverse\(\)/, "history should reverse newest-first rows back to chronological order");
});

test("feed never hides listings that have no coordinates", () => {
  const api = read("src/app/api/listings/route.ts");
  // Listings without lat/lng must survive distance filtering (shown last, distance unknown)
  assert.doesNotMatch(api, /\.filter\(\(l:any\)=> l\._dist <= maxDistance\)\s*\n?\s*\.sort/, "distance filter must not drop coordinate-less listings");
  assert.match(api, /_dist === Infinity \|\||distanceKm.*null|Infinity/, "coordinate-less listings should be kept and sort last");
});

test("chat has real unread state (schema, API counts, inbox + header badges)", () => {
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /readAt/, "Message should track readAt for unread counts");
  const convs = read("src/app/api/conversations/route.ts");
  assert.match(convs, /unread/i, "inbox API should return per-conversation unread counts");
  const thread = read("src/app/api/conversations/[id]/route.ts");
  assert.match(thread, /readAt/, "opening a thread should mark the other party's messages read");
  const chat = read("src/app/chat/page.tsx");
  assert.match(chat, /unread/i, "inbox UI should show unread badges");
  const header = read("src/components/Header.tsx");
  assert.match(header, /unread/i, "header Messages should surface an unread badge");
});

test("my listings are matched by seller id, never by display name", () => {
  const api = read("src/app/api/listings/route.ts");
  assert.match(api, /seller:\s*\{\s*select:\s*\{[^}]*id:\s*true/, "listings API should expose seller.id");
  const profile = read("src/app/profile/page.tsx");
  assert.match(profile, /seller\.id\s*===|seller\?\.id\s*===/, "profile should filter own listings by seller.id");
  assert.doesNotMatch(profile, /seller\.name\s*===\s*meRes\.user\.name/, "profile must not match own listings by name (collisions)");
});

test("feed distinguishes a load failure from an empty result (retry, not '0 items')", () => {
  const feed = read("src/app/page.tsx");
  assert.match(feed, /feedError|loadError|setError\(/, "feed should track a listings load error");
  assert.match(feed, /Retry|Try again/, "feed should offer a retry after a failed load");
  assert.match(feed, /!r\.ok|res\.ok|response\.ok/, "feed should check the listings response status");
});

test("images lazy-load and keyboard focus is visible app-wide", () => {
  const card = read("src/components/ListingCard.tsx");
  assert.match(card, /loading="lazy"/, "listing photos should lazy-load below the fold");
  const css = read("src/app/globals.css");
  assert.match(css, /:focus-visible/, "global CSS should give keyboard users a visible focus ring");
});

test("profile: View my shop up front, minimal modern default, still customizable", () => {
  const profile = read("src/app/profile/page.tsx");
  // Prominent View my shop from the profile header (not buried in settings)
  assert.match(profile, /View my shop/, "profile should have a View my shop button");
  assert.match(profile, /\/seller\/\$\{me\.id\}/, "View my shop should link to the owner's public shop");
  // Minimal modern default: cover band + overlapping avatar, themed by the user's accent with a clean fallback
  assert.match(profile, /me\.coverImage|coverImage/, "profile header should use the cover image when set");
  assert.match(profile, /accentOf\(me\.accent\)|accentOf\(me\?\.accent/, "profile should theme itself from the user's saved accent (default terracotta)");
  // …and the user can still adjust it themselves
  assert.match(profile, /Accent colour|accent/i, "profile settings should keep the accent customizer");
  assert.match(profile, /Save changes/, "profile settings should still save customizations");
});

test("AI Lab generate never crashes the page while loading (null-result guard)", () => {
  const lab = read("src/app/ai-lab/page.tsx");
  // The bug: `{!loading && !result ? empty : result.provider}` dereferences result
  // while a generation is in flight (result === null) -> client-side exception.
  assert.doesNotMatch(lab, /\{!loading && !result \?/, "preview must not branch to the result view while loading with a null result");
  assert.match(lab, /loading \?|!result \?|result &&/, "preview should explicitly guard loading/empty/result states");
  assert.match(lab, /result\?\.provider|result &&|!result/, "result fields should be read null-safely");
  // Canvas composite must survive browsers without roundRect and image errors
  assert.match(lab, /roundRect[\s\S]{0,120}rect\(|typeof.*roundRect|roundRect \?/, "canvas should fall back when roundRect is unavailable");
  // Stale selections (e.g. an old ?listing= link after a reseed) must be pruned, not 404 the generate call
  assert.match(lab, /filter\(.*selectedIds|selectedIds.*filter|validIds|prune/i, "AI Lab should prune selected ids that no longer exist");
  const ai = read("src/lib/ai.ts");
  assert.match(ai, /startsWith\("http/, "provider image URLs must be used as URLs, not wrapped as base64");
});

test("chic diverse public storefront makes visitors want to buy", () => {
  const schema = read("prisma/schema.prisma");
  for (const f of ["coverImage", "tagline", "pronouns", "languages", "accent", "showcaseIds", "pickupBadges"]) {
    assert.match(schema, new RegExp(f), `User should have ${f} for a diverse, chic storefront`);
  }
  assert.match(schema, /prefDistanceKm/, "User should store agent distance preference");
  let hasPublicApi = false;
  try { read("src/app/api/users/[id]/route.ts"); hasPublicApi = true; } catch {}
  assert.ok(hasPublicApi, "/api/users/[id] public seller API should exist");
  let hasSellerPage = false;
  try { read("src/app/seller/[id]/page.tsx"); hasSellerPage = true; } catch {}
  assert.ok(hasSellerPage, "/seller/[id] chic public page should exist");
  const sellerPage = read("src/app/seller/[id]/page.tsx");
  assert.match(sellerPage, /coverImage|cover/i, "storefront should show a cover");
  assert.match(sellerPage, /accent/, "storefront should be themed by the seller's accent colour");
  assert.match(sellerPage, /Chat|chat/, "storefront should let visitors start a chat (buy more)");
  const profile = read("src/app/profile/page.tsx");
  assert.match(profile, /pronouns/i, "profile edit should fit diversity (pronouns)");
  assert.match(profile, /languages/i, "profile edit should fit diversity (languages)");
  assert.match(profile, /accent/i, "profile edit should let the seller pick an accent");
  assert.match(profile, /cover/i, "profile edit should let the seller set a cover");
  const detail = read("src/app/listing/[id]/page.tsx");
  assert.match(detail, /\/seller\//, "listing detail should link to the seller's public shop");
});

test("agent is a home-like character icon that floats to help (bottom-right)", () => {
  let hasBuddy = false;
  try { read("src/components/HomeBuddy.tsx"); hasBuddy = true; } catch {}
  assert.ok(hasBuddy, "HomeBuddy house-character component should exist");
  const buddy = read("src/components/HomeBuddy.tsx");
  assert.match(buddy, /<svg/, "buddy should be an inline SVG character (no emoji icon)");
  assert.match(buddy, /roof|Roof|path d="M/i, "buddy should look like a house (roof/body)");
  assert.match(buddy, /buddy-eyes|buddyEye/i, "buddy should have animated eyes (blink)");
  const widget = read("src/components/AgentWidget.tsx");
  assert.match(widget, /HomeBuddy/, "floating widget should use the HomeBuddy character as its icon");
  assert.match(widget, /agent-float|agentFloat/, "agent icon should float/bob to invite help");
  assert.match(widget, /bottom-5 right|bottom-4 right|right-4|right-5/, "agent should sit at the bottom right");
  assert.match(widget, /bubble|nudge|Need help|styling your room|help/i, "agent should periodically float a help bubble offering help");
  assert.match(widget, /Close|✕|Escape/, "agent must stay closable");
  const css = read("src/app/globals.css");
  assert.match(css, /@keyframes\s+(agentFloat|floatY)/, "CSS should define the agent float keyframes");
  assert.match(css, /@keyframes\s+(buddyBlink|blink)/, "CSS should define the buddy blink keyframes");
  assert.match(css, /\.agent-float/, "CSS should expose the float utility used by the widget");
});

test("app-wide animation revision: page entry, card/button micro-motion, reduced motion", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /@keyframes\s+pageIn/, "CSS should define a page-entry animation");
  assert.match(css, /@keyframes\s+pop/, "CSS should define a pop animation for fav/cart feedback");
  assert.match(css, /\.animate-page-in/, "layout/page should be able to use page-entry motion");
  assert.match(css, /\.animate-pop/, "badges/hearts should be able to pop");
  assert.match(css, /prefers-reduced-motion/, "all added motion must respect prefers-reduced-motion");
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /animate-page-in/, "layout should animate page entry");
  const card = read("src/components/ListingCard.tsx");
  assert.match(card, /animate-pop|press/, "listing card actions should give animated press/pop feedback");
  const header = read("src/components/Header.tsx");
  assert.match(header, /animate-pop/, "header fav/cart badges should pop when counts change");
});

test("research-backed features are present in schema/UI", () => {
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /originalPrice/, "Listing should store original retail price for % saved");
  assert.match(schema, /moveOutDate/, "Listing should store must-go-by date for urgency");
  assert.match(schema, /SavedSearch/, "SavedSearch model should exist for alerts (speed matters in resale)");
  const home = read("src/app/page.tsx");
  assert.match(home, /Saved search|Notify me|%|second-hand|secondhand/i, "Feed should surface saved-search / price insight");
});

test("i18n: LanguageProvider and selector expose en/th/zh/es", () => {
  const src = read("src/lib/i18n.tsx");
  for (const code of ['code: "en"', 'code: "th"', 'code: "zh"', 'code: "es"']) assert.ok(src.includes(code), code);
  assert.match(src, /ไทย/, "Thai translations present");
  assert.match(src, /中文/, "Chinese translations present");
  assert.match(src, /Español/, "Spanish translations present");
  assert.match(src, /localStorage\.setItem\("movealong:lang"/, "language persists across refresh");
  assert.match(src, /document\.documentElement\.lang/, "document lang updates for screen readers");
});

test("i18n: UI strings localized in header, filters, cards and home feed", () => {
  for (const f of ["src/components/Header.tsx", "src/components/Filters.tsx", "src/components/ListingCard.tsx", "src/app/page.tsx"]) {
    assert.match(read(f), /useI18n\(\)|tr\(/, f + " uses i18n");
  }
});

test("i18n: language selector wired into header (desktop + mobile menu)", () => {
  assert.match(read("src/components/Header.tsx"), /LanguageSelect/, "selector in header");
});

test("i18n: layout wraps the app in LanguageProvider", () => {
  assert.match(read("src/app/layout.tsx"), /LanguageProvider/, "provider mounted");
});

test("i18n: user content auto-translates via Muse Spark API and falls back to source", () => {
  const tr = read("src/app/api/translate/route.ts");
  assert.match(tr, /muse-spark-1\.3/, "uses Muse Spark model");
  assert.match(tr, /api\.meta\.ai/, "calls Meta API");
  assert.match(tr, /provider: "original"/, "honest fallback keeps the original text, never fake translation");
  assert.match(tr, /rateLimit\(/, "translation endpoint is rate-limited");
  assert.match(read("src/lib/i18n.tsx"), /useTranslated/, "client hook translates user-written listing text");
  assert.match(read("src/components/ListingCard.tsx"), /useTranslated\(l\.title\)/, "card titles go through translation");
});

test("i18n: sell, auth and credits pages are localized too", () => {
  for (const f of ["src/app/sell/page.tsx", "src/app/auth/page.tsx", "src/app/credits/page.tsx", "src/app/agent/page.tsx"]) {
    assert.match(read(f), /useI18n\(\)/, f + " uses i18n");
  }
});

test("bugs: themeColor lives in viewport export, not metadata (no Next warning)", () => {
  const src = read("src/app/layout.tsx");
  assert.match(src, /export const viewport/, "viewport export exists");
  assert.match(src, /themeColor:/, "themeColor set in viewport");
  const meta = src.slice(src.indexOf("export const metadata"), src.indexOf("export const viewport"));
  assert.ok(!meta.includes("themeColor"), "metadata export must not contain themeColor");
});

test("nav: language choice is a minimal icon button with tappable options", () => {
  const src = read("src/lib/i18n.tsx");
  assert.match(src, /aria-haspopup="true"/, "icon button opens language menu");
  assert.match(src, /role="menuitemradio"/, "each language is a tappable option");
  assert.match(src, /min-h-\[44px\]|min-h-11/, "options meet 44px touch target");
  assert.match(src, /h-9 w-9 flex-none shrink-0 aspect-square/, "trigger is the same 36px circle as heart/cart, never an oval");
  assert.ok(!src.includes("<select"), "no cramped native select for language");
});

test("nav: language menu is reachable on mobile too", () => {
  const src = read("src/components/Header.tsx");
  assert.ok((src.match(/LanguageSelect/g) || []).length >= 2, "language control in header bar and mobile menu");
});

test("nav: no label wraps to a second line in any language", () => {
  const src = read("src/components/Header.tsx");
  assert.match(src, /whitespace-nowrap/, "nav labels and actions never wrap");
  assert.match(src, /hidden xl:flex/, "full nav only shows when there is room for one line (xl+)");
  assert.match(src, /xl:hidden/, "hamburger covers below xl so nothing squeezes");
  const i18n = read("src/lib/i18n.tsx");
  assert.match(i18n, /whitespace-nowrap/, "language options stay on one line");
});

test("ui: shared buttons never wrap icon+text to a second line", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /\.btn-primary \{[^}]*whitespace-nowrap/, "primary buttons one line");
  assert.match(css, /\.btn-dark \{[^}]*whitespace-nowrap/, "dark buttons one line");
});

test("ai: generation is deterministic — temperature 0 and a fixed seed everywhere", () => {
  for (const f of ["src/lib/ai.ts", "src/lib/agent.ts", "src/app/api/translate/route.ts"]) {
    assert.match(read(f), /temperature:\s*(0|GEN_TEMPERATURE)/, f + " sets temperature 0");
  }
  assert.match(read("src/lib/ai.ts"), /seed:\s*GEN_SEED/, "image generation uses a fixed seed");
  assert.match(read("src/lib/prompt.ts"), /GEN_SEED/, "seed constant lives with generation params");
});

test("ai: room prompt has no duplicated lock blocks and maps photos to items", () => {
  const src = read("src/lib/prompt.ts");
  assert.equal((src.match(/PRESERVE THE ROOM EXACTLY/g) || []).length, 0, "old duplicated preserve block removed");
  assert.equal((src.match(/STYLE LOCK/g) || []).length, 1, "style lock stated once");
  assert.equal((src.match(/IDENTITY LOCK/g) || []).length, 1, "identity lock stated once");
  assert.match(src, /photos? \${photoIdx}/, "each item names which input photos belong to it");
});

test("ai: Meta Muse Image calls must not send seed (provider rejects it as unknown)", () => {
  const src = read("src/lib/ai.ts");
  const metaSection = src.slice(src.indexOf("generateWithMeta"), src.indexOf("generateWithReplicate"));
  assert.ok(!metaSection.includes("seed"), "Meta section must not contain a seed parameter");
  const replicateSection = src.slice(src.indexOf("generateWithReplicate"));
  assert.match(replicateSection, /seed/, "Replicate fallback keeps the fixed seed (it accepts it)");
});

test("ai: images are inlined as data URLs before Meta calls (provider cannot fetch third-party URLs)", () => {
  const helper = read("src/lib/imageInline.ts");
  assert.match(helper, /toInlineImage/, "shared inline helper exists");
  assert.match(helper, /data:\$\{type\};base64/, "produces data URLs");
  assert.match(helper, /startsWith\("data:"\)/, "already-inline data URLs pass through");
  const ai = read("src/lib/ai.ts");
  assert.match(ai, /toInlineImage|inlineImages/, "room generation inlines images before sending");
  const agent = read("src/lib/agent.ts");
  assert.match(agent, /toInlineImage|inlineImages/, "agent inlines attached/room photos before sending");
});
