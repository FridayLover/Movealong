# Feature audit (2026-11-05, second pass)

Status key: **working** (verified by test/probe) · **partial** · **mocked**
(labelled as such in UI) · **unverified** (code exists, not exercised here).
Recommendations consider only the core journey: discover → trust → preview →
meet & pay.

| Feature | Where | Status | Issues found | Recommendation |
|---|---|---|---|---|
| Feed + filters/sort/saved searches | `/` | working | Failure rendered as "0 items" (fixed: error + Retry); coordinate-less listings were **hidden** from located buyers (fixed: sort last, distance null) | Keep; next: saved-search alerts stay counts-only (no push infra) |
| Map discovery | `/map` | working (code-tested) | Pins need coords — sellers without a pin are feed-visible now but map-invisible (by nature) | Keep; Sell nudges pin via building search |
| Listing detail | `/listing/[id]` | working | Bundle/trust blocks depend on seller stats queries | Keep |
| Sell flow | `/sell` + POST `/api/listings` | working | Server validates required fields/photos; coords come from place search or GPS | Keep; duplicate-submit guarded by disabled state |
| Favorites & cart | header/profile/AI Lab | working | Own-listing cart guarded server-side (verified earlier) | Keep |
| Checkout | profile cart + POST `/api/checkout` | working | Transaction reserves listings, 409s unavailable, blocks self-buy; card is **mocked** and labelled | Keep; Stripe = deferred (needs account) |
| Chat | `/chat`, `/api/conversations*` | working | **No unread state existed** (fixed this round: `readAt`, inbox + header badges, read-on-open); no realtime push — refresh on open/send | Keep; websockets deferred |
| AI room preview | `/ai-lab`, `/api/ai/generate` | working | Credits charge per scene incl. fallback composite (disclosed); stale ids pruned (fixed earlier) | Keep |
| Baan agent (Muse Spark) | widget + `/agent` | working | **History froze at oldest 50** after ~25 exchanges (fixed: latest-50 window); modes/photo intents verified | Keep |
| Seller storefront | `/seller/[id]`, profile | working | My-listings matched by **name** (fixed earlier: seller id) | Keep |
| Saved rooms/generations | profile, AI Lab | working | History cards restored after refresh (fixed earlier) | Keep |
| Auth | `/auth`, `/api/auth/*` | working | Email case variants could split accounts (fixed: normalize register+login, format check) | Keep |
| Credits/subscriptions | `/credits` | mocked (labelled) | Mock purchase by design | Defer real billing |
| Research stat cards | feed | partial | Third-party figures (thredUp/IKEA) shown with attribution; **context, not product data** | Keep, already labelled |

## Removed / simplified

Nothing removed. Two documentation fixes: the README claimed a
`/api/messages/unread` endpoint that never existed (corrected to the real
conversation APIs), and the seed description claimed picsum images (actually
Unsplash).

## Deferred (with reason)

Ratings/reviews (needs real transaction volume + moderation), real payments
(Stripe account/keys), push/email alerts (infrastructure), realtime chat
(websockets), native apps (Capacitor path already documented).
