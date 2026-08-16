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
