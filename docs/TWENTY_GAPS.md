# Twenty gaps

No Twenty architectural gap has been established.

## Development-environment limitation (not an architectural blocker)

Native Windows `twenty-sdk@2.29.0` emits backslashes in front-component paths,
which Twenty correctly rejects as unsafe. The same App manifest builds under a
Linux Node 24 Docker CLI environment and has been applied successfully to the
same pinned Twenty `v2.29.0` App server. Standardise App development on
Linux/WSL; do not patch Twenty core or SDK as part of Mahabbat.

## SDK limitation: strict database-level ledger immutability

Twenty `v2.29.0` roles do not expose a create-only record permission or a
pre-write hook. The App currently uses a non-assignable read-only function role,
a staff role with ledger writes denied, and `isUIEditable/isUICreatable: false`.
A future controlled App logic-function writer must own ledger creation and its
idempotency. No Twenty core modification is required for the foundation.

## Standard-object composite indexes (controlled limitation)

In `twenty-sdk@2.29.0`, `defineIndex` on a standard object such as Person is
accepted by the client but the server manifest builder cannot resolve that
object from the App manifest map. A composite Person index therefore fails at
plan time. Custom objects (Order and Reservation) support the same composite
index normally. Mahabbat uses the bounded workaround: a unique,
server-controlled `externalIdentityKey` field on Person containing
`PROVIDER::externalId`. This is an SDK/platform limitation, not a core fork or
a foundation blocker; the single-field uniqueness side effect is a bounded
v2.29.0 workaround and should be re-evaluated on a future Twenty upgrade. If
that primitive is removed, use a custom `CustomerExternalIdentity` registry
object rather than changing Twenty core.

## Standard Person navigation label (non-blocking)

An App `OBJECT` navigation item targeting standard Person renders the native
`People` object label and ignores the App item name. A trial App-owned `VIEW`
for standard Person was rejected during v2.29.0 sync because the referenced
view was not resolved. The current workaround is the native People list plus
the existing Customer 360 record tab; no core change or duplicate navigation
item is kept.

## Custom view navigation validation (non-blocking)

App-defined TABLE views for custom `Order` and `LoyaltyLedgerEntry` objects are
installed and usable through the native object view picker. Switching the App
navigation items to `NavigationMenuItemType.VIEW` was rejected by the pinned
Twenty `v2.29.0` server with `INVALID_NAVIGATION_MENU_ITEM_INPUT` even after the
views were installed. Mahabbat keeps native object navigation and documents the
view-picker path; this does not block the product shell and requires no core
change.

The workspace switcher title is workspace metadata rather than App metadata;
the existing `Mahabbat` label remains. Renaming it would be a workspace-level
operation outside this bounded shell slice, not a reason to modify Twenty core.

## Hardcoded browser branding (bounded deployment overlay)

Twenty `v2.29.0` exposes workspace branding only as `displayName` and `logo`
metadata. Browser tab titles, meta/Open Graph descriptions and the PWA manifest
are hardcoded in the upstream front shell. The self-hosted demo uses a thin
`mahabbat-branding.Dockerfile` overlay on the exact
`twentycrm/twenty:v2.29.0` image to patch only the deployment HTML, PWA
manifest and compiled runtime title. The upstream source tree remains
unchanged, so the backend, security model, database schema, SDK identifiers
and runtime stay intact; this is not a Twenty fork.

Residuals kept out of this diff: PWA and pre-hydration icons still ship the
upstream Twenty PNG set, the auth footer and 404 copy still say "Twenty",
timeline events without a workspace member still show "Twenty" as the system
author, and the import preview badge still renders
`/images/integrations/twenty-logo.svg`. The favicon can already be replaced
through workspace metadata by uploading a Mahabbat logo in Settings; the other
residuals need app-owned copy/icon assets or a broader upstream copy patch.
