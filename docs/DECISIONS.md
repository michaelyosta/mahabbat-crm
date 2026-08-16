# Decisions

## 2026-08-09 — Customer uses standard Person

Use Twenty Person rather than duplicate Customer. It retains built-in contact,
activity and attachment behaviour while custom fields and reverse relations add
restaurant data.

## 2026-08-09 — Keep Twenty unmodified

The Foundation targets Twenty `v2.29.0` through the Apps SDK. No Twenty core file
has been changed. A Windows SDK path issue is tracked separately, not solved by a
fork.

## 2026-08-09 — License checkpoint

Twenty `v2.29.0` is AGPL-3.0. Mahabbat App source is our separate code. Foundation
development is not blocked; commercial closed distribution needs legal review
before release.

## 2026-08-09 — Loyalty write boundary

The generic UI hides ledger creation and editing. The Mahabbat Staff role can
read ledger entries but cannot write or delete them; it can edit People, Orders,
OrderItems and Reservations. The App function role is currently read-only.
Twenty has no separate create permission or pre-write hook, so a fully controlled
ledger writer will be an explicit app logic-function slice rather than a claim of
database-level immutability.

## 2026-08-09 — Linux/WSL is the Apps SDK development path

The same pinned app manifest plans and applies under Linux Node 24. Native
Windows path separators are therefore a developer-environment limitation, not a
reason to fork Twenty or Apps SDK. The disposable App container may use a local
higher API rate limit for deterministic seed work; ordinary self-hosted defaults
remain unchanged.

## 2026-08-09 — GO: Twenty + Mahabbat App is the architectural base

The unchanged Mahabbat App installed and ran on ordinary self-hosted Twenty
`v2.29.0` at `:3000`: custom objects, Person relations, roles, navigation,
Customer 360, API seed and persistence all worked without a core change.

Foundation score (0–5): custom objects 5; relations 5; Person extensibility 5;
permissions 4; page layouts 5; custom UI 5; logic functions 3 (available, but
the controlled writer is the next slice); API 5; self-hosted App compatibility
5; developer experience 4; testing/debugging 4; upgrade isolation 5; core
modification 5. The remaining scores are product work, not a platform NO-GO.
## 2026-08-09 — P0 loyalty processor boundary

The write path is a database-event processor, not a generic ledger mutation:
`LoyaltyAdjustmentRequest` is the employee-facing intent and
`LoyaltyLedgerEntry` is append-only history. A unique physical relation from
ledger to request (`sourceRequestId`) plus the request idempotency-key index
enforces exactly-once under retries and races. If a ledger exists while the
request is still pending, the processor reconciles the request from the ledger
snapshot. Any later request rewrite is repaired to that snapshot.

Manual corrections may produce a negative computed balance; this is accepted for
the foundation because the ledger remains the source of truth. Zero, malformed,
out-of-range, missing-customer and idempotency-collision inputs are rejected.

The ordinary self-hosted worker runs the same App with `LOGIC_FUNCTION_TYPE=LOCAL`
and an internal `SERVER_URL=http://server:3000`. This is an operational
requirement for the local proof, not a Twenty core modification.

## 2026-08-09 — P0 route and recovery hardening

Generic Staff writes to loyalty adjustment requests are disabled. The UI calls
an authenticated App HTTP route that validates the four allowed input values and
creates the request with server-owned defaults. Field permissions make both the
request and ledger read-only for Staff; the App function role is the only
controlled writer.

The database-event processor and a five-minute cron backstop call one shared
idempotent helper. A unique ledger relation to `sourceRequestId` remains the
authoritative exactly-once boundary; an existing ledger repairs a stale request,
and a foreign idempotency-key race is rejected. This closes the crash window
without changing Twenty core.

## 2026-08-09 — Authenticated route with app-only resolver

The employee-facing `/s/loyalty/adjustments` route authenticates and validates
the request, but does not rely on the intersected employee/App role to perform a
write. Twenty resolves an authenticated route with the user's role context,
which would conflict with the intentionally read-only Mahabbat Staff request
and ledger permissions. The route therefore delegates to a dedicated server
resolver through Twenty's server webhook endpoint.

The resolver verifies an HMAC over the canonical request body and executes with
the app-only function role. This keeps direct Staff ledger CRUD disabled while
preserving an authenticated UI boundary. `MAHABBAT_INTERNAL_ROUTE_SECRET` is a
required server variable and must be supplied and rotated by deployment secret
management. The split was verified on disposable `:2020` and self-hosted
`:3000`; it required no Twenty core or Apps SDK source modification.

## 2026-08-09 - Sandbox-safe loyalty action

The Customer 360 write control uses Twenty's imperative front-component pattern:
`button type="button" onClick={handler}`. The initial diagnostic proved that
click, handler and validation ran, but `crypto.randomUUID()` failed in the
sandbox before the saving state and HTTP request. The App now creates UUID-v4
idempotency keys with `crypto.getRandomValues` when available and a local
fallback, without changing the backend, security boundary or Twenty core. All
temporary debug hooks were removed after the disposable and `:3000` UI checks.

## 2026-08-09 - Customer external identity contract

Phone is a lookup aid, not an identity. External records use a canonical
`provider + externalId` pair: providers are trimmed/uppercased machine codes,
external IDs are trimmed while preserving source case, and malformed values
are rejected. The canonical key is `PROVIDER::externalId`.

For a matched identity, source-owned fields may update; protected/local fields
produce an explicit conflict; equal values are a no-op; undefined values are
ignored. A retry therefore cannot create a second logical record, and a
concurrent create race is recovered by re-reading the unique record.

Twenty v2.29.0 cannot plan a composite `defineIndex` whose object is the
standard Person because standard objects are absent from the App manifest map.
The bounded workaround is a server-controlled unique TEXT field
`externalIdentityKey` on Person containing the canonical key. Order and
Reservation keep their native composite provider/externalId indexes. These
fields are non-editable in the UI and Mahabbat Staff field permissions deny
updates; deployment API keys are intentionally outside that Staff boundary.
No core or Apps SDK source was modified.
If a future Twenty release removes the single-field uniqueness primitive, the
fallback is a custom `CustomerExternalIdentity` registry object with a native
composite index, not a core fork.

## 2026-08-09 - Aggregate sales is not operational orders

The April-June 2026 workbook is an aggregate monthly report for warehouse
`Бар`, not receipt-level transactions. It must never seed Order or OrderItem.
The future import stores a report/snapshot identity plus aggregate lines,
preserves the raw item name, keeps decimal quantities and zero-revenue rows,
and uses a non-destructive candidate-match flag for possible MenuItem links.
Repeated imports upsert by a stable report/period/warehouse/item-line identity;
conflicting names are retained separately rather than fuzzy-merged.

## 2026-08-09 - Native Orders UX before custom composer

The first Demo-ready Orders slice stays on Twenty's native list/detail CRUD:
the existing customer and OrderItem relations, select-based status editing and
money fields are usable in the browser. Deterministic demo Orders set the
built-in `name` to their stable external ID so list and record titles are
meaningful. Seed reconciliation fills only missing names and preserves any
non-empty user value. A custom Order composer and aggregate import remain
separate follow-up slices.

## 2026-08-09 - Bounded aggregate snapshot object

The first aggregate-sales implementation is a flat `SalesSnapshotLine` custom
object rather than a snapshot hierarchy or universal import framework. Its
server-controlled unique `externalIdentityKey` is built from provider, report,
period, warehouse, item identity and source row. Source item names are retained
after Unicode NFKC normalization without collapsing internal whitespace;
near-duplicates are never fuzzy merged.
The object is read-only in the generic UI and contains no relation to `Order` or
`OrderItem`, so an aggregate report cannot distort Customer 360.

Twenty v2.29.0 accepts fractional quantity through `NUMBER` with FLOAT settings,
not `NUMERIC`, and its REST transport requires a JSON number. The import
contract therefore keeps quantity as a decimal string until this transport
boundary; money is sent as KZT Currency micro-units. Synthetic repeat and
concurrent smoke passed on both pinned environments with three unique lines and
no operational Order changes. The private workbook adapter remains separate.

## 2026-08-09 - Private workbook adapter verified

The user-provided workbook is consumed in place by a thin `openpyxl` adapter;
the original file is mounted read-only and is not copied into Git. Three
monthly sheets yielded 382 product lines after excluding `Итого:` totals. The
adapter preserves source names, maps fractional quantities through the known
Twenty `NUMBER/FLOAT` JSON boundary, rounds monetary values explicitly to KZT
micro-units, and keeps the stable report/period/warehouse/item/row identity.

On both disposable `:2020` and self-hosted `:3000`, the first load created 382
aggregate lines. The immediate rerun reported `created=0`, `updated=0` and
`conflicts=0`; the operational Order count stayed 74. This proves the real
workbook can bootstrap historical aggregate data without fabricating orders.

## 2026-08-09 - Native Dashboard before custom analytics

The first useful Dashboard stays within Twenty's native page-layout extension:
one `STANDALONE_PAGE` with graph widgets and one navigation item. Historical
metrics (revenue, quantity, top products and monthly trend) query the bounded
`SalesSnapshotLine` object; operational order total and status counts query
`Order`. This gives a demo-ready read surface without a new backend, custom
analytics framework or visual redesign, while preserving the hard boundary
between aggregate history and receipt-level operations.

## 2026-08-09 - Reservations view through the native object surface

Reservations use the native object navigation plus a bounded App-defined table
view `Ближайшие бронирования`: future-only filter, ascending reservation time,
and the fields a host needs to act. Twenty v2.29.0 rejected a direct navigation
item pointing at this custom view during server validation, even after the view
was installed. The view picker is the supported working path, so no core change
or workaround navigation code was added.

## 2026-08-09 - First segment is a dynamic native view

The first business segment is intentionally a view, not a premature campaign
engine: `Не возвращались 30 дней` applies a `NOT(PAST_30_DAY)` relative filter
to the existing server-controlled `lastActivityAt` field on Person. The same
view is available on disposable and self-hosted Twenty, remains recalculated as
time moves, and exposes enough identity/status context for a later follow-up
workflow.

## 2026-08-09 - Mahabbat-first navigation without a core fork

Mahabbat navigation uses App-owned negative positions so `Главная`, `Заказы`,
`Бронирования` and `Лояльность` are the first user path and the root resolves to
the Dashboard. Orders and Loyalty have bounded App-defined TABLE views that
exclude technical/system columns. A direct `NavigationMenuItemType.VIEW` switch
was attempted after installing the views but Twenty v2.29.0 rejected the
navigation manifest with `INVALID_NAVIGATION_MENU_ITEM_INPUT`; the native object
items plus view picker are therefore the supported compromise. Generic standard
navigation cannot be hidden through App metadata. No Twenty core files changed.

## 2026-08-10 - MAHABBAT browser branding through a pinned-image overlay

The share-card metadata and browser default title are user-visible deployment
surface, not App SDK metadata. The self-hosted demo derives a thin image from
the exact `twentycrm/twenty:v2.29.0` image and patches only deployment HTML,
manifest and the compiled default page-title literal. This keeps Twenty core,
backend/domain logic, permissions and the database unchanged.
The upstream social-card image is intentionally removed so link previews do
not identify the product as Twenty. Internal package names and non-demo-only
legal/auth/404 copy remain unchanged until an app-owned asset or a separately
bounded copy pass is justified.
