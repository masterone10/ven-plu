# VEN+ — Foundation Build (Work Item 0)

The audit found no existing VEN+ code in this project: it is a stock Lovable TanStack Start
template (single template commit, no database, no auth, no business code, no tests). The
Master Prompt's "do not rebuild" and "preserve historical phases" rules cannot bind here —
Phases 01–05 do not exist in this repository. So this plan builds the foundation the later
Work Items depend on, then follows the contract's Work Item order (§61) unchanged.

Per your answer, the first slice after the database schema is Auth + accounts + points ledger.

## Two stack decisions that need your acknowledgement

The contract says the repository controls the technology stack (§43). The repository is
TanStack Start on Lovable Cloud (Postgres + Cloud Auth), so:

1. **Passwords and sessions.** §30/§31 name Argon2id and server-managed session cookies.
   Lovable Cloud Auth handles hashing (bcrypt), email verification, password reset with
   expiring single-use tokens, and Google sign-in as managed infrastructure — we do not
   hand-roll password storage or session tables. Security intent (never plaintext, expiring
   single-use reset tokens, no secrets in logs, enumeration-safe responses) is preserved.
2. **Authorization.** Server-side only, via a separate `user_roles` table plus a
   `has_role()` security-definer function and row-level policies — never a role column on
   profiles, never a client-supplied role or admin flag.

Everything else in the canonical contract is implemented as written. Funding modes are
**CASH_ONLY and POINTS_ONLY only — MIXED is removed** and will not appear in any enum, schema,
validation, server function, checkout logic, test, or UI. Product payment method and shipping
payment method stay independently modelled (CASH | POINTS). Points rules as established:
purchase points awarded only when the order reaches DELIVERED, never for cancelled orders;
referral reward is 50 points, awarded once on the referee's first DELIVERED order. Also as
written: points ledger, points shipping, free-shipping points threshold, order snapshots,
idempotency.


## Scope of this work item

### 1. Enable Lovable Cloud
Provisions Postgres, auth, and storage. No business logic yet.

### 2. Canonical schema (one migration, schema only — no seeding through tools)
- `profiles` (account, phone, locale, referral code, referred_by — immutable attribution)
- `user_roles` + `app_role` enum (CUSTOMER, ADMIN) + `has_role()`
- `categories`, `products`, `product_variants`, `product_images`
  - cash price, `points_enabled`, `default_points_price`, variant `points_price` override,
    variant-level stock, `delivery_points_reward`
- `points_transactions` — immutable ledger, integer deltas, semantic types
  (EARN_PURCHASE, EARN_REFERRAL, REDEEM_PRODUCT, REDEEM_SHIPPING,
  REFUND_PRODUCT_REDEMPTION, REFUND_SHIPPING_REDEMPTION, ADJUSTMENT_CREDIT,
  ADJUSTMENT_DEBIT), order reference, idempotency key with a unique constraint
- `points_balances` — balance derived from and kept in step with the ledger, never
  overwritten directly; a DB constraint forbids negative balances
- `store_settings` — GLOBAL_SHIPPING_PRICE, SHIPPING_POINTS_PRICE,
  FREE_SHIPPING_POINTS_THRESHOLD, EXPECTED_DELIVERY_DURATION
- `carts` / `cart_items`, `orders` / `order_items` with `order_funding_mode` enum
  (`CASH_ONLY`, `POINTS_ONLY` — no MIXED value), per-item `product_payment_method`,
  order-level `shipping_payment_method`, snapshot columns, `idempotency_key` unique,
  lifecycle status enum

- GRANTs for every table, RLS enabled, owner-scoped policies plus admin policies via
  `has_role()`; catalog gets narrow public read policies

### 3. Auth + accounts
- `/auth` — register, login, forgot password, email verification, Google sign-in
  (Lovable-brokered), enumeration-safe messaging, Arabic/English labels
- Protected `_authenticated` subtree for account pages
- Profile creation on signup with referral code assignment; referral code accepted only at
  registration, self-referral rejected, attribution immutable afterwards
- Account page: profile, points balance, points ledger history, referral code to share

### 4. Points engine (server-authoritative)
Server functions, all validation server-side, integer arithmetic, ledger-first:
- read authoritative balance and ledger
- credit/debit helpers that write a ledger row and adjust the balance in one transaction,
  keyed by idempotency reference so retries are no-ops
- reject any debit that would go negative
- admin adjustment path (ADJUSTMENT_CREDIT / ADJUSTMENT_DEBIT), always ledgered
- delivery reward + referral reward hooks defined here, invoked by the order lifecycle in a
  later work item (award once on DELIVERED)

### 5. Shell and localisation baseline
Header/footer, EGP formatting, Arabic RTL + English LTR direction switching, dark mode
tokens defined in the design system (the full dark-mode work item stays at its contract
position), mobile-responsive layout.

### 6. Gate before Work Item 1
- Vitest set up; unit tests for points arithmetic, negative-balance rejection, idempotent
  credit/debit, self-referral rejection, role checks
- RLS checked with real signed-in calls: a customer cannot read another customer's orders,
  points, or profile; role cannot be escalated from a request body
- Grep proof that no `MIXED` token exists anywhere in schema, code, tests, or UI
- Before any completion claim, the report includes verbatim: migration output, test output,
  typecheck output, production build output, RLS verification results, and the Work Item 0
  report per §71
- Work Item 1 and later are not started until this gate passes


## Technical notes

- All business logic in `createServerFn` handlers (no Supabase Edge Functions), zod
  `inputValidator` on every input, explicit allowlists — no mass assignment.
- Prices, points prices, shipping amount, funding mode, stock, and balances are always
  loaded from the database server-side; client-submitted values are ignored.
- Checkout idempotency and atomic points+inventory mutation land in Work Item 1; this work
  item provides the primitives (unique idempotency keys, transactional ledger functions).
- No EGP-to-points conversion anywhere; points shipping uses the configured
  SHIPPING_POINTS_PRICE only.
- Nothing is deleted or weakened; there is no existing code to preserve.

## After this
Work Item 1 (cart + checkout UI + points), then §61's order: order retrieval, variant image
UX, admin product management, download package, admin order entry, dark mode, documentation,
final verification gate.
