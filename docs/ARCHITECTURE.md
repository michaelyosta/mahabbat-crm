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

The foundation does not implement POS entities or operations. The expected POS
model (order identity, zones/tables, payments, fiscalisation, server commands)
and its invariants are documented in `docs/POS_BOUNDARY.md`; they are not built
before an explicit `MAHABBAT POS DOMAIN DISCOVERY` phase.
