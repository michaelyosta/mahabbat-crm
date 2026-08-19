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
of the CRM `Order`. Slices 1–3 implement `PosShift`, `PosZone`, `PosTable`,
`PosOrder`, `PosOrderGuest`, `PosOrderLine`, `PosMenuItem`, `PosStopListEntry`,
`PosKitchenTicket`, `PosKitchenTicketLine` and the operational identity objects
`PosStaff`/`PosSession`. Mutations go through the signed `/pos/command` route
and server dispatcher; generic waiter CRUD is read-only. POS money uses Twenty
Currency micro-units, and CRM Orders/OrderItems remain untouched.

POS authentication is independent from Twenty WorkspaceMember authentication:
`authenticatePosStaff` verifies a scrypt PIN/card against `PosStaff`, issues a
short-lived session whose token hash is stored in `PosSession`, and every later
command resolves actor staff/role from that session. `TWENTY_APP_ACCESS_TOKEN`
remains only the service credential used by the resolver to access the Twenty
data plane.

Payments, reservations/prepayments, voids, transfers and append-only
operational audit remain explicitly deferred. Slice 2 kitchen output and Slice 3
precheck output are immutable snapshots using mock adapters; physical printer
routing is not claimed. The
complete boundary and sequence are documented in `docs/POS_BOUNDARY.md` and
`docs/POS_DOMAIN.md`. Twenty v2.29.0's App event still does not expose a member
identity, so outer route authentication and the Mahabbat POS session are
deliberately separate layers. The POS session is a pilot operational boundary,
not a claim that Twenty's outer API-key route is a full Internet auth platform.
