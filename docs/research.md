# Research — comparators, user needs, and what we took from them

_Sources accessed 2026-11-05 (hackathon session). Firsthand = we opened/used the
product surface or its official docs. Secondary = guides/reviews describing it.
We did not run user interviews; anything about "users" below is either observed
product behaviour or a labelled hypothesis to validate._

## The problem (from the brief + codebase)

People moving out of apartments/condos/houses must get rid of furniture and
household items fast, often free. Buyers nearby want cheap, inspectable items
without shipping. The core job: **discover → trust → preview → meet & pay**.

## Comparators

### 1. Facebook Marketplace (firsthand pattern knowledge + official Help flows)

- **Audience/value:** everyone nearby; zero-fee local pickup is the default
  furniture workflow because buyers can inspect in person before paying.
- **Workflow:** photo-first listing → radius-based discovery → message → meet.
- **Strengths:** huge liquidity; listing creation is minutes; local-first.
- **Weaknesses for movers:** no moving deadline/urgency model, no "will it fit
  my room" help, feed mixes shipping spam with local items, trust is ratings-
  thin for new accounts.
- **Sources:** https://www.facebook.com/help/marketplace (Help Center flows);
  https://fluf.io/guides/how-to-use-facebook-marketplace/ (secondary walkthrough)

### 2. OfferUp (official Play listing + product descriptions)

- **Audience/value:** mobile-first local C2C; "list in 30 seconds" is the pitch.
- **Workflow:** snap photo → price → in-app chat → Community MeetUp Spots;
  profiles carry ratings, verification, response-time signals.
- **Strengths:** trust surfaces (ratings/profiles) Craigslist never built;
  meetup-spot safety pattern; extremely low listing friction.
- **Weaknesses:** US-only, ended nationwide shipping (2025) so purely local;
  still no room-fit visualization or mover-deadline tooling.
- **Sources:** https://play.google.com/store/apps/details?id=com.offerup
  (official listing, accessed 2026-11-05);
  https://www.voolist.com/blog/offerup-selling-guide-2026 (secondary, shipping change)

### 3. thredUp / resale-market data (secondary, already cited in-app)

- Online resale grew ~23% in 2024 (thredUp/GlobalData) — good items move fast,
  which is why speed features (saved-search alerts, urgency) matter.
- IKEA/Second-hand research: ~60% average saving vs new motivates the
  "- % vs new" price anchor shown on every card.
- **Sources:** thredUp Resale Report (GlobalData); IKEA UK second-hand study —
  figures are shown in the app with attribution and are **context, not our data**.

### 4. Meta Model API (official developer surface)

- Muse Image (`muse-image-1.0`) via `POST https://api.meta.ai/v1/responses`
  accepts multiple `input_image` references and returns composed imagery —
  the only Meta path that can fuse a room + product photos (Llama/Muse Spark
  are text/reasoning). Muse Spark (`muse-spark-1.3`) powers the concierge.
- **Constraint:** without a key, everything must still demo — hence our
  explicit, labelled local fallbacks (never silently fake "AI").
- **Source:** https://dev.meta.ai (Model API dashboard/docs; key required)

## Hackathon context (unverified — check the official page)

Secondary reports describe the Meta Global AI Developer Hackathon as building
with the Meta Model API (Muse Spark, Muse Image, SAM) and Muse Code, judged on
impact, use of Meta tools, technical depth, and the demo. **We could not fetch
the official rules document in this session, so treat this as a pointer, not
compliance.** Verify at the official sign-up/rules page before submitting.

## Top user jobs & frustrations (evidence → interpretation)

| Evidence | Interpretation |
|---|---|
| Marketplace/OfferUp both converge on photo-first, <1-min listing | Listing friction is the #1 drop-off; our agent sell-draft attacks exactly this |
| Both invest in meetup safety (spots, public-place guidance, ratings) | Stranger-meeting anxiety is the top trust barrier → our lobby/public-place prompts, pay-at-pickup default, as-is clarity |
| Resale growth + "good items go fast" | Buyers need speed: saved searches, must-go-by urgency, nearest-first ordering |
| Neither incumbent previews items in your room | Our differentiation: AI room preview + Baan concierge that only recommends real, in-budget, in-distance stock |

## Hypotheses (need real-user validation)

1. Movers will trade price for speed when a deadline is visible (must-go-by).
2. A photo-first agent draft converts more casual sellers than a blank form.
3. Room preview reduces failed pickups (size/style mismatch discovered early).
4. Same-building discovery feels safer than same-city for first meetings.

## What we built vs deferred

**Now (evidence-backed):** seller-id correctness, feed failure≠empty, lazy
images, visible focus, pickup-safety language (already in detail/checkout),
agent modes, demo fallbacks labelled. **Deferred:** ratings/reviews (needs a
real transaction graph + moderation), payments (Stripe needs accounts/keys),
push notifications (needs infra), native apps (Capacitor path documented).
