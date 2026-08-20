# Architecture

Mahabbat is a separate Twenty App pinned to `2.29.0`; the upstream Twenty source
checkout is not modified. Standard `Person` is the customer aggregate.

Custom objects are `Order`, `OrderItem`, `Reservation`, `LoyaltyLedgerEntry`, and
the read-only aggregate `SalesSnapshotLine`. The operational objects relate to
Person; items relate to Order; ledger entries may relate to an Order. Aggregate
lines deliberately have no operational-order relation. Monetary fields use
Twenty Currency values. Loyalty is append-only; balance must be computed or
safely materialised from entries.

The local disposable app server is `http://localhost:2020`. Run the Apps SDK
workflow in Linux (WSL or a Node 24 Docker CLI container) against that server.
The separately provisioned ordinary self-hosted instance is `http://localhost:3000`;
it is not a deployment target until a user-managed API credential is available.

## Identity and imports

External identity is `provider + externalId`; phone normalization is separate
and only supports customer lookup. Person stores the canonical key in a unique,
server-controlled `externalIdentityKey` because Twenty v2.29.0 cannot resolve a
composite App index over a standard object. Order and Reservation use native
composite provider/externalId indexes. Import updates are source-owned only;
protected/local differences become conflicts, and unique-create races are
re-read before deciding retry/noop/update.

Aggregate historical sales from monthly warehouse reports is a separate model
from operational orders. It preserves raw item names, decimal quantities,
zero-revenue rows and explicit candidate matching; it never fabricates Orders.

The first Dashboard is also an App extension: a native standalone page layout
with graph widgets. Historical widgets read `SalesSnapshotLine`, while order
totals and status counts read `Order`; the dashboard does not merge these
datasets into a synthetic operational history.

## PRE-POS hardening state

- Loyalty balance in Customer 360 is computed from the **full ledger** through
  cursor pagination (`first:100` + `after`), not from a truncated first page;
  the ledger remains the source of truth.
- `Person.lastActivityAt` is maintained by a server-side logic function using
  **atomic guarded conditional updates** (`updatePeople` with
  `lastActivityAt: { is: 'NULL' }` / `{ lt: candidate }` filters — single-statement
  `UPDATE ... WHERE`). Stored activity can only move forward; concurrent older
  events cannot overwrite a newer value. See `docs/QA.md` for the live race
  experiment and `docs/DECISIONS.md` for its exact semantics.
- Mahabbat Staff cannot soft-delete or destroy Person, Order, OrderItem or
  Reservation records; ledger/request surfaces remain read-only for Staff.
- CI is pinned (`TWENTY_VERSION: v2.29.0`, Twenty action at a fixed commit).
  CD binds the production URL and credential to one GitHub Environment; no
  operator-entered URL is accepted. npm distribution is frozen by a fail-closed
  workflow gate (see `docs/DISTRIBUTION_DECISION.md`).
- Destructive integration-test setup is fail-closed (disposable-target
  allowlist), and the branding overlay fails the build when a target literal is
  missing.

## POS boundary

POS is a separate operational layer on `pos*` custom objects, not an extension
of the CRM `Order`. Slices 1–5 implement `PosShift`, `PosZone`, `PosTable`,
`PosOrder`, `PosOrderGuest`, `PosOrderLine`, `PosMenuItem`, `PosStopListEntry`,
`PosKitchenTicket`, `PosKitchenTicketLine`, `PosPrecheck`, `PosPaymentMethod`,
`PosPayment`, `PosReservation`, `PosPrepayment` and the operational identity objects
`PosStaff`/`PosSession`. Mutations go through the signed `/pos/command` route
and server dispatcher; generic waiter CRUD is read-only. POS money uses Twenty
Currency micro-units, and CRM Orders/OrderItems remain untouched.

POS authentication is independent from Twenty WorkspaceMember authentication:
`authenticatePosStaff` verifies a scrypt PIN/card against `PosStaff`, issues a
short-lived session whose token hash is stored in `PosSession`, and every later
command resolves actor staff/role from that session. `TWENTY_APP_ACCESS_TOKEN`
remains only the service credential used by the resolver to access the Twenty
data plane.

Slice 6 реализует ADMIN-only void/transfer commands и bounded append-only
`PosOperationalEvent` audit. Generic UI не может менять ownership/table/guest или
физически удалить line; отправленная на кухню отмена создаёт immutable
`CANCELLATION` ticket.
Slice 2 kitchen output and Slice 3 precheck output
are immutable snapshots using mock adapters. Slice 4 payments stop at
server-authoritative CASH/CARD/OTHER records and close-at-zero, without fiscal,
refund or bank-terminal semantics. Slice 5 reservations keep overdue as derived
state, while prepayments are immutable and applied exactly once into remaining.
Slice 6 voids lines without deletion and records transfer/void actors in the
audit object; physical printer routing remains an adapter boundary.
Physical printer routing is not claimed. The
complete boundary and sequence are documented in `docs/POS_BOUNDARY.md` and
`docs/POS_DOMAIN.md`. Twenty v2.29.0's App event still does not expose a member
identity, so outer route authentication and the Mahabbat POS session are
deliberately separate layers. The POS session is a pilot operational boundary,
not a claim that Twenty's outer API-key route is a full Internet auth platform.

## POS Slice 7 UI surface

The operational POS is a standalone Twenty page layout (`Касса`) hosting the
Mahabbat front component in `src/front-components/pos.front-component.tsx`.
It is not implemented through generic Twenty CRUD: after the user opens the
page, the component authenticates a POS PIN through `/s/pos/command`, reads
POS objects through the authenticated REST data plane, and sends every
mutation back through the signed command boundary. The short-lived POS token
exists only in React memory and is cleared on logout.

The UI is a touch-oriented client of the existing domain, not a second source
of truth. Server commands still derive actor/role, recalculate money, enforce
locks/ownership and perform idempotent writes. The file in `prototypes/` is
reference material for layout and labels only; it is not part of the App
manifest. The read-only demo role has POS operational read permissions but
excludes `PosStaff`/`PosSession`, so PIN hashes and session records are not
exposed to browser reads.

## POS product/UX workspace

The POS front component is intentionally a presentation layer over the same
command/read boundaries. `pos.front-component.tsx` composes the shell, zone
navigation, table board, menu browser and persistent order panel; pure money,
state and error-display helpers live in `pos-ui.helpers.ts`, while the isolated
dark/touch visual language lives in `pos-ui.styles.ts`. Payment, reservation,
stop-list and ADMIN workflows are sheets, not separate generic Twenty records.

The component measures the available Twenty canvas and sets its own height so
the page document does not become the POS scroll surface. This is a bounded
presentation adaptation: no server/domain rules, permissions or command
payloads changed. A 12-second read polling interval is the bounded shared-state
refresh mechanism; the server remains authoritative.

## Inventory ledger and backoffice boundary

Inventory writes are not generic CRUD mutations. The `Склад` front component
authenticates a short-lived POS staff session by PIN, reads balances,
movements, items and locations through the REST data plane, and sends
mutations to the signed `/inventory/command` gateway. The server resolver
derives the staff actor from the session; client-provided actor, role and
audit fields are rejected. `WAITER` is read-only for Inventory commands;
master-data and stock-changing commands require `ADMIN`.

`inventoryStockMovements` is the append-only ledger. `inventoryStockBalances`
is a materialised projection guarded by a version predicate and bounded retry,
then checked by `scripts/reconcile-inventory.mjs`. Movement idempotency keys
and the guarded balance update make retries and same-key races converge;
receipt costing uses fixed-point micro-units and a moving weighted average.
Recipe versions are effective-dated, and POS close creates a non-blocking
consumption request whose processor records sale movements or an auditable
issue (`MISSING_RECIPE`, `INSUFFICIENT_STOCK`, or location/recipe failure).

The domain and metadata are App-only; Twenty core source modifications remain
`0`. Both the disposable `:2020` and self-hosted `:3000` command/runtime
proofs are 48/48 PASS. The previous `:3000` failure was isolated to a stale
generated SDK layer in the server's LOCAL logic-function executor: raw GraphQL
had the Inventory schema, while the loaded `CoreApiClient` artifact did not.
Recreating only that stateless server runtime rebuilt the SDK from the current
App-generated ZIP. `scripts/verify-runtime-api-parity.mjs` guards the exact
runtime artifact; persistent data is not part of the recovery sequence.
