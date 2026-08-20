# Inventory QA / Verification Plan

Соответствует §67-78 спеки. Локальные гейты — `yarn typecheck`, `yarn test:unit`, `yarn lint`.

## Unit / boundary (262 tests PASS)
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
- `pos-domain.test.ts` 26 tests + inventory consumption integration через FakeDb — POS close всё ещё 78/78 логики (см. ниже).

## Live evidence — 2026-08-20

- Disposable `:2020`: `scripts/accept-inventory.mjs` completed **48/48 PASS**.
  It covered the authenticated command boundary, ADMIN/WAITER separation,
  actor spoof rejection, receipts/MWA, production, recipe publication,
  same-key parallel retry, transfer, write-off, revisions, paid POS close,
  consumption processing, duplicate processor replay, missing-recipe
  non-blocking close, audit fields, health and ledger reconciliation.
- `scripts/reconcile-inventory.mjs` reported `balances=23 movements=79
  mismatches=0` on `:2020` and `balances=0 movements=0 mismatches=0` on
  `:3000`.
- Browser evidence on self-hosted `:3000` confirmed the `Склад` navigation
  entry, PIN gate, all eight operational tabs and the receipt form without
  performing a write. This is UI-surface evidence, not a successful manual
  mutation proof.
- The self-hosted `:3000` live command harness is **BLOCKED**, not promoted to
  PASS: the deployed route reaches the resolver, but `CoreApiClient` inside
  the production logic-function sandbox rejects the Inventory query while a
  raw GraphQL probe from the same resolver path sees the schema. This is an
  environment/runtime boundary and must be fixed before declaring the live
  pilot PASS on both targets.

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

## Known limitations (§82)
- Windows SDK paths — use Linux/WSL for plan/apply.
- Transfer value preservation assumes single avg per location; FIFO not implemented (by design).
- Backoffice receipt, production, transfer, write-off, revision, recipe and
  history forms are implemented in `src/front-components/inventory.front-component.tsx`.
  A logged-in human write-through remains pending; current browser evidence
  covers the rendered controls and the API harness covers the command/data
  plane.
