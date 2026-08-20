# Twenty gaps

No Twenty architectural gap has been established.

## Development-environment limitation (not an architectural blocker)

Native Windows `twenty-sdk@2.29.0` emits backslashes in front-component paths,
which Twenty correctly rejects as unsafe. The same App manifest builds under a
Linux Node 24 Docker CLI environment and has been applied successfully to the
same pinned Twenty `v2.29.0` App server. Standardise App development on
Linux/WSL; do not patch Twenty core or SDK as part of Mahabbat.

## POS canvas chrome (bounded UI limitation)

Twenty v2.29.0 renders App page layouts inside its native navigation/header
shell. The Front Component sandbox does not expose a supported way to hide that
shell or enter browser fullscreen reliably. Mahabbat therefore fills the
available App canvas and supports Twenty's native collapsed-navigation mode;
it does not patch core for kiosk chrome removal. This is a bounded presentation
limitation, not a POS/domain blocker and not a Twenty core modification.

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

## SDK does not reconciliate objectPermissions for existing roles (v2.29.0)

`twenty-sdk@2.29.0` resolves manifest role/object metadata for a **fresh
install** but a `plan`/`apply` cycle on an existing workspace leaves persisted
`core.objectPermission` rows untouched, so a role manifest change does not
converge a live install. This is the reason a stale self-hosted `:3000` role
once allowed Mahabbat Staff to destroy records until a documented corrective SQL
run rewrote the rows to the manifest values (`docs/OPERATIONS.md` runbook,
`docs/QA.md`). Platform limitation, not a Mahabbat core change; re-evaluate on a
future Twenty upgrade.

## RBAC live-session verification gap (v2.29.0 headless, app-mode)

This remains a Twenty CRM/backoffice limitation, not a POS identity contract.
Mahabbat POS now uses its own `PosStaff` + short-lived `PosSession` boundary;
`WorkspaceMember` and `TWENTY_APP_ACCESS_TOKEN` are deliberately not used as
operational waiter identity. The POS pilot still relies on the outer route's
Twenty authentication to reach the App, so this gap must be revisited before an
Internet production deployment.

In these environments the product `/graphql` surface serves only the app/core
schema from the server build with the core AuthResolver module **not mounted**:
none of `signIn`, `signInWithCredentials`, `login`, `verifyEmailAndGetLoginToken`,
`generateApiKeyToken` is reachable, and `/admin-panel/graphql` and
`/metadata/graphql` return 404 on self-hosted `:3000`. A real non-admin user
session therefore cannot be minted through any supported headless product path.
API-key authentication executes with workspace-admin capabilities in this build
(verified live on `:2020` even when the key's `roleTarget` is rebound to a
restricted role), so it is not valid evidence for role-RBAC behavior. The Staff
destructive deny is verified at the manifest, persisted-permission-row and
executable-test level plus an FK `RESTRICT` structural safeguard for Person with
related Orders; a live Staff-context runtime denial remains a documented
verification limitation, not fabricated PASS evidence. Re-evaluate on a future
Twenty upgrade or when the core AuthResolver module is mounted in the App server
build.

## REST cursor pagination does not advance beyond one page (v2.29.0)

`GET /rest/<object>?limit=N&starting_after=<cursor>` in self-hosted v2.29.0 does
not advance across pages once a collection exceeds `N` (the same `endCursor` is
returned and `hasNextPage` stays true). Collections below one page behave
normally, which is why the deterministic seed loop worked earlier. The product
front end uses GraphQL cursor pagination which is implemented correctly, and
Mahabbat reads today stay within supported sizes; for large REST reads use
GraphQL pagination or page with filters until a Twenty upgrade fixes the REST
cursor.
