# Design decisions & tradeoffs

## Design system (third pass)

Direction in five words: **warm, neighbourly, matter-of-fact, quick, honest.**
Task-first screens (the feed H1 is a plain description at 24px, not a
marketing hero; third-party research stats are one attributed line, not a
card grid). Shared system in `globals.css`: motion tokens (`--dur-fast/med/
slow`, `--ease-out/in` — every animation uses them), shared controls
(`.btn-primary/.btn-dark/.btn-secondary/.btn-ghost/.input/.input-pill/.card`),
one press/hover language, and a single focus ring. Navigation shows where
you are (`aria-current` + tinted pill, desktop and mobile). Card actions are
40px touch targets; the agent dialog moves focus in on open and returns it
to Baan on close; listing pages get sticky mobile Preview/Chat actions that
leave room for Baan. Deliberately not done: dark mode, new fonts (system
stack reads native and fast), heavier shadows, or scroll-triggered motion.

## Identity

**Warm, credible, home-like.** Terracotta/stone palette, real room/product
photography, no gradients/glows. The product is about homes in transition, so
the UI borrows apartment materials (warm white, clay, stone) rather than
fintech black or AI-purple. Motion exists only to confirm an action or a
state change (press, pop, panel in/out, shimmer while loading), all gated by
`prefers-reduced-motion`.

**Baan, the home-buddy agent.** The concierge is a small house character
(pure SVG, floats/blinks/waves at bottom-right) instead of a generic chat
bubble. Rationale: the agent's jobs are all home jobs (style my room, sell my
stuff, reply to a buyer). Risk — mascot fatigue — is mitigated by: nudges
stop after first interaction, three close paths, and the character never
blocks the composer.

## Prioritization (P0 → P3) for this round

| Priority | Item | Why | Status |
|---|---|---|---|
| P0 | My-listings matched by seller **id**, not name | Wrong listings shown when names collide; core seller journey | Done (+ live probe) |
| P0 | Feed failure ≠ empty state | A network/API failure rendered as "no items" — misleading, unrecoverable | Done (error + Retry) |
| P1 | Lazy/async images, visible `:focus-visible`, skip link, `aria-modal` | Performance + keyboard users on the busiest surface (feed) | Done |
| P1 | Agent modes (Recommend/Sell/Reply) + draft carries photos | The agent's highest-value flows were hidden behind prompt wording | Done (previous round, regression-tested) |
| P2 | Ratings, payments, push | Need real accounts/money/infra; mock versions would mislead judges | Deferred, documented |
| P3 | More animation | Current set already covers feedback/loading/state; restraint kept | By design |

## AI honesty rules (product-level)

1. The agent may only recommend listings the server filtered into the
   candidate set (distance/budget/category) — the model cannot invent stock.
2. Sell drafts never invent dimensions; condition comes from the user.
3. Every AI answer is labelled by provider (`Muse Spark` vs offline local
   agent; `meta-muse` vs instant composite). Fallbacks are a feature to
   disclose, not a trick.
4. Publishing is always a human click. The agent fills; the user decides.

## Data & safety defaults

- Pay-at-pickup is the recommended checkout; card is explicitly mocked.
- Second-hand is as-is/no-returns, stated at checkout — not buried.
- Public seller pages expose no email/phone/password material; phone is
  labelled private in profile.
- Secrets live only in `.env` (git-ignored); `.env.example` ships blank.

## Known tradeoffs

- SQLite + JS-side filtering keeps the demo one-command runnable; Postgres +
  geo indexing is the documented scale path, not this round's work.
- Photos stored as data URLs capped ~2MB keep zero-config; S3/R2 is the
  production path (README production checklist).
- Chat/agent history sync uses a window event + shared server rows (simple,
  works across the two surfaces in one tab) — not websockets.
