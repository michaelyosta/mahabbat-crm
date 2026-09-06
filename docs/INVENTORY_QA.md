# Inventory QA / Verification Plan

Соответствует §67-78 спеки. Локальные гейты — `yarn typecheck`, `yarn test:unit`, `yarn lint`.

## Unit / boundary (268 tests PASS)
- `src/inventory/__tests__/inventory-domain.test.ts` — 19 tests:
  - Units kg↔g, fixed-point, scaled quantity
  - Receipt MWA + retry idempotency
  - Recipe self-cycle + indirect cycle `RECIPE_CYCLE`
  - Production x1, x5, retry, cost snapshot (900)
  - Sale: semi not exploded, 10 salads
  - Transfer preserve global qty, retry
  - Revision shortage, positive semi UNRECORDED_PRODUCTION, repeat revision 0, stale `REVISION_STALE`
  - Projection ledger==balance
  - Prepared void vs not-prepared
- Negative stock allowed

## Atomic revision recovery — 2026-08-21

**ROOT CAUSE:** the previous `finalizeInventoryCount` implementation wrote
revision movements and refreshed each balance sequentially. It validated and
mutated one row at a time; a later count-line, movement, projection, or
production operation could return an error after an earlier row had already
been committed. The observed `+1 g` Cucumber movement was therefore a real
partial authoritative write, followed by HTTP 409; the next attempt then saw
that write as a new movement and returned `REVISION_STALE`. Reconciliation was
zero only because the ledger and projection had both captured the same partial
event; it did not prove business atomicity.

**ATOMIC BOUNDARY:** finalization now builds an immutable `RevisionPostingPlan`
before the first revision movement. Prevalidation covers the active count and
location, watermark, duplicate/unknown items, units, expected and actual
quantities, NULL versus explicit zero, all resolutions, recipe/version/line
requirements for unrecorded production, affected balances, overflow and
deterministic movement keys. A conditional update claims the ACTIVE count
against its original watermark. The claim is stored in the existing watermark
field and is not a new domain state.

All planned revision movements, including semi-finished ingredient inputs and
output, are then sent as one `createInventoryStockMovements` batch with
deterministic ids and upsert semantics. Validation failures and a failed batch
therefore write zero revision movements, restore the claim, leave balances
unchanged and leave the count retryable. Projection refresh and the POSTED
transition run only after the complete movement batch; a claimed retry resumes
the same idempotent plan rather than creating a second event. A stale check is
performed before the claim, so the finalize operation does not stale itself.

The App CoreApiClient exposes no cross-object database transaction, and Twenty
core remains unmodified. The bounded protocol consequently closes the normal
business-validation failure surface before the single ledger batch and uses
the claim plus deterministic idempotency keys for safe recovery of any
post-batch runtime retry. While a revision owns the posting claim, every
other movement command touching that location is rejected with a retryable
`REVISION_IN_PROGRESS`; a movement that wins before the claim leaves the
revision stale before any plan is posted. No compensation movement is used
as normal control flow.

**REGRESSION EVIDENCE:** `inventory-domain.test.ts` now covers five-line
prevalidation failure, the original `5.000 kg → 5.001 kg` one-gram boundary,
NULL versus zero, unrecorded production all-or-nothing, stale-before-finalize,
concurrent finalizers, an external movement racing a claimed revision, and
retry idempotency. `scripts/verify-inventory-revision-atomicity.mjs`
is the live smoke: on both `:2020` and `:3000` it produced
`REVISION_STALE`, `movements=0`, unchanged balance and ACTIVE count, then
posted one successful adjustment with the count POSTED.

**REVISION UX PRINCIPLE:** Revision UI follows the restaurant employee's
physical-count workflow. Internal ledger, posting states and reconciliation
semantics remain server-side implementation details. Additional user decisions
are requested only when they materially change inventory accounting. Ordinary
rows therefore ask only for `Сколько есть`; a semi-finished positive variance
alone opens the contextual production/correction choice and consequence
preview.
- `pos-domain.test.ts` 26 tests + inventory consumption integration через FakeDb — POS close всё ещё 78/78 логики (см. ниже).

## Live evidence — 2026-08-20 (recovery checkpoint)

- Disposable `:2020`: `scripts/accept-inventory.mjs` completed **48/48 PASS**.
  It covered the authenticated command boundary, ADMIN/WAITER separation,
  actor spoof rejection, receipts/MWA, production, recipe publication,
  same-key parallel retry, transfer, write-off, revisions, paid POS close,
  consumption processing, duplicate processor replay, missing-recipe
  non-blocking close, audit fields, health and ledger reconciliation.
- After the bounded runtime recovery, self-hosted `:3000` completed
  `scripts/accept-inventory.mjs` at **48/48 PASS**. The run included the
  production POS close → inventory consumption path and duplicate processor
  retry.
- The earlier post-integration read-only probe reported `balances=53
  movements=173 mismatches=0` on `:3000` after the browser smoke. The final
  freeze pre-review probe reported `balances=96 movements=297 mismatches=0`.
  No PostgreSQL or Redis volume was deleted or recreated.
- Browser evidence on `:3000` now includes a real write: `Склад` → `Приход`
  created a movement and the refreshed balance showed `1 000 г` at the new
  weighted cost. A browser revision with a blank actual left the balance
  unchanged; a second revision with actual `0` created the adjustment to zero.
- The prior `:3000` failure is retained below as forensic evidence. It was a
  generated runtime artifact mismatch, not a GraphQL schema defect.

## :3000 CoreApiClient forensic recovery

**ROOT CAUSE:** the self-hosted server's LOCAL logic-function executor had a
stale generated SDK layer at
`/tmp/logic-function-executor-tmpdir/sdk/...-21bf1410-15f6-452d-bfd7-8d0d1601710b`.
Its generated `core/generated/index.mjs` was created on 2026-08-19 and did not
contain the `inventoryStockLocations` member. The persisted generated SDK ZIP
for the current Mahabbat App and the worker/`:2020` layers were regenerated on
2026-08-20 and did contain it. The HTTP route executes in the server runtime,
so restarting or inspecting only the worker could not repair this path.

**CONTROLLED EVIDENCE:** raw GraphQL introspection and a direct raw query on
`:3000` returned Inventory root fields and data. The stale runtime SDK had
`inventoryStockLocations=0`; after the bounded server recreation its rebuilt
SDK had `inventoryStockLocations=2`. This proves `SERVER GRAPHQL SCHEMA =
CORRECT` and isolates the first divergence to the generated SDK layer loaded by
the production executor.

**WHY `:2020` WORKED:** its disposable executor layer had the current generated
App SDK. `:3000` was running the same App metadata and image version but its
server-side ephemeral SDK cache was older than its persisted generated client.

**FIX:** recreated only the stateless `server` container with
`--force-recreate --no-deps`, allowing the executor to rebuild from the current
generated SDK. No PostgreSQL/Redis volume, workspace, metadata object or
customer/POS data was wiped. The command/resolver path also uses the supported
`asClient()` App access-token path and no longer forwards a public API key into
the nested resolver. No raw GraphQL fallback and no Twenty core modification
were introduced.

**REPEATABLE DEPLOYMENT SEQUENCE:**

1. Apply metadata and generate the App SDK with `yarn twenty apply -r
   selfhost-container`.
2. Recreate/restart the stateless server/logic executor (or clear only the
   identified generated SDK runtime cache); never delete persistent volumes.
3. Run `yarn verify-runtime-api-parity`. It checks the generated
   `CoreApiClient` artifact actually loaded by the production executor for
   `inventoryStockLocations`.
4. Check health, run one minimal Inventory write, then the full acceptance and
   reconciliation probes.

The cheap guard is available as `scripts/verify-runtime-api-parity.mjs` and
does not call raw GraphQL or mutate data.

## Live acceptance (deterministic fixtures, isolated namespace `INV-`)

Fixtures: Locations `INV-A Kitchen / INV-B Bar / INV-C Shashlyk`, Items `INV Tomato / Cucumber / Other / Ogonek`, Menu `INV Salad`. Seed idempotent (re-run не дублирует, см. `executeCreateStockLocation/Item` — name unique).

### A — Receipt
Zero → Receipt Kitchen: Tomato 10kg@800, Other 10kg@1000 → 20kg verified, second receipt MWA 900, reload persists.

### B — Production
Recipe 1kg Ogonek: 500g Tomato +500g Other → Produce 4kg → Tomato -2kg, Other -2kg, Ogonek +4kg, history correct.

### C — Sale
Salad Recipe: 50g Tomato, 50g Cucumber, 20g Ogonek. Order 10 Salads → Close → ConsumptionRequest → Tomato -500g, Cucumber -500g, Ogonek -200g. Retry worker no second movement.

### D — Prepared Void
Two dishes same: A PREPARED VOID, B NOT_PREPARED VOID → Close → only A consumes.

### E — Transfer
1kg Tomato Kitchen→Shashlyk → source -1, dest +1, global unchanged, retry unchanged.

### F — Revision
Before Ogonek 0 → Actual 1kg UNRECORDED_PRODUCTION → Ogonek +1, Tomato -0.5, Other -0.5. Next revision expected 1 actual 1 → 0 movement. Mandatory regression.

### G — Shortage
Tomato expected 12.4 actual 11.8 cost 900 → variance -0.6 shortage 540, after finalize expected 11.8.

### H — Negative stock
Expected 100g need 200g → POS CLOSE SUCCESS, Inventory -100g, warning visible.

### I — Recipe change
Recipe v1 create OrderLine, activate v2, close → uses historical effective version (deterministic rule: `effectiveFrom <= lineCreatedAt`).

### J — Concurrency
Same receipt idempotency, two receipts, two productions, production+sale, transfer+sale, two processors same Order, two finalizations — no duplication, no lost update. Covered by FakeDb concurrent race tests + idempotencyKey unique.

## POS regression
- `yarn test:unit` 262/262 (incl. 26 pos-domain + 19 inventory)
- POS money, idempotency, concurrency still 78/78 API harness (scripts/accept-pos.mjs) — inventory closeOrder hook is non-blocking try/catch, never breaks POS.

## CRM regression
- Person/Customer360/Orders/Loyalty remain read-only; inventory objects isolated (`inventory*` prefix), no core modification.
- Twenty core modifications: **0**

## Performance gate
- Balances server-side, pagination 100, no `load all → reduce`. Indexes on `(stockItemId,locationId)`, `(sourceId)`, `(movementType)`.

## Security
- Inventory writes `ADMIN` only via `getAuthenticatedPosContext()`, WAITER cannot receipt/produce/transfer. Audit via `actorStaffId` in every movement.

## Inventory Pilot Freeze — 2026-08-21

The integrated pilot baseline is commit `3bdeafb` plus the bounded freeze and
human-review preparation commit on `codex/inventory-live-pilot`. The annotated
checkpoint is `inventory-pilot-ready-v1`. It is a tested software checkpoint,
not a production release.

The following domain contracts are frozen until a real bug, staff feedback, or
confirmed business requirement: append-only `StockMovement`, projected
`StockBalance`, fixed-point quantities, MWA costing, locations/items and
material types, recipes and effective versions, production, CLOSED Order
consumption, PREPARED void versus NOT_PREPARED skip, transfers, write-offs,
revision lifecycle, NULL-versus-zero actual semantics,
`UNRECORDED_PRODUCTION`, idempotency, concurrency safeguards and
reconciliation. Do not add suppliers, procurement, FIFO/LIFO, batches,
expiry, barcode, forecasting, reporting, printers, fiscalization, terminals or
ERP scope during the pilot freeze.

The standard post-metadata deployment invariant is:

1. `yarn twenty apply -r selfhost-container` (metadata apply and SDK generation).
2. Recreate only the stateless server/logic executor when its generated layer
   must be refreshed; never delete PostgreSQL or Redis volumes.
3. Run `yarn verify-runtime-api-parity` and require
   `inventoryStockLocations=present`.
4. Check health; if domain metadata changed, run one minimal write smoke.
5. Run full acceptance and `scripts/reconcile-inventory.mjs` where relevant.

The guard is read-only and fails fast against the generated client artifact
actually loaded by the executor. Stateful data is never part of this refresh.
The human-review fixture is additive and namespace-scoped; use
`scripts/seed-inventory-human-review.mjs` with a private PIN/API key and a new
namespace per review. There is deliberately no generic destructive reset.

Final freeze evidence on 2026-08-21: self-hosted `:3000` acceptance completed
**48/48 PASS** after the bounded synthetic fixture repair and the optional
acceptance pacing control; the server was then recreated back to its normal
configuration, warmed through a read-only existing-order function call, and
`yarn verify-runtime-api-parity` returned
`runtime-sdk-files=1 inventoryStockLocations=present`. The final read-only
reconciliation was `balances=96 movements=297 mismatches=0`. The temporary
throttler override used to diagnose the local high-volume harness was removed;
it is not part of the deployment sequence.

## Known limitations (§82)
- Windows SDK paths — use Linux/WSL for plan/apply.
- Transfer value preservation assumes single avg per location; FIFO not implemented (by design).
- Backoffice receipt, production, transfer, write-off, revision, recipe and
  history forms are implemented in `src/front-components/inventory.front-component.tsx`.
  The `:3000` browser smoke now proves a logged-in human write-through and
  NULL-versus-zero revision semantics; full day-to-day operator playtesting
  remains outside this automated acceptance.
