# Validation — what was actually run (2026-11-05 session)

Environment note: this workspace is **not a git repository** (`git status`
fails), so no git diff/status evidence exists; changes were reviewed by file
inspection instead. The shell sandbox blocks binding TCP ports and no
browser-automation dependencies (Playwright/Puppeteer) are installed, so
**no live browser/screenshot verification was possible in this environment**.
UI verification below is therefore: production build + durable source tests +
handler-level API probes against the real database. Anything not listed here
was not verified.

## Baseline (before this round's changes)

| Check | Command | Result |
|---|---|---|
| Tests | `npm test` | 24 passed, 0 failed |
| Types | `npx tsc --noEmit` | clean |

## After changes

| Check | Command | Result |
|---|---|---|
| Tests | `npm test` | **27 passed, 0 failed** (incl. 3 new: seller-id matching, feed error≠empty + retry, lazy images + focus-visible) |
| Types | `npx tsc --noEmit` | clean |
| Build | `npm run build` | compiled successfully (all routes incl. `/agent`, `/seller/[id]`) |
| Lint | `npm run lint` | warnings only (`<img>` usage is intentional — data-URL images; no errors) |

## Behavioural probes (executed, real DB + route handlers)

| Probe | Evidence |
|---|---|
| Listings expose seller identity | `GET /api/listings` → 200, 8 listings, every `seller` has `{id, name, avatar}`; 3 distinct seller ids |
| AI generate (prior round, re-verified earlier) | `POST /api/ai/generate` → 200 via `meta-muse`, result image set, 1 credit deducted; stale listing id → handled 404 error body |
| Agent history restore (prior round) | Stored `recommendedIds` resolve back to full listing cards after refresh (200, card title + distance) |
| Agent intents (prior round) | similar → recommendations, no draft · sell → draft with user words as title, chosen condition honoured · ask → checklist, no draft |

Probe data was cleaned up (demo credits restored, probe rows removed).
Probes are throwaway scripts under `/tmp`, not shipped; the durable
equivalents live in `tests/movealong.test.mjs`.

## Second pass (feature-audit round)

Fixes, each with a failing-first durable test and a live probe:

| Fix | Probe evidence |
|---|---|
| Agent history latest-50 window (was oldest-50 freeze) | Seeded 55 messages → GET returns a 50-message latest window in chronological order (first `msg-5`, newest at the end; same-millisecond ties may shift by one) |
| Coordinate-less listings stay in feed | Temp no-pin listing → appears in a 5 km located feed, sorted last, `distanceKm: null` (probe listing deleted after) |
| Unread chat end-to-end | Seeded unread message → inbox `unreadCount: 1` → open thread → `0`; header badge reads `unreadCount` from `/api/auth/me` |
| Email normalization | Register/login lowercase+trim; invalid format → 400 (code + typecheck; no live auth probe this round) |

Final state of this round: `npm test` **30 passed, 0 failed** · `npx tsc --noEmit` clean · `npm run build` compiled successfully.

## Third pass (design system)

Skills loaded and followed: `bundled:taste` (anti-template constraints),
`bundled:browser-app-delivery` (runnable handoff), `bundled:durable-test-collateral`
(failing-first tests for the design changes). Changes: motion tokens +
shared controls in `globals.css` (verified in compiled CSS output, including
token-driven transitions on `.btn-primary`), task-first feed header
(compact H1, attributed research line, primary List CTA), shared-button
header with active-nav state, 40px card targets (redundant FREE badge
removed — the price pill already says FREE), dialog focus in/out for Baan,
sticky mobile listing actions, labelled filter/agent inputs.

Final state: `npm test` **33 passed, 0 failed** · `npx tsc --noEmit` clean ·
`npm run build` compiled successfully. Browser-runner probe
(`command -v chromium`) exited 1 — no browser is available in this sandbox,
so **no screenshot/live-browser verification was performed**; motion feel,
responsive layout, and dialog focus behaviour in a real browser remain
unverified and should be checked on the user's machine via the README demo.

## Fourth pass (AI reliability hardening, goal continuation)

| Change | Evidence |
|---|---|
| Meta/Replicate calls time-bounded (45s Muse Image, 30s fallback + Spark, 20s Replicate) with labelled fallback on timeout | Durable test + `tsc`/build green; timeout falls through to the existing provider chain, never hangs |
| Per-user rate limits: 10 generations/min, 20 agent turns/min → `429` + `Retry-After` | Direct limiter probe: 10 of 12 allowed, 13th blocked (retryAfter 58s), other user unaffected, allowed again after the window |

Final state: `npm test` **35 passed, 0 failed** · `npx tsc --noEmit` clean · `npm run build` compiled successfully.

## Fifth pass (full-journey probe)

A scripted probe drove the **real route handlers + database** through the
complete core journey with two fresh accounts (Meta keys blanked so the AI
ran its labelled local fallbacks deterministically):

register (bad email → 400; messy email normalized to lowercase) → seller
creates a pinned listing → buyer finds it in a located feed (0.04 km) →
favourite + cart (own-listing add → 400) → buyer chats, seller inbox shows
unread 1 → seller opens, unread 0 → pay-at-pickup checkout (order created,
total correct, listing `reserved`, disappears from feed, empty-cart re-check
→ 400) → Baan recommends 4 in-preference listings and drafts a sell listing
("Pine dresser", condition `fair`) → AI generate returns 200 via
`mock-canvas` with exactly 1 credit charged and the generation stored.
All probe accounts/listings/orders were deleted afterwards.

Final state: `npm test` **35 passed, 0 failed** · `tsc` clean · build compiled.

## Sixth pass (completion-audit gaps)

| Gap (from auditing the original brief) | Fix + evidence |
|---|---|
| "Same building" was never called out, though it is the app's headline promise | Cards label items ≤80 m "Same building"; listing detail shows same-building / metres / km — probed: at-pin `distanceKm 0.000, sameBuilding true`, far `93.1 km, false`, no coords `null` |
| Public listing-detail API selected the seller's **email** | Removed from the Prisma select — probed seller keys are now `id,name,building,createdAt`, no email |
| Ops readiness | `GET /api/health` (DB + provider-configured booleans, no key material — probed, `mode: meta`, no leak) wired as the Docker healthcheck; `npm run verify` = tests + types + build |

Final state: `npm test` **38 passed, 0 failed** · `npm run verify` (incl. build) green.

## Seventh pass (context-aware Baan)

Listing pages gained **Ask Baan about this item**: the question is built from
the item's title, price, condition, size, and distance/same-building state,
handed to the widget via `movealong:open-agent` + a sessionStorage/event
prefill (`movealong:agentPrefill`), and lands in the composer in Recommend
mode — no retyping. Verified by durable test + build (browser click-through
still sandbox-blocked). Final state: `npm test` **39 passed, 0 failed**.

## Eighth pass (far-away demo safety)

A judge outside Bangkok previously hit an empty feed (all seed listings are
pinned there; the 20 km default filtered everything out). The feed now
detects an empty located result with no other filters active and widens to
everywhere — still nearest-first — under a "Nothing within X km of you yet"
banner with a List-an-item CTA. Probed from New York coordinates: 20 km → 0
listings; widened → 8 listings, nearest 13,930 km. Final state: `npm test`
**40 passed, 0 failed**, build green.

## Ninth pass (reported UX issues A–D + hackathon verification)

Official pages fetched (dev.meta.ai event + Cerebral Valley): track-based
qualitative judging confirmed; the supplied 30/25/20/25 weights do **not**
appear there — conflict recorded in docs/hackathon.md, waiver JS-gated.

| Issue | Fix | Evidence |
|---|---|---|
| A. Card/shop text overlaps | Max 2 overlay pills (category moved to meta row), shared bottom row for urgency/distance, truncation everywhere, long shop names break safely | Durable test A + build |
| B. Assistant too small | Expand toggle (430→720px, animated), mobile full-screen with safe areas, FAB hidden while open on mobile, 40px close target | Durable test B + build |
| C. Filter noise | Essentials (search/FREE/Filters) always visible; category/building/distance behind disclosure; applied chips removable; Reset all + clear-filters recovery | Durable test C + build |
| D. Agent page history cramped | Full-height workspace (`100dvh` sizing, composer always visible), 52vh cap removed, reader-friendly stick-to-bottom with "New messages ↓" jump | Durable test D + build |

Final state: `npm test` **45 passed, 0 failed** · `npm run verify` green ·
lint warnings only (intentional `<img>`). Browser/screenshot verification
remains sandbox-blocked (no ports/browser) — layout logic is source-tested,
not visually confirmed.

## Not verified / remaining

- Live browser flows (click-through, responsive screenshots, console errors)
  — needs a machine where the dev server can bind a port; run the README
  demo walkthrough there.
- Meta API behaviour with the *user's* production key/quota (probe used the
  configured key once successfully; rate limits untested).
- Real payments, push/email alerts, native mobile wrappers — mocked or
  documented-only, by design (see README "real vs mocked").
- Accessibility: focus ring, skip link, aria roles, reduced-motion are in
  code and source-tested; no screen-reader or contrast-tool pass was run.
