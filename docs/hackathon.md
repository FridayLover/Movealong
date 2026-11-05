# Hackathon — verified facts, rubric map, demo script

## What the official pages actually say (fetched 2026-11-05)

Sources:
- https://dev.meta.ai/events/global-hackathon (Meta, official)
- https://cerebralvalley.ai/e/meta-ai-developer-hackathon (organizer)
- https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver — **JS-gated; only a loading shell was readable, so waiver terms are NOT verified here. Read them logged-in before submitting.**

Verified from those pages:
- Two tracks. **Indie:** "Judged on creativity, technical ambition, and whether it works." **Startup:** "Judged on technical execution and whether it holds up in production."
- Themes: **Build for Your World** (a problem you know firsthand) and **Push the Frontier**. MoveAlong is Build for Your World.
- Build with Muse Spark series, Muse Image, SAM 3.1 via the Meta Model API (plus open weights / Muse Code).
- Timeline shown: applications Oct 13–25, hackathon Oct 26 – Nov 4, project submissions due Nov 4, 9:00 PM ET, judging Nov 4–8. **Recheck the live page — dates/details may have been updated after this fetch.**

⚠️ **Conflict to resolve before submitting:** the weighted baseline supplied
to this project (Impact 30% · Meta AI tooling 25% · Technical depth 20% ·
Demo 25%) does **not** appear on the official pages fetched above, which
state qualitative track criteria instead. Treat the weights as an unverified
working assumption; the map below satisfies both readings.

## Rubric-to-product map

| Criterion (supplied weights / official wording) | What MoveAlong demonstrates | Gap | Demo moment |
|---|---|---|---|
| Impact 30% / "solves a problem you know" | Movers must shed furniture fast; buyers nearby get inspected, pickup-only deals — same-building discovery, must-go-by urgency, FREE items | No real-user evidence yet; impact is argued, not measured | Feed widening + Same building label; a mover's deadline on cards |
| Meta AI tooling 25% / "build with the newest models" | **Muse Image** fuses room + product photos (style/identity-locked, publishable); **Muse Spark** concierge (Baan) with grounded recommendations, sell drafts from photos, chat drafts; timeouts + rate limits + labelled fallbacks | SAM 3.1 not used (no honest need found); live quality depends on user's key/quota | Generate a room scene, then Baan Sell mode from one photo |
| Technical depth 20% / "whether it works" | Full-stack Next.js + Prisma, transactional checkout, unread system, agent history sync, per-user rate limits, 45-test suite, `/api/health`, Docker healthcheck | SQLite demo scale; card payments mocked | `npm run verify` green; health endpoint |
| Demo 25% / "creativity + it works" | One story (below) runs end-to-end on seeded data with or without a Meta key | No recorded video yet (record on a real machine) | The 3-minute script below |

## Demo script (≈3 minutes, seeded data)

Starting state: `docker compose up --build` (seeds automatically), log in
`demo@movealong.test / 123456`.

1. **Problem (0:00)** — "When you move out, the sofa has to go this week.
   Shipping kills second-hand furniture. MoveAlong is pickup-only, by
   building and distance." Feed: nearest-first, −% vs new, must-go-by,
   Same building labels. Open **Filters** — advanced filters tuck away;
   applied ones show as chips.
2. **See it in your room (0:40)** — AI Room → saved room → 2 items →
   Generate. With a key: photoreal Muse Image that must keep your room
   and the exact products. Without: instant composite, labelled.
3. **Baan sells for you (1:30)** — tap Baan (bottom-right; expand it).
   **Sell mode** → attach a photo, pick condition → draft → *Use this
   draft* → Sell opens prefilled *with your photos*. You click Publish.
4. **Baan buys with you (2:15)** — any listing → **Ask Baan about this
   item** → he answers grounded in that item's real price/size/distance.
5. **Close the loop (2:45)** — chat the seller (unread badges), checkout
   pay-at-pickup (recommended), item reserved. "AI fills and suggests;
   humans decide and publish."

**Recovery if live AI fails:** everything above still works — generation
falls back to the labelled instant composite and Baan to the labelled local
concierge (same grounded candidate set). Say so out loud; the honesty is
part of the product.

**Representative-task check (internal, n=1 scripted run, not user data):**
register → list → discover → favourite/cart → chat (unread 1→0) → checkout
→ agent recommend/sell → generate — all passed against the real handlers
and database (see docs/validation.md, fifth pass).
