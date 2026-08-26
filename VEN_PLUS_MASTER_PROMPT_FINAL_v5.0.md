# VEN+ / VENPLUS
# CANONICAL MASTER IMPLEMENTATION SPECIFICATION
# FINAL v5.0 — SINGLE EXECUTABLE CONTRACT

================================================================================
DOCUMENT STATUS
================================================================================

Status: FINAL
Version: 5.0.0
Project: VEN+
Document type: Canonical Master Implementation Specification
Execution target: Lovable or another coding agent operating on the existing VEN+ repository
Primary market: Egypt
Currency: EGP
Languages: Arabic + English
Arabic direction: RTL
English direction: LTR

This document is the single executable implementation contract for the existing VEN+
project. It is not a suggestion list, design memo, backlog note, or historical record.
It is the controlling contract for implementation, integration, testing, verification,
and completion.

================================================================================
0. ABSOLUTE EXECUTION DIRECTIVE
================================================================================

You are operating on an EXISTING VEN+ repository.

DO NOT rebuild the project from scratch.
DO NOT replace the existing architecture merely because another stack is preferred.
DO NOT silently migrate frameworks, ORMs, routers, authentication systems, or storage.
DO NOT delete working code merely to simplify implementation.
DO NOT delete tests to produce a green build.
DO NOT weaken security to make a feature easier to implement.
DO NOT invent business rules that are not explicitly defined in this contract.
DO NOT resurrect historical rules that this contract does not explicitly activate.
DO NOT infer authority from browser/client state for business-critical values.
DO NOT claim completion without actual verification.
DO NOT mark an item complete because the UI looks correct.
DO NOT begin a later work item while the current gate is failing.

The existing repository is the implementation starting point.
The contract in this file controls business behavior.
The repository controls the actual currently installed technology stack unless an
explicit business or security requirement in this contract requires a compatible
change.

================================================================================
0.1 SCOPE LOCK — CUSTOMER CHECKOUT VS ADMIN ORDER ENTRY
================================================================================

CRITICAL SCOPE RULE:
The customer-facing Checkout and the Admin Order Entry workspace are TWO DISTINCT
interfaces. A UI, field, address-model, copy, layout, or workflow decision made for
Customer Checkout MUST NOT be automatically propagated to Admin Order Entry.

The recently approved customer-order changes apply ONLY to the normal customer
storefront Checkout flow, including:
- Full Name
- Primary Phone
- Secondary Phone
- WhatsApp Number
- checkbox indicating WhatsApp is the same as the primary phone
- Full Address as ONE free-form textarea
- customer-facing product/payment/shipping/points presentation
- responsive/mobile behavior of the customer Checkout

ADMIN ORDER ENTRY remains governed by its own existing Admin Order Entry contract in
this document. Do not redesign, rename, remove, or add Admin Order Entry fields merely
because the customer Checkout fields were changed.

Do not infer that a customer Checkout UX change is an Admin UX change.
Do not infer that an Admin workflow requirement is a Customer Checkout requirement.
When a rule is interface-specific, its scope must remain limited to that interface.

================================================================================
1. PRECEDENCE / CONFLICT RESOLUTION
================================================================================

When two instructions appear to conflict, use the following order:

1. This FINAL CANONICAL BINDING.
2. Explicit business rules in this document.
3. Explicit security rules in this document.
4. The current verified repository implementation, provided it does not contradict
   an explicit rule above.
5. Historical documentation only when this document explicitly activates it.
6. Historical examples, obsolete schemas, obsolete code, old prompts, screenshots,
   comments, generated text, and prior assumptions are non-authoritative.

If a historical rule conflicts with this document, the historical rule is NOT
implemented.

If a repository implementation conflicts with an explicit current rule, preserve as
much verified implementation as possible but modify the smallest necessary surface
to satisfy the current rule.

If a requirement materially affecting money, points, stock, authorization, security,
persistence, or order lifecycle is unspecified, DO NOT invent a business policy.
STOP the affected work item and report BLOCKED unless a later canonical section explicitly
resolves the ambiguity.

================================================================================
2. PROJECT IDENTITY AND PRODUCT MODEL
================================================================================

VEN+ is a production-grade e-commerce and order-operations platform.

Primary use cases:
- Product catalog and variants.
- Customer accounts.
- Cash and points purchasing.
- Mixed cash + points purchasing.
- Shipping payment by cash or points.
- Loyalty / points balance and ledger.
- Referral attribution and referral reward points.
- Inventory management at variant level.
- Customer order history.
- Manual order confirmation workflow.
- Admin product management.
- Product media management.
- Product export/download package.
- Admin order entry.
- Arabic/English localization.
- RTL/LTR support.
- Global light/dark mode.
- Security, auditability, idempotency, and operational verification.

Primary currency: EGP.

================================================================================
2.1 HISTORICAL IMPLEMENTATION PHASE REGISTRY — PRESERVE, DO NOT REBUILD
================================================================================

The project did not begin as an empty application. Multiple implementation phases were
completed before this FINAL contract. Their purpose here is to preserve continuity and
prevent the coding agent from rebuilding already-completed foundations.

PHASE 01 / FOUNDATION — HISTORICAL BASELINE
- Core repository/domain structure established.
- Database/domain boundaries and catalog foundations established.
- Existing project is to be continued, not replaced.

PHASE 02 / DOMAIN & INFRASTRUCTURE EVOLUTION — HISTORICAL BASELINE
- Catalog, category, variant, cart, checkout, inventory, points, referral, and
  infrastructure work progressed through the existing repository architecture.
- The implementation stack evolved during the project; therefore the actual current
  repository remains authoritative for technology choices.

PHASE 03 / AUTHENTICATION + AUTHORIZATION — COMPLETED CHECKPOINT
- Authentication/service boundaries established.
- Secure password handling established.
- Session handling established.
- CUSTOMER / ADMIN authorization established.
- Server-side middleware/guards established.
- Authorization and security tests were part of the verification process.

PHASE 04 / EMAIL VERIFICATION + PASSWORD RESET — COMPLETED CHECKPOINT
- Email verification flow implemented.
- Password reset flow implemented.
- Expiring/single-use reset tokens implemented.
- Enumeration protection requirements implemented/tested.

PHASE 05 / FINAL FOUNDATION VERIFICATION — COMPLETED CHECKPOINT
- Schema/index improvements were applied in the historical repository state.
- Historical catalog/category/search indexes included improvements such as category
  lookup and search-title indexes.
- Schema drift was checked in that checkpoint.
- Unit/integration/build verification was performed in multiple passes.

HISTORICAL VERIFICATION EVIDENCE
- Prior project work recorded multiple green verification checkpoints.
- One recorded checkpoint contained 104 passing tests across 6 test files and a
  successful production build.
- Other intermediate checkpoints included smaller targeted test suites during
  authentication, password reset, email verification, cart, points, referral,
  storefront, infrastructure, and security work.
- These numbers are historical evidence, NOT a substitute for current verification.

PRESERVATION RULE:
If the current repository still contains a verified implementation from these phases,
extend or repair it. Do NOT rebuild it solely because this document restates its status.

================================================================================
3. FINAL COMMERCIAL MODEL
================================================================================

The current commercial model supports three order funding modes:

ORDER_FUNDING_MODE:
- CASH_ONLY
- POINTS_ONLY
- MIXED

Product payment method:
- CASH
- POINTS

Shipping payment method:
- CASH
- POINTS

Conceptually:

PRODUCT_PAYMENT_METHOD = CASH | POINTS
SHIPPING_PAYMENT_METHOD = CASH | POINTS
ORDER_FUNDING_MODE = CASH_ONLY | POINTS_ONLY | MIXED

Do NOT use a single ambiguous payment-method field as the only source of truth for
an order containing independently payable product and shipping components.
Persist the explicit product and shipping payment methods in the order snapshot.

Cash means Cash on Delivery (COD) for customer checkout.

Points are an internal loyalty currency and are NEVER treated as real money.
They must never be exposed as EGP-equivalent cash in financial totals.

The client may display estimates, but the server is authoritative for:
- cash prices
- points prices
- shipping price
- points balance
- points eligibility
- funding mode
- discounts
- points redemption
- rewards
- stock
- totals

================================================================================
4. POINTS / LOYALTY — ACTIVE CANONICAL SYSTEM
================================================================================

The following are ACTIVE and MUST be implemented:

- pointsBalance
- PointsTransaction
- pointsPrice
- pointsEnabled
- defaultPointsPrice
- deliveryPointsReward
- POINTS_ONLY
- MIXED
- points redemption
- points shipping
- points reward
- referral reward points
- free shipping points threshold

The older Points requirements are no longer archival when explicitly referenced by
this document. They are executable requirements.

The application MUST NOT remove or disable these capabilities unless a future
version of this canonical contract explicitly supersedes them.

================================================================================
5. POINTS ACCOUNTING MODEL
================================================================================

The points balance is a derived business balance backed by an auditable ledger.

Use PointsTransaction as the source of accounting history.

A points mutation MUST be represented by an immutable transaction record rather than
by an unexplained direct overwrite of the user's balance.

Canonical semantic transaction types include:
- EARN_PURCHASE
- EARN_REFERRAL
- REDEEM_PRODUCT
- REDEEM_SHIPPING
- REFUND_PRODUCT_REDEMPTION
- REFUND_SHIPPING_REDEMPTION
- ADJUSTMENT_CREDIT
- ADJUSTMENT_DEBIT

The exact enum names may follow the repository's existing implementation, but the
semantic meaning MUST remain equivalent.

Every points mutation must have:
- user/account identifier
- signed points delta
- transaction type
- source/reference where applicable
- related order identifier where applicable
- idempotency/reference key where applicable
- creation timestamp

Negative balances are forbidden unless a future explicit business rule says otherwise.

The server MUST reject any redemption that would make the points balance negative.

Points arithmetic must be integer-based. No floating-point arithmetic for point
balances.

A direct administrative balance adjustment MUST also be ledgered and auditable.

================================================================================
6. POINTS REDEMPTION RULES
================================================================================

A customer may redeem points for a product only when:
1. The product is active.
2. The product has pointsEnabled = true.
3. The selected variant is active.
4. A valid points price exists for the product/variant.
5. The customer's authoritative points balance is sufficient.
6. Stock is sufficient.
7. The order passes all other checkout validations.

Variant-specific pointsPrice overrides product-level defaultPointsPrice when present.
If no variant-specific pointsPrice exists, the product defaultPointsPrice applies.

A product with pointsEnabled = false cannot be bought using points even if an old
points price exists in historical data.

Do not allow the browser to submit an arbitrary points price.

The server must load the authoritative product/variant points price from the database.

================================================================================
7. MIXED CASH + POINTS RULES
================================================================================

MIXED is an aggregate order funding mode. It is true when at least one payable component
across all order items and shipping uses CASH and at least one payable component uses
POINTS.

Each order item has its own product payment method; shipping has its own shipping payment
method. Item-level choices may differ.

CASH_ONLY:
- every payable component uses CASH.

POINTS_ONLY:
- every payable component uses POINTS and every Points component is eligible.

MIXED:
- at least one payable component uses CASH AND at least one payable component uses
  POINTS.

Do not interpret MIXED as partial-point payment against one individual product price.
The canonical model supports component selection, not partial cash/points splitting of
one product price.

================================================================================
8. SHIPPING / FREE SHIPPING BY POINTS
================================================================================

There is ONE GLOBAL shipping price.

Admin-configurable values:
- GLOBAL_SHIPPING_PRICE
- FREE_SHIPPING_POINTS_THRESHOLD
- EXPECTED_DELIVERY_DURATION

The current shipping amount is snapshotted into the order at creation.
Subsequent admin shipping-price changes affect future orders only.

Shipping may be paid in one of two ways:
- CASH
- POINTS

FREE_SHIPPING_POINTS_THRESHOLD is the minimum authoritative customer points balance
required to unlock SHIPPING_PAYMENT_METHOD=POINTS. It is an eligibility threshold, not
a points debit.

When eligible, the exact shipping points debit MUST come from the persisted
SHIPPING_POINTS_PRICE configuration. That price may be zero when the existing business
configuration defines Points shipping as free.

Never invent an EGP-to-points conversion or derive shipping points from the cash shipping
price.
If the repository defines a non-zero shipping points price, use that authoritative
configuration.

NEVER calculate points shipping using an arbitrary EGP-to-points conversion.

================================================================================
9. POINTS EARNING / DELIVERY REWARD
================================================================================

Points earned for a completed purchase are credited only when the relevant order
reaches DELIVERED.

Purchase-earned points MUST NOT be granted merely because checkout succeeded.

The reward transaction must be idempotent:
- repeated DELIVERED processing must not double-credit points.

The system must record enough source information to prove why points were awarded.

The existing product/business configuration may define deliveryPointsReward or a
product-specific earning rule. Use the authoritative configured rule and do not
invent a monetary conversion.

Where a configured reward is attached to an order/product, compute it from the
server-side authoritative order snapshot and award it once on DELIVERED.

If an order is cancelled before DELIVERED, no delivery reward is granted.

If a delivered order is later administratively reversed, reverse points only through
an explicit, auditable compensation transaction; never silently rewrite history.

================================================================================
10. REFERRAL SYSTEM — ACTIVE
================================================================================

Referral code is an account/business concept.

Rules:
- Referral code is assigned only during registration.
- Referral attribution is immutable.
- Self-referral is rejected.
- If a user registers without a referral code, the referral code cannot be added later.
- Referral reward points are awarded upon the referee's first DELIVERED order.
- Referral reward = 50 points.

Referral reward MUST be idempotent.

The same referee may not generate the reward more than once for the same attribution.

The server must determine the referring account from persisted referral attribution.
The client must not be trusted to identify the recipient of the reward.

================================================================================
11. POINTS ROLLBACK / FAILURE / CANCELLATION POLICY
================================================================================

This section is mandatory because points are deducted before the order can become
DELIVERED.

When points are redeemed during successful checkout, the points deduction is part of
the same atomic transaction as order creation.

If the transaction fails, no points are consumed.

If an order containing redeemed points is later cancelled or otherwise voided before
fulfillment, the redeemed points must be returned through a compensating ledger
transaction.

The refund must be:
- exact
- idempotent
- auditable
- linked to the original order and original redemption transaction

Never edit the original ledger transaction to make the balance appear correct.
Create a compensating transaction.

If a customer refuses delivery, the points refund policy follows the same order
cancellation/refund business rule unless the admin explicitly records a non-refundable
customer refusal outcome. Because the current contract does not define a separate
forfeiture policy, the safe canonical default is to REFUND redeemed points when the
order is not completed and the business transaction is reversed.

Inventory and points recovery must be handled independently and according to their
respective lifecycle rules.

================================================================================
12. CHECKOUT — CANONICAL TRANSACTION
================================================================================

Checkout is a server-side transactional operation.

The server MUST:
1. Authenticate the customer.
2. Validate the idempotency key.
3. Load the authoritative cart.
4. Load authoritative active products and variants.
5. Validate product/variant active state.
6. Validate prices from the database.
7. Validate points prices from the database when applicable.
8. Validate stock.
9. Calculate authoritative subtotal.
10. Load current global shipping.
11. Validate shipping payment method.
12. Validate points balance and redemption eligibility.
13. Validate referral attribution if applicable.
14. Determine product payment method.
15. Determine shipping payment method.
16. Derive ORDER_FUNDING_MODE.
17. Calculate cash due.
18. Calculate points due.
19. Snapshot customer/contact information.
20. Snapshot address.
21. Snapshot order items.
22. Snapshot cash and points prices.
23. Snapshot shipping amount and payment method.
24. Atomically reserve/deduct stock according to the repository's existing safe
    inventory transaction pattern.
25. Atomically deduct points where applicable.
26. Create the order.
27. Create order items.
28. Create points transactions where applicable.
29. Persist the idempotency result.
30. Commit the transaction.
31. Return the authoritative order result.

If any required operation fails, the transaction must roll back completely.

No partial order is acceptable.

================================================================================
13. CHECKOUT IDEMPOTENCY
================================================================================

Checkout MUST use an idempotency identity, such as:
- x-idempotency-key

Same authenticated customer + same logical request + same idempotency key must not
create multiple business effects.

A retry after network failure must not:
- create a duplicate order
- deduct points twice
- deduct stock twice
- create duplicate reward/redemption transactions

The idempotency record must be persisted safely enough to survive process restart.

Do not use client-side timestamps as an idempotency key.

================================================================================
14. ORDER LIFECYCLE
================================================================================

Primary lifecycle:
NONE → PENDING_CONFIRMATION → CONFIRMED → PROCESSING → SHIPPED → DELIVERED

Alternative operational terminal path:
SHIPPED → CUSTOMER_REFUSED

Cancellation is available only through valid service-layer transitions.

Every state transition MUST be:
- server authoritative
- validated
- auditable
- idempotent
- unauthorized transitions rejected

PENDING_CONFIRMATION is the initial state for customer-created orders.

Manual confirmation workflow is mandatory.

================================================================================
15. ORDER CONFIRMATION
================================================================================

Admin confirmation workflow must expose:
- customer identity
- primary phone
- secondary phone
- WhatsApp
- single-text full address
- products
- variants
- quantities
- cash prices
- points prices
- product payment methods
- shipping payment method
- points redeemed
- shipping
- total cash due
- total points due
- expected delivery duration

Phone/WhatsApp confirmation is manual.

Confirmation attempts must be tracked.

After three failed calls:
- DO NOT auto-cancel.
- Keep PENDING_CONFIRMATION.
- Show an operational warning.

An admin may then take an explicit valid action according to the service layer.

================================================================================
16. ORDER SNAPSHOT / IMMUTABILITY
================================================================================

Orders must preserve sufficient historical state independent of later product/account
changes.

Customer snapshot:
- name
- primary phone
- secondary phone
- WhatsApp

Address snapshot:
- fullAddress

Commercial snapshot:
- subtotal
- shipping amount
- total cash due
- total points due
- order funding mode
- product payment method
- shipping payment method
- points redeemed for product
- points redeemed for shipping

Order-item snapshot:
- product ID
- variant ID
- product name
- variant attributes
- SKU
- unit price
- points price used
- quantity
- line total

Historical order data must not silently change if the product is edited later.

================================================================================
17. INVENTORY
================================================================================

Authoritative stock source:
ProductVariant.stock

Inventory deduction MUST be atomic and conditional.

Expected behavior:
- If stock is insufficient, checkout fails safely.
- Failed stock deduction rolls back.
- Cancellation before shipment restores the exact deducted quantity.
- CUSTOMER_REFUSED does NOT automatically restore stock unless an explicit valid
  inventory restoration action is performed by the business workflow.

Never trust browser-submitted stock values.

Never decrement stock with a read-then-write race that can oversell under concurrency.

Use a transactional conditional update or equivalent concurrency-safe mechanism.

================================================================================
18. CART
================================================================================

The cart is server-authoritative.

Client state may mirror cart data for UI presentation only.

localStorage is never the authority for:
- price
- points price
- stock
- quantity limits
- payment eligibility
- totals

Cart validation occurs again at checkout.

Any stale cart condition must be detected and rejected safely.

================================================================================
19. CUSTOMER ORDER RETRIEVAL
================================================================================

Preserve/implement:
- GET /api/account/orders
- GET /api/account/orders/[id]

Authenticated customers only.

Authorization MUST verify ownership server-side.

No IDOR.

Customers cannot read another customer's order using predictable IDs.

================================================================================
20. PRODUCT DOMAIN
================================================================================

Product inventory exists only at ProductVariant level.

Product SHOULD support at minimum:
- id
- title/localized title
- description/localized description
- categoryId
- basePrice
- pointsEnabled
- defaultPointsPrice
- specifications
- isActive

ProductVariant SHOULD support at minimum:
- id
- productId
- SKU
- optional cash price override
- optional pointsPrice override
- stock
- structured attributes
- active state

Server-side schemas must validate all writes.

================================================================================
21. PRODUCT PRICING
================================================================================

Cash price and points price are independent values.

Cash price cannot be derived from points price.
Points price cannot be derived from cash price without an explicit business rule.

Variant-level cash price overrides product-level/base price when defined.
Variant-level pointsPrice overrides product-level defaultPointsPrice when defined.

The server decides the effective price.

BUSINESS EXAMPLE — PRODUCT-SPECIFIC POINTS
Example only; this is NOT an EGP-to-points conversion:
- Product A may cost 1500 EGP and have a configured delivery reward of 50 points.
- Product B may also cost 1500 EGP and have a configured delivery reward of 25 points.
Therefore cash price does not determine reward points mathematically.

FEATURED PRODUCTS
Where the existing repository supports a featured-product flag, preserve it as an
explicit catalog/business field and admin control. Do not invent an "Offers" system
unless a future canonical version explicitly defines it.

Historical orders store the price actually used at checkout.

================================================================================
22. PRODUCT POINTS SETTINGS
================================================================================

Admin Add Product workspace MUST include:

01 INFORMATION
- title
- description
- category
- cash/base price
- active state
- Points Purchase Settings
  - Available for Points Purchase: ON/OFF
  - Default Points Price

02 MEDIA
03 VARIANTS
04 SPECIFICATIONS
05 REVIEW

The Visual Variant Builder must support pointsPrice per variant.

A variant points price must be rejected if the product's points-enabled business rule
makes the variant ineligible for points purchase.

================================================================================
23. PRODUCT IMAGES / VARIANT MEDIA
================================================================================

Admin-managed image capabilities include:
- id
- productId
- storage reference
- alt text
- display order
- primary flag

Variant-specific image mapping is REQUIRED.

When a customer selects a color/variant, the UI MUST display the actual images
associated with that variant.

Do NOT use:
- CSS hue rotation
- fake image tinting
- placeholder swapping that pretends to be real variant media

The displayed media must correspond to persisted variant/media relationships.

================================================================================
24. CATEGORIES
================================================================================

Category:
- id
- localized name
- slug
- isActive

Slug is unique.

Inactive categories cannot receive new products.

================================================================================
25. PRODUCT DOWNLOAD PACKAGE
================================================================================

Admin-only action:
"تحميل بيانات المنتج"

Generates:
Product-[SKU].zip

Package contents:
- product.json
- descriptions.json or equivalent localized description payload
- variants.json
- images/

No sensitive secrets or credentials may be included.

Package generation must validate authorization.

Any signed URL/storage access used for images must have appropriate expiration and
access control.

If a requested image is unavailable, package generation must fail predictably or
include an explicit missing-file manifest rather than silently creating corrupt data.

================================================================================
26. ADMIN ORDER ENTRY
================================================================================

Create a professional Admin Order Entry workspace.

Customer fields:
- full name
- primary phone
- secondary phone
- WhatsApp
- full address (single textarea)
- notes
- Product Search Field

DO NOT INCLUDE:
- Order Type
- Moderator Name
- Facebook Page
- Facebook Link
- Commission

Product lines:
- product
- variant
- cash price (server-authoritative)
- points price (server-authoritative)
- payment method for product: Cash / Points
- payment method for shipping: Cash / Points
- quantity
- subtotal
- color
- size
- remove

Capabilities:
- search and add multiple products
- select variants
- modify quantities
- remove lines
- server-side validation
- points eligibility validation
- stock validation

Totals:
- subtotal
- shipping
- total points due
- total cash due

Admin UI may preview totals, but the backend remains authoritative.

================================================================================
27. ADDRESS MODEL
================================================================================

ADDRESS SCOPE IS INTERFACE-SPECIFIC.

CUSTOMER CHECKOUT:
- Full Address is ONE uncontrolled free-form textarea named fullAddress.
- Do not split it into governorate/district/street/building/floor/apartment fields.

ADMIN ORDER ENTRY:
- This section does NOT redefine the Admin Order Entry address UI.
- Preserve the Admin Order Entry address contract already defined for the Admin panel.
- Do not propagate the Customer Checkout address change into Admin merely because both
  workflows create orders.

FOR BOTH FLOWS:
- Any address value persisted on an order must be sufficient to reconstruct the
  historical destination captured at order creation.
- No interface may silently introduce a new structured address requirement unless a
  future canonical contract explicitly changes that interface.

================================================================================
28. WHATSAPP ABSTRACTION
================================================================================

Use:
IWhatsAppConfirmationProvider

Initial provider:
ManualWhatsAppConfirmationProvider

The abstraction must permit future automated providers without coupling the domain
service to a specific provider implementation.

Do not place external WhatsApp secrets in frontend code.

================================================================================
29. AUTHENTICATION
================================================================================

Unified login.

Fields:
- email
- password

Support:
- registration
- login
- logout
- forgot password
- email verification
- password reset
- Google authentication

Roles:
- CUSTOMER
- ADMIN

Authorization is server-side.

UI hiding is never authorization.

================================================================================
30. PASSWORD SECURITY
================================================================================

Passwords MUST NEVER be stored in plaintext.

Preferred password hashing:
Argon2id

Reset tokens must:
- expire
- be single-use
- be stored safely
- not expose secrets in logs

Never log passwords, reset tokens, session secrets, or provider credentials.

================================================================================
31. SESSION SECURITY
================================================================================

Use secure server-managed sessions.

Production cookies:
- HttpOnly
- Secure
- SameSite

Session IDs must be cryptographically random.

Support expiration, invalidation, and rotation as appropriate.

Sensitive admin operations may require step-up authentication / MFA.

================================================================================
32. ACCOUNT ENUMERATION PROTECTION
================================================================================

Avoid distinguishable responses that reveal whether an email/account exists.

Password reset, registration, login, and verification flows must avoid unnecessary
account-existence leakage.

================================================================================
33. RATE LIMITING
================================================================================

Rate-limit abuse-prone endpoints including:
- login
- registration
- password reset
- verification
- sensitive admin endpoints
- other security-sensitive endpoints identified during audit

Do not implement arbitrary limits without checking the existing repository behavior,
but ensure meaningful anti-abuse protections exist.

================================================================================
34. RBAC / AUTHORIZATION / IDOR
================================================================================

Initial roles:
- CUSTOMER
- ADMIN

Every protected operation requires explicit server-side authorization.

Every resource accessed by ID must verify:
- authenticated subject
- ownership or admin permission
- resource scope

Never trust:
- hidden UI controls
- submitted user IDs
- submitted role IDs
- submitted admin flags
- submitted ownership fields

================================================================================
35. MASS ASSIGNMENT PROTECTION
================================================================================

Never bind arbitrary request bodies directly into database create/update calls.

Use explicit allowlists and Zod validation schemas.

Client-controlled fields such as:
- role
- points balance
- stock
- price
- points price
- order status
- account ownership
- reward eligibility

must never be accepted as authoritative simply because they appear in a request body.

================================================================================
36. INPUT VALIDATION / INJECTION DEFENSE
================================================================================

Treat all user input as hostile until validated and authorized.

Protect against:
- SQL injection
- NoSQL injection if applicable
- XSS
- HTML injection
- command injection
- path traversal
- SSRF
- prototype pollution
- malicious JSON payloads
- file upload abuse
- ZIP path traversal
- Excel formula injection where exports/imports exist

Use parameterized queries / ORM APIs safely.

Do not use eval-like dynamic execution.

================================================================================
37. FILE / DOWNLOAD SECURITY
================================================================================

All uploaded or imported files are untrusted.

Validate:
- type
- size
- extension
- content signature where appropriate
- filename safety
- path safety

Prevent:
- path traversal
- arbitrary filesystem writes
- executable file upload where inappropriate
- decompression bombs / abusive archives
- ZIP Slip

Generated downloads must require appropriate authorization.

================================================================================
38. EXCEL IMPORT / EXPORT
================================================================================

Where Excel functionality exists:
- validate input rows
- validate headers
- validate data types
- validate business constraints
- reject or report invalid rows explicitly
- do not partially mutate the database when atomic import is required
- protect against formula injection
- never trust spreadsheet formulas as business values

Atomic import means all-or-nothing for the defined import unit.

================================================================================
39. SECURITY HEADERS / CSP
================================================================================

Implement an appropriately restrictive Content Security Policy (CSP).

Avoid:
- unsafe-eval
- unsafe-inline

unless a specific technical requirement is documented and minimized.

Implement appropriate HTTP security headers according to the deployment architecture.

================================================================================
40. WAF / DDOS / BOT DEFENSE
================================================================================

Production deployment SHOULD use:
- WAF
- DDoS protection
- bot/abuse mitigation

These are deployment-layer controls and must not be fabricated inside the application
when they are better enforced at the platform edge.

================================================================================
41. SECRET MANAGEMENT
================================================================================

NEVER store secrets in source code.

Use environment variables or a proper secret-management mechanism.

Never expose secrets to the browser unless a key is explicitly designed to be public.

Never include credentials in:
- generated ZIPs
- logs
- client bundles
- exported JSON
- error messages

================================================================================
42. DEPENDENCY / SUPPLY-CHAIN SECURITY
================================================================================

Lock dependency versions where appropriate.

Review dependency changes.

Run vulnerability checks where configured.

Do not install large replacement frameworks or duplicate libraries merely for
convenience.

Use the existing stack first.

================================================================================
43. DATABASE / ORM AUTHORITY
================================================================================

The database remains authoritative for business-critical data.

Do not assume Prisma, Drizzle, Next.js, Express, Vite, or any other framework solely
from historical documentation.

FIRST inspect the repository and detect:
- actual package.json
- actual build scripts
- actual runtime
- actual ORM
- actual database adapter
- actual auth implementation
- actual test setup
- actual app entrypoints

Then adapt implementation to the existing verified stack.

Never migrate frameworks silently.

================================================================================
44. CURRENT VERIFIED FOUNDATION PRESERVATION
================================================================================

The following classes of foundation are presumed valuable and should be preserved
when currently verified:
- database/domain foundation
- authentication/authorization
- email verification
- password reset
- catalog/product backend
- cart backend
- checkout backend
- inventory transaction logic

Before modifying a verified foundation, inspect its tests and dependencies.

Make the smallest safe change necessary.

================================================================================
45. REPOSITORY AUDIT PROTOCOL
================================================================================

Before modifying any implementation:

PHASE A — READ
- inspect repository structure
- inspect package.json
- inspect scripts
- inspect database/schema
- inspect existing repositories/services/controllers/routes
- inspect frontend pages/components
- inspect tests
- inspect environment/configuration

PHASE B — AUDIT
Produce an internal implementation map:
- actual stack
- actual modules
- actual persistence
- actual feature status
- known drift
- missing pieces
- failing tests/build
- risk areas

PHASE C — PLAN
Map current business requirement → existing module → smallest safe change.

PHASE D — IMPLEMENT
Implement only the approved work item.

PHASE E — TEST
Run targeted tests first, then broader verification.

PHASE F — VERIFY
Check business behavior, persistence, auth, errors, idempotency, and UI integration.

PHASE G — DOCUMENT
Update implementation notes / work-item report.

PHASE H — GATE
Do not proceed if acceptance criteria fail.

PHASE I — STOP
Stop exactly when the work item is verified or blocked.

================================================================================
46. ARCHITECTURE DRIFT RULE
================================================================================

If repository architecture differs from historical documentation:

1. Treat the actual repository as the starting architecture.
2. Do not migrate solely to match historical architecture.
3. Determine whether the current implementation can satisfy the canonical business
   requirements safely.
4. If yes, extend it.
5. If a migration is genuinely unavoidable, report it before applying it and explain
   the minimum required change.

Never perform a silent Next.js migration.
Never perform a silent Prisma migration.
Never perform a silent Drizzle replacement.
Never perform a silent Express/Vite replacement.

================================================================================
47. API / DOMAIN CONTRACT PRINCIPLES
================================================================================

API handlers must remain thin.

Business logic belongs in domain/service layers where applicable.

Validation belongs at the boundary and must be repeated server-side for critical
business operations.

Persistence operations must be transactional where required.

Never trust a client-computed subtotal, shipping amount, points balance, stock count,
role, or order status.

================================================================================
48. ERROR CONTRACT
================================================================================

Errors must be:
- deterministic enough for clients to handle
- non-leaking of secrets/internal implementation details
- mapped to appropriate HTTP status semantics
- validated at the server boundary

Do not expose stack traces in production responses.

Business rule failures must not leave partial mutations.

================================================================================
49. OBSERVABILITY / AUDITABILITY
================================================================================

Log security/business events required for operations without logging secrets.

Important events include:
- login success/failure
- admin authentication/MFA events
- password reset lifecycle
- order creation
- order status transitions
- stock changes
- points redemptions
- points rewards
- points refunds
- referral rewards
- admin adjustments
- security failures

Logs must avoid sensitive credentials and unnecessary personal data.

When possible, use correlation/request identifiers for tracing.

================================================================================
50. BACKUP / DISASTER RECOVERY
================================================================================

Production backups must be:
- encrypted at rest
- access-controlled
- tested for restoration

Recovery procedures must be documented.

Do not claim disaster recovery readiness without an actual verifiable procedure.

================================================================================
51. LOCALIZATION / INTERNATIONALIZATION
================================================================================

Locales:
- ar
- en

Arabic:
- first-class
- RTL

English:
- LTR

Do not hard-code Arabic-only business UI where localization is required.

Product/customer-facing text should use localization mechanisms when they exist.

Date, number, and currency formatting must follow locale-aware presentation rules,
while the database preserves canonical numeric values.

Currency:
EGP

================================================================================
52. GLOBAL DARK MODE
================================================================================

Modes:
- LIGHT
- DARK

Requirements:
- global header toggle
- centralized theme state
- global application
- no component-by-component inconsistent theme switching
- persisted preference only where compatible with the existing app architecture

Do not break RTL/LTR or accessibility while implementing theme changes.

================================================================================
53. BRANDING
================================================================================

Brand:
Ven+

Primary orange:
#FF6B00

Secondary orange:
#F97316

Deep carbon:
#09090B

Soft background:
#FAFAFA

Preserve these canonical brand values unless the contract is explicitly superseded.

================================================================================
54. RESPONSIVE / MOBILE BEHAVIOR
================================================================================

The application must remain fully usable on desktop and mobile widths.

Required principles:
- responsive layouts
- touch-friendly controls
- readable forms
- usable tables on narrow screens
- horizontally scrollable data regions where needed rather than broken layouts
- checkout must be usable on mobile
- admin workflows must remain operational on tablet/mobile widths where practical

Do not treat responsiveness as optional visual polish.

================================================================================
55. ACCESSIBILITY / UX BASELINE
================================================================================

Use semantic controls where possible.

Interactive controls need:
- accessible names
- visible focus state
- keyboard usability
- readable contrast

Forms must expose validation errors clearly.

Destructive actions should require appropriate confirmation where accidental activation
would cause operational damage.

Do not hide business errors in console logs only.

================================================================================
56. ADMIN PRODUCT MANAGEMENT
================================================================================

Product list operational columns:
- Product
- Category
- Cash Price
- Points Availability
- Points Price
- Variant Count
- Total Stock
- Status
- Actions

Actions must respect authorization and server validation.

Do not derive stock totals from browser state.

================================================================================
57. ADMIN BOOTSTRAP / MFA
================================================================================

Admin bootstrap must be secure and deterministic.

Never ship plaintext admin credentials in source code.

If bootstrap credentials are configured through environment values, they must be
hashed/handled securely and must not be logged.

ADMIN accounts require MFA/2FA, preferably TOTP, and sensitive admin operations may
require step-up authentication.

================================================================================
58. SECURITY ACCEPTANCE MATRIX
================================================================================

Must include negative tests for at minimum:

AUTH:
- invalid login
- brute-force/rate-limit path
- reset token reuse
- expired reset token
- unverified account restrictions where applicable

AUTHORIZATION:
- customer accessing another customer's resource
- customer attempting admin endpoint
- forged role
- forged ownership

BUSINESS LOGIC:
- insufficient stock
- invalid variant
- inactive product
- invalid points price
- insufficient points
- duplicate idempotency request
- duplicate reward event
- duplicate referral reward
- cancellation refund duplication
- invalid order transition

INJECTION:
- malicious text
- path traversal
- SSRF candidates
- unsafe file types
- formula injection where Excel is involved

ADMIN:
- unauthorized product mutation
- unauthorized points balance modification
- unauthorized stock modification
- unauthorized download

================================================================================
59. TEST STRATEGY
================================================================================

Tests are part of implementation, not a final cosmetic step.

Use the repository's actual test stack.

Required categories:
- unit tests
- integration tests
- domain/business tests
- persistence tests where configured
- API tests
- security tests
- E2E tests where configured

For points, tests MUST cover:
- earning
- redemption
- insufficient balance
- insufficient stock
- points + cash mixed mode
- shipping points
- free shipping threshold
- referral reward
- duplicate reward prevention
- cancellation/refund
- idempotent checkout
- delivered reward
- rollback on transaction failure

================================================================================
60. VERIFICATION COMMAND POLICY
================================================================================

Do NOT blindly run a framework-specific command that does not exist in the actual
repository.

Required verification categories:
- TypeScript/typecheck if applicable
- ORM/schema validation using the ACTUAL ORM
- unit/integration tests using the ACTUAL test runner
- production build
- E2E tests if configured
- lint/static analysis if configured

Examples from some historical repository states may include:
- npx tsc --noEmit
- npx prisma validate
- npx vitest run
- npm run build
- npx playwright test

But these are examples, not permission to install or introduce missing frameworks.

Use actual package.json scripts and installed dependencies as the source of truth.

================================================================================
61. WORK-ITEM ORDER — FINAL EXECUTION ORDER
================================================================================

Execute strictly in this order.
Do not start a later item while the current gate is failing.

WORK ITEM 1 — CART UI + CHECKOUT UI INTEGRATION + POINTS
WORK ITEM 2 — CUSTOMER ORDER RETRIEVAL
WORK ITEM 3 — VARIANT → REAL IMAGE UX
WORK ITEM 4 — ADVANCED ADMIN PRODUCT MANAGEMENT UI
WORK ITEM 5 — PRODUCT DOWNLOAD PACKAGE
WORK ITEM 6 — ADMIN ORDER ENTRY
WORK ITEM 7 — GLOBAL DARK MODE
WORK ITEM 8 — DOCUMENTATION RECONCILIATION
WORK ITEM 9 — FINAL SYSTEM VERIFICATION GATE

================================================================================
62. WORK ITEM 1 — ACCEPTANCE CRITERIA
================================================================================

Customer can:
- inspect cart
- see cash prices
- see points prices where available
- choose product payment method
- choose shipping payment method
- see authoritative totals
- see points balance
- see points required
- receive server-side validation errors
- complete Cash, Points, or Mixed checkout where eligible

Checkout MUST:
- validate all business rules server-side
- be idempotent
- persist order snapshot
- atomically handle points and inventory mutations
- avoid double effects on retry

Gate: all relevant tests pass and business scenarios are manually/automatically
verified.

================================================================================
63. WORK ITEM 2 — CUSTOMER ORDER RETRIEVAL
================================================================================

Customer order list and order detail must:
- require authentication
- enforce ownership
- show immutable historical values
- show cash/points composition
- show order status
- show shipping
- show products/variants

Gate: IDOR tests pass.

================================================================================
64. WORK ITEM 3 — VARIANT IMAGE UX
================================================================================

Selecting a variant/color must:
- update actual images
- update relevant metadata
- avoid fake hue rotation
- remain responsive

Gate: real persisted variant-media mapping verified.

================================================================================
65. WORK ITEM 4 — ADVANCED ADMIN PRODUCT MANAGEMENT
================================================================================

Admin can manage:
- product information
- media
- variants
- cash prices
- points prices
- pointsEnabled
- stock
- active status
- category

All writes are server-authorized and validated.

Gate: product mutation security tests pass.

================================================================================
66. WORK ITEM 5 — PRODUCT DOWNLOAD PACKAGE
================================================================================

Admin-only ZIP generation with:
- product.json
- descriptions
- variants.json
- images

Gate:
- authorization verified
- package integrity verified
- no secrets included

================================================================================
67. WORK ITEM 6 — ADMIN ORDER ENTRY
================================================================================

Admin can:
- search products
- add products
- select variants
- choose cash/points product payment
- choose cash/points shipping payment
- inspect points/cash totals
- create valid order through server-side rules

Admin-created orders must follow the same authoritative domain invariants as customer
orders unless a specific admin-only rule explicitly exists.

================================================================================
68. WORK ITEM 7 — GLOBAL DARK MODE
================================================================================

Implement globally without introducing layout regressions.

Gate:
- light mode verified
- dark mode verified
- RTL verified
- key workflows verified

================================================================================
69. WORK ITEM 8 — DOCUMENTATION RECONCILIATION
================================================================================

Update implementation documentation so it does not contradict this final contract.

Remove obsolete business claims from active documentation.

Historical material may remain only when clearly marked as historical and non-executable.

================================================================================
70. WORK ITEM 9 — FINAL SYSTEM VERIFICATION GATE
================================================================================

Final verification requires:

1. Typecheck passes where applicable.
2. Unit/integration tests pass.
3. Security tests pass.
4. Build passes.
5. E2E tests pass where configured.
6. Database/schema validation passes using the actual ORM.
7. No unauthorized architecture migration occurred.
8. Points accounting verified.
9. Mixed payment verified.
10. Inventory concurrency verified.
11. Idempotency verified.
12. Order lifecycle verified.
13. Customer ownership verified.
14. Admin authorization verified.
15. Mobile/desktop critical flows verified.
16. Arabic RTL and English LTR verified.
17. Dark/light modes verified.
18. Product media variant mapping verified.
19. Download package verified.
20. Documentation reconciled.

Only after all of the above is the system eligible for FINAL verification status.

================================================================================
71. REQUIRED WORK-ITEM REPORT
================================================================================

Every work item must end with a report containing:

WORK ITEM:
STATUS: VERIFIED | BLOCKED

1. Scope implemented
2. Files/modules changed
3. Business rules implemented
4. Security considerations
5. Tests executed
6. Test result
7. Build result
8. Known limitations
9. Remaining blockers
10. Verification evidence
11. Final gate result

Never report VERIFIED when any material acceptance criterion is untested or failing.

================================================================================
72. NO SILENT COMPLETION
================================================================================

A feature is complete only when all are true:

- business behavior is correct
- validation is correct
- persistence is correct
- authorization is correct
- error handling is correct
- idempotency is correct where required
- tests pass
- build passes
- the feature works through its actual integration path

A component that merely renders is not a completed feature.

================================================================================
73. NO SILENT BUSINESS-RULE CHANGE
================================================================================

Examples of prohibited silent changes:
- removing Points
- removing MIXED
- changing referral reward
- changing free shipping rules
- changing address model
- changing order lifecycle
- changing points refund behavior
- changing product/variant pricing precedence
- changing shipping semantics
- changing security requirements

Any business-rule change requires a new canonical contract/version.

================================================================================
74. SERVER AUTHORITY MATRIX
================================================================================

AUTHORITATIVE SERVER VALUES:
- product cash price
- product points price
- variant price
- variant points price
- stock
- points balance
- shipping price
- points shipping eligibility
- free shipping threshold
- order totals
- order status
- referral attribution
- referral reward eligibility
- reward amounts
- inventory effects
- points effects

NON-AUTHORITATIVE CLIENT VALUES:
- displayed total
- displayed stock
- displayed points balance
- displayed price
- displayed shipping
- selected order status
- user role claim
- user ownership claim

The client submits intent; the server computes truth.

================================================================================
75. DATABASE INTEGRITY / TRANSACTION RULES
================================================================================

Business operations that mutate multiple related entities MUST use transactions
when atomicity is required.

Examples:
- checkout
- points redemption
- inventory deduction
- order creation
- refund of points
- reward creation

No mutation sequence may leave the database in a state where:
- order exists but points deduction is absent when it should exist
- points deducted but order absent
- stock deducted but order absent
- reward credited twice
- referral reward credited twice

================================================================================
76. CONCURRENCY
================================================================================

The implementation must account for concurrent requests.

Examples:
- two checkouts for the last unit
- two retries of the same checkout
- duplicate DELIVERED event
- duplicate referral reward attempt
- simultaneous admin stock changes
- simultaneous points redemption

Use database-level or transactional safeguards rather than relying solely on UI state.

================================================================================
77. DATA PRIVACY / MINIMIZATION
================================================================================

Collect only data required for the defined business flow.

Customer contact information is sensitive operational data.

Do not expose unnecessary customer information across endpoints.

Do not log full payment credentials because this model does not require them.

================================================================================
78. EMAIL / NOTIFICATIONS / REPORTING
================================================================================

Notification mechanisms must not become a source of duplicate business effects.

Daily Digest / Reports MUST include relevant Points/Loyalty metrics.

Notifications should reflect persisted state, not optimistic browser state.

================================================================================
79. API ACCEPTANCE CONTRACT
================================================================================

All implemented endpoints should have clear contracts for:
- auth requirements
- input schema
- output schema
- business errors
- authorization
- idempotency where relevant

Points-related endpoints must validate:
- customer identity
- points eligibility
- product/variant validity
- available balance
- order state where relevant

================================================================================
80. API DESIGN RULES
================================================================================

Do not expose internal database implementation details unnecessarily.

Do not allow generic "update any field" endpoints.

Use explicit command semantics for sensitive business mutations where practical.

================================================================================
81. CODE QUALITY RULES
================================================================================

Prefer:
- cohesive modules
- explicit types
- domain/service separation
- deterministic business functions
- small safe changes
- reusable validation
- testable units

Avoid:
- giant components containing business logic
- duplicated pricing calculations
- duplicate points calculations
- browser-only business rules
- magic numbers without configuration/source
- hidden side effects

================================================================================
82. UI BUSINESS LOGIC RULES
================================================================================

UI must reflect eligibility from server-provided data.

Examples:
- show Points option only when product is points-enabled
- show variant points price when applicable
- show insufficient-points warning
- show shipping points eligibility
- show cash/points totals separately

However, disabling a UI option does not replace server validation.

================================================================================
83. ADMIN UI RULES
================================================================================

Admin UI is operational software, not merely a storefront.

Prioritize:
- clear states
- server validation feedback
- confirmation before destructive actions
- searchable product workflows
- readable order information
- explicit cash/points totals
- audit-friendly actions

================================================================================
84. BUSINESS EDGE CASES
================================================================================

At minimum, handle safely:

1. Product becomes inactive after cart creation.
2. Variant becomes inactive after cart creation.
3. Price changes after cart creation.
4. Points price changes after cart creation.
5. Customer points balance changes before checkout.
6. Stock changes before checkout.
7. Shipping price changes before checkout.
8. Referral attribution exists but reward already granted.
9. Checkout retry arrives after prior success.
10. Checkout transaction fails after a temporary resource conflict.
11. Order cancelled after points redemption.
12. Duplicate DELIVERED processing.
13. Customer refuses shipment.
14. Admin attempts an invalid lifecycle transition.
15. Customer attempts another customer's order ID.
16. Product has no valid points price but pointsEnabled is true.
17. Variant-specific points price is invalid.
18. Free-shipping threshold is reached/lost around checkout timing.
19. Negative points result.
20. Negative stock result.

================================================================================
85. LEGACY / HISTORICAL MATERIAL POLICY
================================================================================

Historical material may be retained for traceability but is NOT executable unless
explicitly restated in this FINAL contract.

There is NO active requirement to preserve obsolete Points-disabled behavior.
Historical Points-disabled rules are non-executable and MUST NOT override this FINAL contract.

Current canonical rule:
Points are ACTIVE.
POINTS_ONLY is ACTIVE.
MIXED is ACTIVE.
Points redemption is ACTIVE.
Points shipping is ACTIVE.
Referral reward points are ACTIVE.

================================================================================
86. FINAL NON-NEGOTIABLE RULES
================================================================================

1. PostgreSQL/database is authoritative for business-critical data where applicable.
2. Browser/client state is never authoritative for business-critical values.
3. CASH_ON_DELIVERY, POINTS_REDEMPTION, and MIXED are current supported commercial modes.
4. Product and shipping payment methods are independently modeled.
5. Points/Loyalty are ACTIVE and executable.
6. Referral reward points are ACTIVE and executable.
7. Points earning occurs at DELIVERED for configured delivery rewards.
8. Points redemption is transactional and auditable.
9. Points refunds use compensating ledger transactions.
10. Points cannot become negative.
11. Checkout is transactional.
12. Checkout is idempotent.
13. Inventory side effects are concurrency-safe.
14. Order history uses immutable snapshots.
15. Order transitions are server-authoritative.
16. Customer ownership is verified server-side.
17. Admin authorization is server-side.
18. IDOR is prohibited.
19. Mass assignment is prohibited.
20. User input is hostile until validated and authorized.
21. Injection defenses are mandatory.
22. File and Excel inputs are untrusted.
23. Secrets never belong in source code or logs.
24. Admin MFA/step-up authentication is required as defined.
25. No silent architecture migration.
26. No silent business-rule change.
27. No test deletion to create a green build.
28. No claim of completion without verification.
29. No next work item before the current gate passes.
30. Preserve verified foundations.
31. Make the smallest safe change necessary.
32. Production readiness is a verification result, not a visual judgment.
33. Checkout address is a single free-form text field.
34. Product cash price and product points price are independent.
35. Shipping price is independently payable by Cash or eligible Points.
36. Variant-specific points price overrides product default when present.
37. Referral attribution is immutable.
38. Referral reward is 50 points on the referee's first DELIVERED order.
39. Duplicate rewards and duplicate refunds are forbidden.
40. Do not invent an EGP-to-points conversion.

================================================================================
87. FINAL DEFINITION OF DONE
================================================================================

VEN+ is DONE only when:

- all active canonical features are implemented
- all active points requirements are integrated
- checkout is correct under Cash/Points/Mixed combinations
- shipping payment is correct
- points accounting is correct and auditable
- referral reward is correct and idempotent
- inventory is safe under concurrency
- order lifecycle is enforced
- customer order retrieval is protected
- admin flows are protected
- product variants/images are correct
- product download is secure
- responsive UI is functional
- Arabic RTL is functional
- English LTR is functional
- dark/light modes are functional
- tests pass
- build passes
- security verification passes
- E2E passes where configured
- documentation is reconciled
- no material blocker remains

================================================================================
88. FINAL LOVABLE EXECUTION PROTOCOL
================================================================================

When you receive this document:

STEP 1
Read the repository. Do not modify anything yet.

STEP 2
Audit the current implementation against this contract.

STEP 3
Identify exactly which work item is currently active.

STEP 4
Report:
- current stack
- existing implementation status
- drift
- current blockers
- proposed minimal changes

STEP 5
Implement only the current work item.

STEP 6
Run targeted tests.

STEP 7
Run relevant broader verification.

STEP 8
Inspect changed files for security, persistence, business-rule correctness, and
unintended regressions.

STEP 9
Return the required work-item report.

STEP 10
If VERIFIED, move to the next work item.
If BLOCKED, stop.

Never skip a gate.

================================================================================
89. FINAL DOCUMENT INTEGRITY CONTRACT
================================================================================

This file is the final executable contract.

The sections above are intended to be self-contained.

SECTION 90 is the final executable business/domain expansion. If any earlier section
conflicts with a rule stated explicitly in Section 90, the Section 90 rule wins.

No section labeled "Preserved", "standard rules preserved", or similar is required
to supply missing executable content.

No hidden historical section is necessary to interpret the active business model.

Any future change must produce a new version, for example:
VEN+ CANONICAL MASTER IMPLEMENTATION SPECIFICATION — v5.1

Do not silently mutate the meaning of this FINAL v5.0 contract.


================================================================================
90. FINAL CANONICAL EXPANSION — COMPLETE BUSINESS / DOMAIN CONTRACT
================================================================================

PURPOSE
This section removes implementation ambiguity from the active commercial model.
Every rule below is executable. The coding agent MUST NOT infer a different rule.

--------------------------------------------------------------------------------
90.1 ACTIVE COMMERCIAL MODES
--------------------------------------------------------------------------------

SUPPORTED PRODUCT PAYMENT METHODS:
- CASH
- POINTS

SUPPORTED SHIPPING PAYMENT METHODS:
- CASH
- POINTS

SUPPORTED ORDER FUNDING MODES:
- CASH_ONLY
- POINTS_ONLY
- MIXED

ORDER FUNDING MODE MUST BE DERIVED SERVER-SIDE from every payable component in the
complete order.

For customer checkout, each order item has its own PRODUCT_PAYMENT_METHOD, and the
shipping component has its own SHIPPING_PAYMENT_METHOD. Item-level choices MAY differ.

CANONICAL AGGREGATE RULE:
- CASH_ONLY = every payable component in the order uses CASH.
- POINTS_ONLY = every payable component in the order uses POINTS, and every Points
  component is eligible.
- MIXED = at least one payable component uses CASH AND at least one payable component
  uses POINTS.

Examples:
1. Item A=CASH, Item B=CASH, Shipping=CASH -> CASH_ONLY.
2. Item A=POINTS, Item B=POINTS, Shipping=POINTS -> POINTS_ONLY.
3. Item A=CASH, Item B=POINTS, Shipping=CASH -> MIXED.
4. Item A=POINTS, Item B=CASH, Shipping=POINTS -> MIXED.
5. Item A=CASH, Shipping=POINTS -> MIXED.
6. Item A=POINTS, Shipping=CASH -> MIXED.

INVALID:
- Any payment method outside CASH/POINTS.
- Points payment when the product has pointsEnabled=false.
- Points payment when the effective points price is null/invalid.
- Points payment when available points are insufficient.
- Points shipping when shipping-points eligibility is not satisfied.

The browser may request a mode, but the server computes and persists the authoritative
aggregate mode from the actual component methods.

--------------------------------------------------------------------------------
90.2 MONEY AND POINTS ARE DIFFERENT LEDGERS
--------------------------------------------------------------------------------

Money and points are independent accounting domains.

NEVER create a generic currency conversion such as:
1 EGP = X points
unless an explicit future business version defines such a conversion.

POINTS ARE NOT CASH.
POINTS ARE NOT A DECIMAL MONEY TYPE.
POINTS MUST BE STORED AS AN INTEGER ATOM/WHOLE UNIT.
POINTS MUST NEVER BECOME NEGATIVE.

Money MUST use the repository's exact safe monetary representation.
Preferred representation: integer minor units / integer EGP value according to the
existing repository convention. Never use floating-point arithmetic for money.

--------------------------------------------------------------------------------
90.3 PRODUCT CASH PRICE
--------------------------------------------------------------------------------

Product basePrice is the canonical base cash price.
Variant may have a cash price override.

EFFECTIVE CASH UNIT PRICE:
IF active variant cash price override exists:
    use variant override
ELSE:
    use product basePrice

The server MUST recalculate the effective price from authoritative database state.
Client-submitted price is advisory only and MUST NOT be trusted.

--------------------------------------------------------------------------------
90.4 PRODUCT POINTS PRICE
--------------------------------------------------------------------------------

Product supports:
- pointsEnabled
- defaultPointsPrice

Variant supports:
- pointsPrice override

EFFECTIVE POINTS UNIT PRICE:
IF product.pointsEnabled != true:
    points payment is unavailable.
ELSE IF active variant.pointsPrice exists:
    use variant.pointsPrice
ELSE IF product.defaultPointsPrice exists:
    use product.defaultPointsPrice
ELSE:
    points payment is unavailable.

Effective points price MUST be a positive integer.
Zero, negative, NaN, Infinity, string-encoded values, or malformed values are invalid.

--------------------------------------------------------------------------------
90.5 PRODUCT-LEVEL REWARD POINTS
--------------------------------------------------------------------------------

Product defines the canonical deliveryPointsReward for an eligible purchase.
The canonical reward is PER-UNIT. The verified repository must expose the product reward
through its existing schema/configuration; do not invent a monetary conversion.
If the repository contains a variant-level reward override, it must be normalized to the
same per-unit semantic rule. If it does not, the product-level reward applies to the
variant.

DELIVERY REWARD MUST BE CALCULATED FROM AUTHORITATIVE PRODUCT/VARIANT SNAPSHOTS.
Never calculate historical reward later from a changed product record.

CANONICAL QUANTITY RULE:
- deliveryPointsReward is a PER-UNIT reward.
- line reward = authoritative reward per unit × delivered quantity.
- the final order reward is the sum of eligible delivered line rewards.

Reward credit occurs only after the order transitions to DELIVERED.

CRITICAL DELIVERY-REWARD TRIGGER RULE:
- DELIVERED MUST NOT be assigned automatically merely because a shipment was created,
  a tracking event exists, a carrier API reports delivery, or a time/date threshold was reached.
- The customer-facing delivery reward is triggered only when an ADMIN or explicitly
  authorized order-management actor records and confirms that the customer actually
  received the order, and the order is then transitioned to DELIVERED through the
  server-side order lifecycle command.
- The UI control/action used for this must be an explicit operational confirmation
  such as "Customer received order / Mark as Delivered" (exact localized wording may vary).
- The server MUST verify that the actor is authorized to perform the DELIVERED transition.
- The client/browser MUST NOT be able to set DELIVERED by directly submitting a status value.
- No delivery reward may be credited before this explicit authorized delivery confirmation.

Reward must be credited exactly once per eligible delivered order line quantity.

No reward is created for:
- PENDING_CONFIRMATION
- CONFIRMED
- PROCESSING
- SHIPPED
- CUSTOMER_REFUSED
- CANCELLED
- FAILED

A duplicate DELIVERED event MUST NOT create duplicate reward points.

--------------------------------------------------------------------------------
90.6 POINTS EXAMPLE RULES
--------------------------------------------------------------------------------

The following illustrates the intended product-specific nature of rewards and is
NOT a monetary conversion:

Example:
- Product A priced at 1500 EGP may reward 50 points.
- Product B priced at 1500 EGP may reward 25 points.

Therefore reward points are NOT necessarily proportional to EGP price.
The configured product reward is authoritative.

--------------------------------------------------------------------------------
90.7 POINTS ACCOUNT / BALANCE MODEL
--------------------------------------------------------------------------------

A customer has one authoritative current points balance.
All changes MUST also have an immutable ledger transaction.

The ledger is the audit trail.
The balance is the current materialized state used for fast reads.

Every points mutation MUST be represented as an auditable transaction containing,
where supported by schema:
- id
- userId
- type
- amount
- signed direction / delta
- balanceBefore
- balanceAfter
- orderId nullable
- orderItemId nullable
- referralId nullable
- idempotency/reference key
- description/reason
- createdAt
- actor/source

Exact schema names may follow the repository convention, but semantic information
MUST be preserved.

NEVER update pointsBalance without a corresponding ledger entry unless the operation
is a data-repair procedure explicitly approved by admin tooling and audited.

--------------------------------------------------------------------------------
90.8 POINTS TRANSACTION TYPES
--------------------------------------------------------------------------------

At minimum support these semantic transaction classes:

TRANSACTION TYPE and SIGNED DELTA are separate concepts.

CREDIT examples (positive delta):
- DELIVERY_REWARD
- REFERRAL_REWARD
- MANUAL_ADMIN_CREDIT, if admin points adjustment exists
- PRODUCT_REDEMPTION_REFUND
- SHIPPING_REDEMPTION_REFUND
- EXPLICIT_COMPENSATION where compensation restores points

DEBIT examples (negative delta):
- PRODUCT_REDEMPTION
- SHIPPING_REDEMPTION
- MANUAL_ADMIN_DEBIT, if admin points adjustment exists
- EXPLICIT_REVERSAL where the reversal consumes points by explicit business rule

A reversal/compensation is a semantic event type, not a direction by itself.
The signed delta determines whether the balance moves up or down.

--------------------------------------------------------------------------------
90.9 POINTS DEBIT ORDERING
--------------------------------------------------------------------------------

When a mixed or points-only checkout uses points for multiple components, the
server MUST calculate the complete points requirement before mutating the balance.

Required sequence inside the transaction:
1. Load authoritative balance.
2. Calculate all product points required.
3. Calculate shipping points required, if any.
4. Calculate total points debit.
5. Verify total available points >= required debit.
6. Lock/recheck the points balance as appropriate for the database.
7. Record immutable ledger debits.
8. Update balance atomically.
9. Create order snapshots.
10. Commit.

If any step fails, the entire financial mutation MUST roll back.

--------------------------------------------------------------------------------
90.10 CONCURRENCY CONTROL FOR POINTS
--------------------------------------------------------------------------------

Two simultaneous checkouts from the same account MUST NOT both spend the same
points.

The implementation MUST protect against lost-update and double-spend conditions.
Acceptable methods include:
- row-level database locking
- serializable transaction
- atomic conditional update with affected-row verification
- equivalent concurrency-safe mechanism

The implementation MUST include a test proving that concurrent redemptions cannot
make pointsBalance negative or overspend the available balance.

--------------------------------------------------------------------------------
90.11 POINTS REFUND / COMPENSATION RULE
--------------------------------------------------------------------------------

If points were debited during checkout and the order later becomes cancelled or
otherwise invalid before final fulfillment, the system MUST restore the exact
previously debited points through compensating ledger transactions.

DO NOT silently mutate the original ledger transaction.
DO NOT delete the original debit.
DO NOT directly overwrite the balance without an audit entry.

Compensation MUST be idempotent.

A second cancellation/retry MUST NOT restore the points twice.

--------------------------------------------------------------------------------
90.12 STOCK RESERVATION / DEDUCTION
--------------------------------------------------------------------------------

ProductVariant.stock is authoritative.

At checkout:
- validate quantity > 0
- validate integer quantity
- validate active product
- validate active variant
- validate sufficient stock
- perform atomic conditional deduction

If deduction fails for any item, the transaction MUST fail.

If the repository explicitly treats stock deduction as reservation rather than final
consumption, that reservation model MUST be documented and the release event defined.
No ambiguous hybrid behavior is allowed.

--------------------------------------------------------------------------------
90.13 CUSTOMER REFUSED STOCK POLICY
--------------------------------------------------------------------------------

Current canonical rule:
CUSTOMER_REFUSED does NOT automatically restore stock.

This is intentional and MUST NOT be changed implicitly.

Any future stock-restoration behavior requires a new Master Prompt version.

--------------------------------------------------------------------------------
90.14 ORDER CREATION AT CHECKOUT
--------------------------------------------------------------------------------

Customer-created orders start in:
PENDING_CONFIRMATION

The initial order must contain immutable snapshots of all commercially relevant
values, including:
- customer name
- primary phone
- secondary phone
- WhatsApp
- full free-form address
- item product identifiers
- item variant identifiers
- product names
- variant attributes
- SKU
- cash unit prices
- points unit prices
- quantities
- line totals
- product payment methods
- subtotal
- shipping amount
- shipping payment method
- points redeemed for product
- points redeemed for shipping
- total cash due
- total points due
- expected delivery duration/value at order creation where applicable

Historical snapshots MUST remain stable even if product/customer/shipping data later
changes.

--------------------------------------------------------------------------------
90.15 ORDER STATE MACHINE
--------------------------------------------------------------------------------

PRIMARY FLOW:
NONE -> PENDING_CONFIRMATION -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED

OPERATIONAL REFUSAL:
SHIPPED -> CUSTOMER_REFUSED

CANONICAL CANCELLATION TRANSITIONS:
- PENDING_CONFIRMATION -> CANCELLED : ALLOWED.
- CONFIRMED -> CANCELLED : ALLOWED.
- PROCESSING -> CANCELLED : ALLOWED only while the order has not entered SHIPPED.
- SHIPPED -> CANCELLED : FORBIDDEN; use CUSTOMER_REFUSED for the defined refusal path.
- DELIVERED -> CANCELLED : FORBIDDEN.
- CUSTOMER_REFUSED -> CANCELLED : FORBIDDEN unless a future canonical version adds a
  separate recovery state.
- CANCELLED -> any operational state : FORBIDDEN.

Cancellation is a service-layer command, never a client-controlled status assignment.

Every transition MUST validate:
- current state
- target state
- actor permissions
- required side effects
- idempotency
- audit logging

--------------------------------------------------------------------------------
90.16 ORDER TRANSITION SIDE EFFECTS
--------------------------------------------------------------------------------

PENDING_CONFIRMATION:
- no delivery reward
- no referral reward
- customer may be contacted
- stock and payment snapshots already exist

CONFIRMED:
- no delivery reward yet
- no referral reward yet

PROCESSING:
- fulfillment preparation
- no reward yet

SHIPPED:
- no reward yet
- shipping reference/tracking may be recorded if supported

DELIVERED:
- DELIVERED is entered only through the explicit authorized operational action confirming
  that the customer received the order.
- eligible delivery rewards credit exactly once
- eligible referral reward credits exactly once
- repeated attempts to mark the same order as DELIVERED are idempotent and MUST NOT
  create duplicate reward credits.

CUSTOMER_REFUSED:
- no delivery reward
- no referral reward
- stock is NOT automatically restored
- redeemed points are restored exactly once when the refused order is financially
  invalidated and the points payment is reversed

CANCELLED:
- no delivery reward
- no referral reward
- reverse eligible points debits exactly once
- restore exact deducted stock quantity exactly once because all canonical cancellation
  transitions occur before SHIPPED.

--------------------------------------------------------------------------------
90.17 REFERRAL CODE MODEL
--------------------------------------------------------------------------------

Referral code is assigned only at registration.

Rules:
- Referral code is optional at registration.
- Self-referral is forbidden.
- Referral attribution is immutable.
- If account is created without a referral code, no later manual attachment is allowed
  through customer UI or normal API.
- Referral attribution applies to the referee's first qualifying purchase/order only.
- Reward is granted only when that first referred order becomes DELIVERED.
- Reward amount is exactly 50 points.

A referral reward MUST be associated with the referee account and attributable to the
referrer.

Do not reward:
- merely creating an account
- merely placing an order
- cancelled orders
- customer-refused orders
- non-delivered orders

Duplicate referral rewards are forbidden.

--------------------------------------------------------------------------------
90.18 SHIPPING MODEL
--------------------------------------------------------------------------------

There is one global shipping price.
Admin may configure:
- GLOBAL_SHIPPING_PRICE
- FREE_SHIPPING_POINTS_THRESHOLD
- EXPECTED_DELIVERY_DURATION

Current shipping amount is snapshotted into every created order.
Later shipping-price changes affect new orders only.

--------------------------------------------------------------------------------
90.19 FREE-SHIPPING POINTS ELIGIBILITY
--------------------------------------------------------------------------------

FREE_SHIPPING_POINTS_THRESHOLD is an explicit eligibility threshold.
The implementation MUST NOT infer a different threshold meaning.

The final schema/service must distinguish between:
A. points required as payment for shipping
B. account eligibility threshold for free shipping

CANONICAL SHIPPING-POINTS RULE:
- FREE_SHIPPING_POINTS_THRESHOLD is the minimum authoritative customer points balance
  required to unlock the Points shipping option at checkout.
- It is an eligibility threshold, not an amount to debit.
- When the threshold is not met, SHIPPING_PAYMENT_METHOD=POINTS is unavailable.
- When the threshold is met, the customer may select SHIPPING_PAYMENT_METHOD=POINTS.
- The exact shipping points debit MUST come from an explicit persisted
  SHIPPING_POINTS_PRICE configuration in the repository.
- If the repository's existing business configuration defines Points shipping as free,
  SHIPPING_POINTS_PRICE is 0 and shippingPointsRedeemed is 0.
- If SHIPPING_POINTS_PRICE is a positive configured integer, that exact number of points
  is debited.
- No EGP-to-points conversion may be invented.
- The order MUST snapshot shippingPointsRedeemed exactly as actually debited.
- If the repository contains neither a configured free-shipping behavior nor an explicit
  SHIPPING_POINTS_PRICE, the Points shipping feature is BLOCKED.
- The UI must reflect this server-derived eligibility and must never infer it from a
  client-side balance.

--------------------------------------------------------------------------------
90.20 CHECKOUT VALIDATION ORDER
--------------------------------------------------------------------------------

Server-side checkout must execute in deterministic order:

01 authenticate session
02 authorize customer context
03 load server-authoritative cart
04 validate cart is not empty
05 load authoritative products/variants
06 validate product active state
07 validate variant active state
08 validate category/product constraints where applicable
09 validate quantities
10 validate inventory
11 resolve cash prices
12 resolve points prices
13 resolve pointsEnabled
14 resolve product payment selections
15 resolve shipping configuration
16 resolve shipping payment selection
17 resolve points eligibility
18 calculate product subtotal
19 calculate product points requirement
20 calculate shipping cash amount
21 calculate shipping points requirement
22 calculate aggregate funding mode
23 validate points balance
24 validate idempotency key
25 acquire transaction/concurrency protection
26 deduct stock atomically
27 debit points atomically if required
28 create immutable order snapshot
29 create order items
30 create points ledger entries
31 persist idempotency result
32 commit

If any required operation fails, rollback the whole transaction.

--------------------------------------------------------------------------------
90.21 IDEMPOTENCY
--------------------------------------------------------------------------------

Checkout MUST accept an idempotency key.

Same authenticated actor + same endpoint intent + same idempotency key MUST NOT create
multiple business effects.

Idempotency record must retain enough information to replay the same business outcome.

The implementation must safely distinguish:
- same key + same request -> return same logical result
- same key + materially different request -> reject as idempotency conflict

Idempotency MUST protect:
- order creation
- points debits
- stock deduction
- referral reward
- delivery reward
- points compensation/refund

--------------------------------------------------------------------------------
90.22 CART AUTHORITY
--------------------------------------------------------------------------------

The cart may be mirrored in client state for UX only.

The client MUST NOT be treated as authoritative for:
- price
- points price
- stock
- product active status
- pointsEnabled
- points balance
- shipping amount
- discounts/eligibility
- final total
- funding mode

Server recalculates all of these at checkout.

--------------------------------------------------------------------------------
90.23 STALE CART HANDLING
--------------------------------------------------------------------------------

If a product price, points price, stock quantity, active state, variant availability,
or shipping configuration changed after the cart was populated:
- the server MUST use current authoritative values
- the API MUST return a deterministic stale-cart/price/stock error when user action
  is required
- the client MUST display the corrected value clearly
- never silently charge a client-provided stale amount

--------------------------------------------------------------------------------
90.24 CHECKOUT ERROR CATEGORIES
--------------------------------------------------------------------------------

Use stable machine-readable error categories for at least:
- UNAUTHENTICATED
- FORBIDDEN
- CART_EMPTY
- PRODUCT_INACTIVE
- VARIANT_INACTIVE
- VARIANT_NOT_FOUND
- INVALID_QUANTITY
- INSUFFICIENT_STOCK
- POINTS_NOT_ENABLED
- POINTS_PRICE_UNAVAILABLE
- INSUFFICIENT_POINTS
- SHIPPING_POINTS_NOT_ELIGIBLE
- IDEMPOTENCY_CONFLICT
- ORDER_STATE_CONFLICT
- VALIDATION_ERROR
- RATE_LIMITED
- INTERNAL_ERROR

Do not expose sensitive internal database information.

--------------------------------------------------------------------------------
90.25 ADMIN ORDER ENTRY
--------------------------------------------------------------------------------

SCOPE: ADMIN PANEL ONLY.
This interface is separate from the normal customer-facing Checkout. Customer
Checkout UI changes MUST NOT be copied into this interface unless this Admin section
explicitly says so.

Admin Order Entry follows the same underlying domain/business invariants as customer
checkout, but it retains its own Admin-specific UI contract, fields, permissions,
audit requirements, and workflow.

Admin is NOT allowed to bypass:
- stock validation
- active product validation
- points balance validation where customer points are used
- price authority
- order snapshots
- idempotency
- audit logging

Admin may create an order on behalf of a customer, but the source actor must be stored
in audit metadata.

Required fields:
- customer full name
- primary phone
- secondary phone
- WhatsApp
- Admin Order Entry address field as defined by the Admin contract
- customer notes
- product search
- product
- variant
- cash price
- points price when applicable
- product payment method
- shipping payment method
- quantity
- color
- size
- subtotal
- remove action

Forbidden fields inherited from historical admin UI:
- Order Type
- Moderator Name
- Facebook Page
- Facebook Link
- Commission

Totals must show separately:
- subtotal cash equivalent
- shipping cash amount
- total cash due
- total points due
- funding mode

--------------------------------------------------------------------------------
90.26 PRODUCT MANAGEMENT
--------------------------------------------------------------------------------

Product creation/editing MUST support:
- localized title
- localized description
- category
- cash base price
- points enabled
- default points price
- delivery reward points policy
- specifications
- active state
- media
- variants

Variant editing MUST support:
- SKU
- cash price override
- points price override
- stock
- structured attributes
- active state
- variant-specific image association

No fake image switching.
No CSS hue rotation as a substitute for real product imagery.

--------------------------------------------------------------------------------
90.27 PRODUCT IMAGE CONTRACT
--------------------------------------------------------------------------------

Image metadata must include semantic equivalents of:
- id
- productId
- variantId nullable/required according to model
- storage reference
- alt text
- display order
- primary flag
- active state if applicable

Object storage references are opaque IDs/keys; never expose insecure storage internals
when not intended for clients.

Uploading/reordering/deleting images is admin-authorized.

--------------------------------------------------------------------------------
90.28 PRODUCT DOWNLOAD PACKAGE
--------------------------------------------------------------------------------

Admin-only "تحميل بيانات المنتج" must generate:
Product-[SKU].zip

Package contents:
- product.json
- descriptions / localized text representation
- variants.json
- images/

Generated package MUST be based on authoritative persisted data.

Security requirements:
- verify admin authorization
- validate product ID/SKU access
- prevent path traversal
- sanitize archive entry names
- never include secrets, session tokens, internal credentials, or unrelated customer data
- do not include arbitrary filesystem paths

--------------------------------------------------------------------------------
90.29 EXCEL IMPORT / EXPORT
--------------------------------------------------------------------------------

If Excel functionality exists in the repository, all spreadsheet input is untrusted.

Requirements:
- schema validation
- file type validation
- size limits
- row limits
- transactional import
- deterministic error reporting
- rollback on invalid atomic import
- no formula/execution abuse
- no arbitrary file path writes
- no secret leakage

Export values must reflect authoritative database state.

--------------------------------------------------------------------------------
90.30 AUTHENTICATION
--------------------------------------------------------------------------------

Supported authentication:
- registration
- email/password login
- logout
- forgot password
- email verification
- password reset
- Google authentication if already configured/required

Roles:
- CUSTOMER
- ADMIN

Do not add new roles unless a future contract version specifies them.

--------------------------------------------------------------------------------
90.31 ADMIN BOOTSTRAP
--------------------------------------------------------------------------------

If repository supports bootstrap admin creation:
- use server-side bootstrap path
- never hard-code a password in source
- use environment-managed secrets or one-time bootstrap credentials
- hash with Argon2id
- never log plaintext credentials
- make bootstrap idempotent
- refuse insecure defaults in production

--------------------------------------------------------------------------------
90.32 SESSION SECURITY
--------------------------------------------------------------------------------

Production cookies:
- HttpOnly
- Secure
- SameSite appropriate to deployment

Session identifiers must be unguessable.
Sensitive auth state must be invalidatable server-side.
Logout must invalidate the session.
Password reset should rotate/revoke relevant sessions according to implementation.

--------------------------------------------------------------------------------
90.33 ACCOUNT ENUMERATION
--------------------------------------------------------------------------------

Registration and password-reset flows MUST NOT disclose whether a particular account
exists through distinguishable public responses.

Timing and error response patterns should be normalized where practical.

--------------------------------------------------------------------------------
90.34 RATE LIMITING
--------------------------------------------------------------------------------

Apply rate limits to:
- login
- registration
- password reset request
- email verification request
- sensitive admin endpoints
- repeated checkout/order creation attempts
- file upload/import endpoints

Limits must be server-side and resilient to client spoofing where applicable.

--------------------------------------------------------------------------------
90.35 RBAC
--------------------------------------------------------------------------------

Every protected route MUST enforce authorization server-side.
UI hiding is not authorization.

Admin APIs require ADMIN role and any required step-up/MFA condition.
Customer APIs require authenticated ownership of the target resource.

--------------------------------------------------------------------------------
90.36 IDOR
--------------------------------------------------------------------------------

Never trust a resource ID simply because the user is authenticated.

For customer order retrieval:
- verify order belongs to authenticated customer
OR
- verify privileged admin authorization.

Same rule applies to any customer-owned resource.

--------------------------------------------------------------------------------
90.37 MASS ASSIGNMENT
--------------------------------------------------------------------------------

Never pass arbitrary request bodies into ORM create/update calls.
Use explicit allowlists and validated schemas.

Forbidden examples:
- role
- userId
- ownerId
- pointsBalance
- order status
- internal audit flags
- admin flags
unless explicitly controlled by a secure service/admin operation.

--------------------------------------------------------------------------------
90.38 INPUT VALIDATION
--------------------------------------------------------------------------------

Validate:
- types
- required/optional semantics
- length
- format
- range
- enum membership
- relationships
- authorization
- business invariants

Prefer Zod or the repository's existing schema-validation mechanism.

--------------------------------------------------------------------------------
90.39 INJECTION DEFENSE
--------------------------------------------------------------------------------

Treat all user-controlled values as hostile.

Defend against:
- SQL injection
- command injection
- XSS
- HTML injection
- template injection
- path traversal
- SSRF
- CSV/formula injection
- unsafe deserialization
- malicious archive entries

No string-concatenated SQL for user input.

--------------------------------------------------------------------------------
90.40 SSRF
--------------------------------------------------------------------------------

Any server-side fetch of user-controlled URLs MUST validate:
- protocol
- hostname
- private IP ranges
- loopback/link-local ranges
- redirects
- DNS rebinding

Do not allow internal network access through URL manipulation.

--------------------------------------------------------------------------------
90.41 CONTENT SECURITY POLICY
--------------------------------------------------------------------------------

Implement restrictive CSP compatible with the actual application.
Do not add unsafe-inline or unsafe-eval merely to silence runtime issues.
If a library requires special handling, isolate the exception and document it.

--------------------------------------------------------------------------------
90.42 SECURITY HEADERS
--------------------------------------------------------------------------------

Where appropriate, set secure headers including semantic equivalents of:
- Content-Security-Policy
- X-Content-Type-Options: nosniff
- Referrer-Policy
- frame-ancestors policy through CSP
- secure transport policy in production where appropriate

Do not introduce headers that break the application without testing.

--------------------------------------------------------------------------------
90.43 FILE UPLOAD SECURITY
--------------------------------------------------------------------------------

For uploaded images/files:
- validate size
- validate type
- do not trust MIME alone
- sanitize filenames
- generate safe storage keys
- prevent path traversal
- isolate object storage keys from filesystem paths
- apply access control
- never execute uploaded content

--------------------------------------------------------------------------------
90.44 LOGGING
--------------------------------------------------------------------------------

Security/business logs may record:
- actor ID
- event type
- timestamp
- target resource ID
- success/failure
- safe reason code

NEVER log:
- plaintext passwords
- reset tokens
- session tokens
- OAuth secrets
- API keys
- full sensitive payment credentials

Points mutations should be auditable.
Order state transitions should be auditable.
Admin destructive actions should be auditable.

--------------------------------------------------------------------------------
90.45 PRIVACY / DATA MINIMIZATION
--------------------------------------------------------------------------------

Store only data required by active business workflows.
Customer phone/address data are sensitive business data and must not appear in
unnecessary logs, analytics, exports, or client payloads.

--------------------------------------------------------------------------------
90.46 RESPONSIVE UI CONTRACT
--------------------------------------------------------------------------------

The application MUST work on:
- desktop
- tablet
- mobile

The customer storefront and checkout MUST be genuinely responsive, not merely scaled.

Mobile requirements:
- no horizontal overflow
- touch-friendly controls
- readable prices and points
- checkout remains usable at narrow widths
- dialogs/drawers must fit viewport
- tables use responsive transformation or horizontal scrolling intentionally
- critical actions remain visible

Admin UI must also be responsive enough for operational use.

--------------------------------------------------------------------------------
90.47 RTL / LTR CONTRACT
--------------------------------------------------------------------------------

Arabic:
- RTL layout
- RTL-aware spacing/alignment
- Arabic-friendly typography
- numeric and price formatting remains readable

English:
- LTR layout

Do not hardcode directional margins where logical CSS properties can be used.
Prefer logical properties:
- margin-inline
- padding-inline
- inset-inline

Icons that convey direction MUST reverse appropriately when semantics require it.

--------------------------------------------------------------------------------
90.48 LOCALIZATION
--------------------------------------------------------------------------------

Use locale-aware formatting for:
- EGP currency
- dates
- times
- numbers

Do not concatenate translated sentences in ways that break grammar/order.

All visible text introduced by this implementation should be localizable.

--------------------------------------------------------------------------------
90.49 DARK MODE
--------------------------------------------------------------------------------

Global modes:
- LIGHT
- DARK

Theme state must be centralized.
Do not implement isolated page-level dark mode hacks.

Requirements:
- text contrast
- form controls
- dialogs
- cards
- tables
- navigation
- disabled states
- focus states
- error states
- images/borders/shadows

Avoid unreadable contrast caused by reusing fixed colors blindly.

Brand primary:
#FF6B00
Secondary:
#F97316
Deep carbon:
#09090B
Soft background:
#FAFAFA

These are canonical brand tokens; additional semantic tokens may be added.

--------------------------------------------------------------------------------
90.50 ACCESSIBILITY
--------------------------------------------------------------------------------

Implement at least:
- keyboard accessibility
- visible focus state
- accessible names
- semantic buttons/links
- form labels
- validation messages associated with inputs
- meaningful alt text for images
- dialogs with correct focus behavior
- sufficient color contrast
- no information conveyed by color alone

--------------------------------------------------------------------------------
90.51 UX: CUSTOMER STORE
--------------------------------------------------------------------------------

Customer storefront should provide clear:
- product identity
- cash price
- points availability
- points price when enabled
- stock/availability state
- variant selection
- image switching
- category context
- add-to-cart action

Do not expose internal IDs or implementation details.

--------------------------------------------------------------------------------
90.52 UX: CUSTOMER STOREFRONT CHECKOUT
--------------------------------------------------------------------------------

SCOPE: CUSTOMER STOREFRONT ONLY.
The following rules define the normal customer-facing order/Checkout page. They do
NOT redefine the Admin Order Entry workspace.

Customer Checkout MUST clearly separate:

CONTACT:
- Full Name
- Primary Phone
- Secondary Phone
- WhatsApp
- checkbox: WhatsApp is same as primary phone

ADDRESS:
- Full Address textarea

PAYMENT:
- Product payment: Cash / Points per item or applicable order grouping
- Shipping payment: Cash / Points

TOTALS:
- subtotal
- shipping
- total cash due
- total points due

The UI must not claim a points payment is available if the server would reject it.

--------------------------------------------------------------------------------
90.53 UX: POINTS BALANCE
--------------------------------------------------------------------------------

Where points are exposed to customers, show:
- current available points
- points required
- remaining points after redemption, when determinable
- reason if a points option is unavailable

Do not show a misleading balance based only on optimistic client state.

--------------------------------------------------------------------------------
90.54 UX: REFERRAL
--------------------------------------------------------------------------------

The referral UI should clearly explain:
- referral code is assigned at registration
- attribution is immutable
- reward conditions
- reward amount of 50 points

Do not imply referral rewards are immediate at signup or at checkout.

--------------------------------------------------------------------------------
90.55 UX: ORDER TRACKING
--------------------------------------------------------------------------------

Customers should see the authoritative order state.
Do not let the browser manufacture status.

For every visible order status, map it to the canonical state machine.

--------------------------------------------------------------------------------
90.56 ADMIN CONFIRMATION QUEUE
--------------------------------------------------------------------------------

The queue must expose:
- customer identity
- primary phone
- secondary phone
- WhatsApp
- full free-form address
- products
- variants
- quantities
- cash prices
- points prices
- chosen payment methods
- points redeemed
- shipping
- total cash
- total points
- expected delivery
- confirmation attempts

After three failed calls:
- DO NOT auto-cancel
- remain PENDING_CONFIRMATION
- display warning

--------------------------------------------------------------------------------
90.57 ADMIN PRODUCT TABLE
--------------------------------------------------------------------------------

Columns:
- Product
- Category
- Cash Price
- Points Availability
- Points Price
- Variant Count
- Total Stock
- Status
- Actions

Actions must be authorization-protected.

--------------------------------------------------------------------------------
90.58 ADMIN PRODUCT CREATION STEPPER
--------------------------------------------------------------------------------

Steps:
01 INFORMATION
02 MEDIA
03 VARIANTS
04 SPECIFICATIONS
05 REVIEW

Information must include:
- title
- description
- category
- cash price
- active state
- pointsEnabled
- defaultPointsPrice
- delivery reward configuration where applicable

Variant step must support:
- SKU
- attributes
- stock
- cash price override
- pointsPrice override
- image association

Review must display what will actually be persisted.

--------------------------------------------------------------------------------
90.59 ERROR UX
--------------------------------------------------------------------------------

Errors must be:
- deterministic
- human-readable
- localized where applicable
- safe
- actionable

Never display raw stack traces to end users.
Never display SQL errors to end users.

--------------------------------------------------------------------------------
90.60 DATABASE / TRANSACTION CONTRACT
--------------------------------------------------------------------------------

Business-critical workflows MUST use the repository's actual database transaction
mechanism.

Transactions are required for coupled state changes including:
- checkout order creation + stock + points
- reward credit + state transition
- points compensation + cancellation where applicable

If a transaction boundary cannot guarantee atomicity, stop and report BLOCKED rather
than pretending the operation is safe.

--------------------------------------------------------------------------------
90.61 MIGRATION CONTRACT
--------------------------------------------------------------------------------

Before changing schema:
1. inspect current schema
2. inspect migrations
3. inspect actual ORM
4. inspect existing test fixtures
5. design backward-safe migration
6. apply migration
7. regenerate client/types if needed
8. run schema validation
9. run tests

Never silently install another ORM.
Never migrate from Drizzle to Prisma or from one framework to another simply because
an older document used that stack.

--------------------------------------------------------------------------------
90.62 REPOSITORY PRESERVATION
--------------------------------------------------------------------------------

Preserve verified functionality.
Prefer additive, minimal, targeted changes.
Do not rewrite files unrelated to the current work item.
Do not reformat the whole repository unnecessarily.
Do not rename public interfaces without migration need.

--------------------------------------------------------------------------------
90.63 API CONTRACT
--------------------------------------------------------------------------------

Every API must define:
- method
- route
- auth requirement
- role requirement
- request schema
- response schema
- error categories
- idempotency requirement if applicable
- audit behavior if applicable

Do not trust client totals.
Do not trust client prices.
Do not trust client points balance.

--------------------------------------------------------------------------------
90.64 CUSTOMER ORDER API
--------------------------------------------------------------------------------

Preserve/implement equivalents of:
GET /api/account/orders
GET /api/account/orders/[id]

Rules:
- authentication required
- ownership required for customer access
- admins may access according to RBAC
- response excludes unrelated users' data

--------------------------------------------------------------------------------
90.65 CHECKOUT API
--------------------------------------------------------------------------------

Equivalent checkout endpoint must accept only validated business input.

Client may send:
- cart intent/reference
- product/variant selections
- quantities
- chosen product payment methods
- chosen shipping payment method
- customer contact/address fields
- idempotency key

Server computes:
- current cash prices
- current points prices
- subtotal
- shipping
- points required
- totals
- funding mode
- stock
- eligibility

--------------------------------------------------------------------------------
90.66 ORDER SNAPSHOT IMMUTABILITY
--------------------------------------------------------------------------------

Once order is created, changing product title/price/points price/category/variant
attributes must NOT rewrite historical order values.

Order history is forensic/accounting data.

--------------------------------------------------------------------------------
90.67 BUSINESS AUDIT TRAIL
--------------------------------------------------------------------------------

Audit at minimum:
- order created
- order status changed
- order cancelled
- order shipped
- order delivered
- customer refused
- points credited
- points debited
- points refunded/compensated
- referral reward credited
- admin product mutation
- admin order mutation
- authentication/security events

Avoid leaking secrets.

--------------------------------------------------------------------------------
90.68 REPORTING
--------------------------------------------------------------------------------

Daily digest/reports must support points/loyalty metrics where reporting exists.
Potential metrics include:
- points earned
- points redeemed
- points refunded
- referral rewards
- outstanding points balance aggregates where safe
- orders using Points
- orders using Mixed funding

Do not expose customer-level PII in aggregate reports unless required.

--------------------------------------------------------------------------------
90.69 OBSERVABILITY
--------------------------------------------------------------------------------

Track enough telemetry to diagnose:
- checkout failures
- stock conflicts
- points conflicts
- idempotency conflicts
- order transition failures
- image/storage failures
- import/export failures

Metrics and logs must avoid secrets and excessive PII.

--------------------------------------------------------------------------------
90.70 BACKUP / RECOVERY
--------------------------------------------------------------------------------

Production backups:
- encrypted at rest
- access-controlled
- monitored
- periodically restoration-tested

Points ledger and orders are business-critical and must be included in recovery scope.

--------------------------------------------------------------------------------
90.71 TESTING STRATEGY
--------------------------------------------------------------------------------

Required test layers:
1. domain/unit
2. service/integration
3. API/integration
4. security/negative
5. concurrency where relevant
6. E2E where configured

--------------------------------------------------------------------------------
90.72 REQUIRED POINTS TEST MATRIX
--------------------------------------------------------------------------------

Must test:

A. Redemption:
- exact balance
- insufficient balance
- one point more than required
- zero points
- negative request
- disabled product
- missing points price
- variant override
- product default

B. Mixed:
- cash product + points shipping
- points product + cash shipping
- multiple lines with mixed methods
- multiple lines with different points prices

C. Reward:
- delivered once
- delivered repeated
- non-delivered
- cancelled
- refused

D. Referral:
- valid referral
- self referral
- no referral
- referral + first delivered order
- second order does not reward
- cancellation before delivery
- duplicate delivery event

E. Refund:
- cancellation restores exact debit
- duplicate cancellation does not double restore
- partial failure rolls back all mutations

F. Concurrency:
- two redemptions cannot overspend balance
- two delivery events cannot duplicate reward
- two referral reward jobs cannot duplicate reward

--------------------------------------------------------------------------------
90.73 REQUIRED ORDER TEST MATRIX
--------------------------------------------------------------------------------

Test every canonical transition and invalid transition.

Examples:
- PENDING_CONFIRMATION -> CONFIRMED valid
- CONFIRMED -> PROCESSING valid
- PROCESSING -> SHIPPED valid
- SHIPPED -> DELIVERED valid
- SHIPPED -> CUSTOMER_REFUSED valid
- NONE -> DELIVERED invalid
- DELIVERED -> PROCESSING invalid
- CUSTOMER_REFUSED -> DELIVERED invalid unless a future contract explicitly adds a
  recovery flow

Also test unauthorized status mutation.

--------------------------------------------------------------------------------
90.74 REQUIRED INVENTORY TEST MATRIX
--------------------------------------------------------------------------------

- exact stock purchase
- one over stock
- zero stock
- concurrent purchase
- cancellation before shipment restore
- customer refused does not restore
- failed transaction does not partially consume stock
- multiple variants in one order

--------------------------------------------------------------------------------
90.75 SECURITY ACCEPTANCE GATE
--------------------------------------------------------------------------------

Do not declare completion while any high-confidence vulnerability exists in:
- authentication
- authorization
- IDOR
- injection
- file handling
- SSRF
- secrets
- admin privilege escalation
- points manipulation
- stock manipulation
- order status manipulation

Business-logic authorization bypass is a security failure even if the UI appears safe.

--------------------------------------------------------------------------------
90.76 PERFORMANCE BASELINE
--------------------------------------------------------------------------------

Do not optimize prematurely, but prevent obvious pathological behavior.

Avoid:
- N+1 queries on admin lists
- repeated product queries in loops
- client-driven unrestricted result counts
- unbounded file import
- unbounded archive generation
- expensive aggregate queries on every request without need

Paginate operational lists.
Apply reasonable limits.

--------------------------------------------------------------------------------
90.77 FRONTEND STATE CONTRACT
--------------------------------------------------------------------------------

Frontend state is presentation state.
It may contain:
- loading
- selected variant
- form state
- temporary cart display
- optimistic visual state

It may NOT be authoritative for:
- price
- stock
- points balance
- shipping cost
- user role
- order status
- permissions

--------------------------------------------------------------------------------
90.78 FORM CONTRACT
--------------------------------------------------------------------------------

Every form must have:
- schema validation
- inline validation
- server validation
- loading state
- disabled state during submission where appropriate
- deterministic error display
- success state

Never trust client-only validation.

--------------------------------------------------------------------------------
90.79 DUPLICATE SUBMISSION PROTECTION
--------------------------------------------------------------------------------

Buttons and UI may prevent accidental double click, but server-side idempotency is
mandatory for business-critical operations.

UI prevention is not a replacement for backend idempotency.

--------------------------------------------------------------------------------
90.80 NOTIFICATION CONTRACT
--------------------------------------------------------------------------------

Notification channels may include email/WhatsApp abstractions if configured.

Business-critical state transitions MUST NOT depend on external notification delivery
success unless explicitly configured as a hard prerequisite.

Example:
If WhatsApp provider fails, order state should not be corrupted.

--------------------------------------------------------------------------------
90.81 WHATSAPP ABSTRACTION
--------------------------------------------------------------------------------

Use:
IWhatsAppConfirmationProvider

Initial provider:
ManualWhatsAppConfirmationProvider

Provider abstraction must keep business logic independent from provider-specific APIs.

--------------------------------------------------------------------------------
90.82 FEATURE FLAGS
--------------------------------------------------------------------------------

Do not hide active canonical features behind an unannounced feature flag that causes
production behavior to differ from the contract.

If a temporary flag is technically necessary:
- default according to the canonical contract
- document it
- test both paths
- remove it before final gate unless required for operations

--------------------------------------------------------------------------------
90.83 ENVIRONMENT MANAGEMENT
--------------------------------------------------------------------------------

Configuration must distinguish:
- development
- test
- production

Never use production credentials in tests.
Never commit secrets.

Environment variables must be validated at startup when required.

--------------------------------------------------------------------------------
90.84 DATABASE SEEDING
--------------------------------------------------------------------------------

Seed data must be deterministic where possible.

Do not seed:
- plaintext passwords
- fake customer PII that leaks into reports
- invalid points balances
- impossible order states

Admin seed path must remain secure.

--------------------------------------------------------------------------------
90.85 TEST FIXTURE INTEGRITY
--------------------------------------------------------------------------------

Tests should create controlled data rather than mutate production-like global fixtures
implicitly.

No test may depend on execution order unless explicitly designed as a suite fixture.

--------------------------------------------------------------------------------
90.86 ERROR RECOVERY
--------------------------------------------------------------------------------

For transient failures:
- retry only idempotent operations or operations protected by idempotency
- use bounded retries
- do not retry business rule failures
- avoid duplicate financial side effects

--------------------------------------------------------------------------------
90.87 DATA CONSISTENCY INVARIANTS
--------------------------------------------------------------------------------

The following invariants MUST always hold:

1. pointsBalance >= 0
2. every points mutation has an audit ledger event
3. order total reflects its immutable snapshots
4. order funding mode matches its product/shipping payment methods
5. points redeemed cannot exceed available points at mutation time
6. stock cannot become negative
7. delivered reward cannot be credited more than once
8. referral reward cannot be credited more than once
9. a cancelled order cannot receive a delivery reward
10. a refused order cannot receive a delivery reward
11. customer cannot read another customer's order
12. non-admin cannot perform admin-only mutations
13. browser values cannot override server-authoritative totals

--------------------------------------------------------------------------------
90.88 ACCEPTANCE SCENARIOS
--------------------------------------------------------------------------------

SCENARIO 1 — CASH ONLY
Customer buys two in-stock items.
Product payment = CASH.
Shipping = CASH.
Expected:
- funding mode CASH_ONLY
- no points debit
- stock deducted once
- order created PENDING_CONFIRMATION

SCENARIO 2 — POINTS ONLY
Customer has enough points.
Product payment = POINTS.
Shipping = POINTS if eligible.
Expected:
- funding mode POINTS_ONLY
- exact points debit
- zero cash due where applicable
- immutable points ledger

SCENARIO 3 — MIXED A
Product = CASH.
Shipping = POINTS.
Expected funding = MIXED.

SCENARIO 4 — MIXED B
Product = POINTS.
Shipping = CASH.
Expected funding = MIXED.

SCENARIO 5 — REFERRAL
New account registered with valid referral code.
First referred order becomes DELIVERED.
Expected:
- exactly 50 points to referrer
- no reward before DELIVERED

SCENARIO 6 — CANCELLATION
Order used points, then is cancelled in an eligible state.
Expected:
- original debit remains in ledger
- compensating credit occurs once
- no duplicate restore on repeated cancellation

SCENARIO 7 — PRICE CHANGE
Customer adds product at old price.
Admin changes price.
Customer checks out.
Expected:
- server uses current authoritative price
- client cannot force old price

SCENARIO 8 — STOCK RACE
Two customers attempt last unit concurrently.
Expected:
- one succeeds
- one receives deterministic stock conflict
- stock never negative

SCENARIO 9 — DUPLICATE CHECKOUT
Same idempotency key submitted twice.
Expected:
- one order
- one set of financial side effects
- same logical response

SCENARIO 10 — MANUAL DELIVERY CONFIRMATION + DUPLICATE DELIVERY EVENT
Admin explicitly confirms that the customer received the order and marks it DELIVERED.
Expected:
- DELIVERED is created only by the authorized order-management action
- one delivery reward based on per-unit reward × delivered quantity
- no reward before the explicit delivery confirmation
- repeating the DELIVERED action does not create duplicate reward points
- no duplicate referral reward

--------------------------------------------------------------------------------
90.89 CURRENT IMPLEMENTATION ORDER
--------------------------------------------------------------------------------

Execute in this exact order unless a Gate fails:

WORK ITEM 0 — Repository Audit
WORK ITEM 1 — Domain/Checkout/Points Integration
WORK ITEM 2 — Customer Order Retrieval
WORK ITEM 3 — Variant-to-Real-Image UX
WORK ITEM 4 — Advanced Admin Product Management
WORK ITEM 5 — Product Download Package
WORK ITEM 6 — Admin Order Entry
WORK ITEM 7 — Global Dark Mode / Responsive QA
WORK ITEM 8 — Documentation Reconciliation
WORK ITEM 9 — Final Verification / Security / E2E / Release Gate

Do not skip to a later work item because it looks easier.

--------------------------------------------------------------------------------
90.90 WORK ITEM 0 — REPOSITORY AUDIT
--------------------------------------------------------------------------------

Before editing:
- inspect package.json
- inspect lockfile
- inspect directory structure
- identify frontend framework
- identify backend runtime
- identify ORM/database layer
- identify auth
- identify tests
- identify build scripts
- identify migrations
- identify environment configuration
- identify current branch/worktree status if visible

Report:
1. actual stack
2. verified foundations
3. current gaps
4. conflicting files
5. migration requirements if any
6. exact next work item

No implementation in Work Item 0 unless required to make the audit possible.

--------------------------------------------------------------------------------
90.91 WORK ITEM 1 — CHECKOUT + POINTS
--------------------------------------------------------------------------------

Complete:
- cart UI integration
- checkout UI
- product cash/points selection
- shipping cash/points selection
- points balance display
- eligibility validation
- mixed checkout
- server recalculation
- transactional stock + points + order creation
- idempotency
- ledger
- reward hooks
- cancellation compensation

This work item is complete only when its dedicated test matrix passes.

--------------------------------------------------------------------------------
90.92 WORK ITEM 2 — CUSTOMER ORDER RETRIEVAL
--------------------------------------------------------------------------------

Implement/preserve:
GET /api/account/orders
GET /api/account/orders/[id]

Add:
- pagination where appropriate
- ownership guard
- status display
- financial snapshots
- points information relevant to customer
- safe error handling

--------------------------------------------------------------------------------
90.93 WORK ITEM 3 — VARIANT -> REAL IMAGE UX
--------------------------------------------------------------------------------

Selecting a variant/color must map to its actual media association.

Requirements:
- no fake hue rotation
- no placeholder-only switching if real image exists
- stable loading state
- fallback when no variant image exists
- responsive gallery
- accessible alt text

--------------------------------------------------------------------------------
90.94 WORK ITEM 4 — ADVANCED ADMIN PRODUCT MANAGEMENT
--------------------------------------------------------------------------------

Include:
- search
- filtering
- sorting
- pagination
- stock visibility
- cash/points visibility
- variant management
- image management
- active/inactive state
- safe mutation flows

All actions remain server-authorized.

--------------------------------------------------------------------------------
90.95 WORK ITEM 5 — PRODUCT DOWNLOAD PACKAGE
--------------------------------------------------------------------------------

Implement secure ZIP generation and validate its contents and authorization.

--------------------------------------------------------------------------------
90.96 WORK ITEM 6 — ADMIN ORDER ENTRY
--------------------------------------------------------------------------------

Implement the existing Admin Order Entry contract only.

The Admin Order Entry UI MUST NOT inherit or copy Customer Checkout UI changes merely
because both workflows create orders.

Use the same underlying server-side domain invariants where the existing Admin contract
requires them, but preserve Admin-specific fields, layout, permissions, and workflow.

Admin actor must be distinguishable from customer actor in audit metadata.

--------------------------------------------------------------------------------
90.97 WORK ITEM 7 — VISUAL / RESPONSIVE / DARK MODE
--------------------------------------------------------------------------------

Validate:
- desktop
- tablet
- mobile
- Arabic RTL
- English LTR
- light
- dark
- keyboard
- focus
- error states
- loading states
- empty states

--------------------------------------------------------------------------------
90.98 WORK ITEM 8 — DOCUMENTATION RECONCILIATION
--------------------------------------------------------------------------------

Remove obsolete contradictory documentation from active project guidance.

Do not delete historical records if they are needed for audit, but mark them clearly
as non-executable historical material outside the canonical implementation contract.

--------------------------------------------------------------------------------
90.99 WORK ITEM 9 — FINAL VERIFICATION GATE
--------------------------------------------------------------------------------

Run repository-supported equivalents of:
- typecheck
- schema/database validation
- unit tests
- integration tests
- security tests
- build
- E2E tests if configured

Do not blindly execute a command that does not belong to the actual stack.

Example only:
- npx tsc --noEmit
- npx prisma validate ONLY if Prisma exists
- npx vitest run ONLY if Vitest exists
- npm run build
- npx playwright test ONLY if Playwright is configured

The actual repository determines exact command syntax.

--------------------------------------------------------------------------------
90.100 FINAL WORK-ITEM REPORT FORMAT
--------------------------------------------------------------------------------

Every completed work item MUST report:

WORK ITEM:
STATUS: VERIFIED | BLOCKED

FILES CHANGED:
- list

BEHAVIOR IMPLEMENTED:
- list

BUSINESS RULES VERIFIED:
- list

SECURITY CHECKS:
- list

TESTS:
- command/result

BUILD:
- command/result

KNOWN LIMITATIONS:
- explicit list or NONE

NEXT AUTHORIZED WORK ITEM:
- exact item

The report MUST end with exactly one of:
WORK ITEM VERIFIED
or
WORK ITEM BLOCKED

--------------------------------------------------------------------------------
90.101 STOP CONDITIONS
--------------------------------------------------------------------------------

STOP implementation and report BLOCKED if:
- database migration is ambiguous
- business rule is ambiguous and cannot be resolved from this contract
- current architecture cannot safely satisfy a security requirement without migration
- test suite reveals unexplained regression
- points accounting can become inconsistent
- stock can become negative
- authorization can be bypassed
- idempotency cannot be guaranteed for the affected workflow

Do NOT invent a workaround that changes business semantics.

--------------------------------------------------------------------------------
90.102 CHANGE REQUEST PROCESS
--------------------------------------------------------------------------------

Any requested business change after this version must:
1. be explicitly documented
2. identify affected sections
3. define migration impact
4. define data/backfill impact
5. define test impact
6. increment document version

No silent semantic changes.

================================================================================
91. FINAL CANONICAL DECISION REGISTER
================================================================================

DECISION 01:
VEN+ remains an existing project. Continue, do not rebuild from scratch.

DECISION 02:
Actual verified repository stack is authoritative for implementation technology.

DECISION 03:
Cash and Points are both active.

DECISION 04:
CASH_ONLY, POINTS_ONLY, and MIXED are active funding modes.

DECISION 05:
Product and shipping payments are independent.

DECISION 06:
Points are integer accounting units, not money.

DECISION 07:
Points are ledgered and auditable.

DECISION 08:
Points cannot go negative.

DECISION 09:
Product points eligibility is controlled by pointsEnabled.

DECISION 10:
Variant pointsPrice overrides product default when present.

DECISION 11:
Delivery reward occurs only when an ADMIN or explicitly authorized order-management actor
confirms actual customer receipt and transitions the order to DELIVERED through the
server-side lifecycle command. DELIVERED is not an automatic carrier/time-based trigger.

DECISION 12:
Referral reward is 50 points on first delivered referred order.

DECISION 13:
Referral attribution is immutable.

DECISION 14:
Self-referral is forbidden.

DECISION 15:
Full address is one free-form textarea field.

DECISION 16:
There is one global shipping price.

DECISION 17:
Shipping value is snapshotted at order creation.

DECISION 18:
Customer-created orders start PENDING_CONFIRMATION.

DECISION 19:
Three failed confirmation calls do not auto-cancel the order.

DECISION 20:
CUSTOMER_REFUSED does not automatically restore stock.

DECISION 21:
Checkout is idempotent.

DECISION 22:
Order history is immutable snapshot data.

DECISION 23:
Browser state is never authoritative for business-critical data.

DECISION 24:
Admin authorization is server-side.

DECISION 25:
Customer ownership is checked server-side.

DECISION 26:
No silent ORM/framework migration.

DECISION 27:
No test deletion to create a green build.

DECISION 28:
No completion claim without actual verification.

DECISION 29:
Do not begin a later work item while current gate fails.

DECISION 30:
Arabic is RTL and English is LTR.

DECISION 31:
Global Light/Dark modes are required.

DECISION 32:
Variant-specific real image switching is required.

DECISION 33:
Product download is admin-only.

DECISION 34:
Excel/file inputs are untrusted.
DECISION 33:
Product download is available to:
- Admin (via has_role(ADMIN) check)
- Authenticated customers (on active/public products only)
Unauthenticated visitors are redirected to login per standard product-page access policy.
Products must be active (is_active = true) to be available for customer download.
The existing admin-only download path is preserved unchanged.

DECISION 35:
Security is part of feature completeness, not a postscript.

DECISION 36:
Customer Checkout address change applies ONLY to the normal customer Checkout; it does NOT
propagate to Admin Order Entry.

DECISION 37:
MIXED means at least one payable component uses Cash and at least one payable component
uses Points across all order items plus shipping.

DECISION 38:
Delivery reward is a per-unit configured reward multiplied by delivered quantity. The
repository implementation must conform to this semantic rule.

DECISION 39:
Cancellation is allowed only before SHIPPED: PENDING_CONFIRMATION, CONFIRMED, and
PROCESSING may transition to CANCELLED. SHIPPED/DELIVERED/CUSTOMER_REFUSED cannot be
cancelled through the normal cancellation command.

DECISION 40:
Canonical cancellation restores redeemed Points and deducted stock exactly once when the
order is cancelled before SHIPPED. CUSTOMER_REFUSED never automatically restores stock.

DECISION 41:
FREE_SHIPPING_POINTS_THRESHOLD is a minimum points-balance eligibility threshold for
Points shipping; it is not itself a points debit. The exact shipping points debit is the
explicit configured SHIPPING_POINTS_PRICE, which may be zero for free shipping.

================================================================================
92. FINAL CANONICAL LOCK — v5.0
================================================================================

DOCUMENT STATUS:
FINAL

VERSION:
5.0.0

DOCUMENT TYPE:
SINGLE EXECUTABLE MASTER IMPLEMENTATION CONTRACT

PROJECT:
VEN+

MARKET:
EGYPT

CURRENCY:
EGP

LANGUAGES:
Arabic + English

LAYOUT:
RTL Arabic / LTR English

COMMERCIAL MODEL:
Cash + Points

FUNDING MODES:
CASH_ONLY + POINTS_ONLY + MIXED

POINTS:
ACTIVE / EXECUTABLE / LEDGERED / AUDITABLE

REFERRAL REWARD:
50 POINTS ON FIRST DELIVERED REFERRED ORDER

DELIVERY CONFIRMATION:
DELIVERED IS A MANUAL/EXPLICIT AUTHORIZED ADMIN ORDER-MANAGEMENT CONFIRMATION THAT
THE CUSTOMER ACTUALLY RECEIVED THE ORDER; NO AUTOMATIC DELIVERY EVENT MAY CREDIT
PURCHASE OR REFERRAL REWARDS WITHOUT THIS AUTHORIZED TRANSITION.

CUSTOMER CHECKOUT ADDRESS MODEL:
ONE FULL FREE-FORM TEXTAREA

ADMIN ORDER ENTRY ADDRESS MODEL:
UNCHANGED FROM ITS OWN ADMIN CONTRACT; DO NOT INFER CUSTOMER CHECKOUT FIELDS INTO ADMIN

STOCK AUTHORITY:
ProductVariant.stock

DATA AUTHORITY:
Server + Database

ORDER START STATE:
PENDING_CONFIRMATION

PRIMARY ORDER FLOW:
NONE -> PENDING_CONFIRMATION -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED

REFUSAL FLOW:
SHIPPED -> CUSTOMER_REFUSED

CHECKOUT:
TRANSACTIONAL + IDEMPOTENT

SECURITY:
SERVER-SIDE AUTHORIZATION + INPUT VALIDATION + THREAT DEFENSE

WORKFLOW:
READ -> AUDIT -> PLAN -> IMPLEMENT -> TEST -> VERIFY -> DOCUMENT -> GATE -> STOP

FINAL RULE:
When ambiguity exists, DO NOT invent a business rule. Use the explicit canonical rule
in this document. If no canonical rule exists and the ambiguity materially affects
money, points, stock, authorization, security, or persisted data, STOP and report
BLOCKED rather than silently choosing.

FINAL IMPLEMENTATION LOCK:
LOCKED FOR IMPLEMENTATION

================================================================================
END OF VEN+ CANONICAL MASTER IMPLEMENTATION SPECIFICATION — FINAL v5.0
================================================================================
