# Code map

Этот файл — навигатор по реальному Mahabbat App. Twenty core находится вне
этого репозитория; здесь нет второго копирования его исходников.

## Ingestion и Customer Identity

`raw phone/import` → `normalize` → `identity lookup` → `upsert` → `Person`:

1. `scripts/seed-demo.mjs`, `scripts/identity-import-smoke.mjs` и будущие
   adapters формируют входную запись.
2. `src/identity/customer-import.ts:normalizeCustomerImportRecord` вызывает
   `src/utils/kz-phone.ts:normalizeKzPhone`. Результат — canonical
   `7XXXXXXXXXX`; невалидный/неоднозначный номер отклоняется.
3. `src/identity/external-identity.ts:parseIdentity` и
   `normalizeExternalIdentity` канонизируют `provider + externalId` в
   `PROVIDER::externalId`.
4. `src/identity/identity-importer.ts:importByIdentity` ищет запись,
   применяет `decideImport`, обновляет только source-owned поля и повторно
   читает запись после unique-constraint race.
5. `src/identity/import-policy.ts` содержит conflict policy:
   защищённое изменение становится явным conflict, а не тихим overwrite.
6. `src/fields/person/external-identity-key-on-person.field.ts` хранит
   server-controlled unique key на стандартном Person; provider/externalId
   fields и permissions описаны в `src/fields/person/` и `src/roles/`.

Тесты: `src/identity/**/__tests__`, `src/utils/__tests__/kz-phone.test.ts` и
`scripts/identity-import-smoke.mjs`.

## Customer 360

`Twenty UI` → `Mahabbat front component` → related data → computed balance:

- page tab: `src/page-layout-tabs/customer-360.page-layout-tab.ts`;
- UI: `src/front-components/customer-360.front-component.tsx`;
- component получает Person через `useRecordId`, затем `CoreApiClient.query`
  загружает Orders и их nested OrderItems, Reservations и Ledger entries;
- `balance` вычисляется reduce по ledger amounts; отдельного balance field как
  источника истины нет;
- loyalty adjustment в том же компоненте использует imperative
  `button type="button" onClick`, local validation, processing state и reload.

## Loyalty write boundary

`button click` → validation → UUID/idempotency key → authenticated route →
HMAC/app-only resolver → request → processor → ledger entry → refresh:

1. `customer-360.front-component.tsx:handleLoyaltyAdjustment` валидирует
   amount/reason, создаёт idempotency key и делает POST `/s/loyalty/adjustments`.
2. `src/logic-functions/create-loyalty-adjustment-request.logic-function.ts`
   проверяет authenticated route, customer и повторный idempotency key.
3. `src/logic-functions/create-loyalty-adjustment-request.resolver.logic-function.ts`
   проверяет HMAC и вызывает app-only write boundary.
4. `src/logic-functions/apply-loyalty-adjustment-request.logic-function.ts`
   выполняет exactly-once/retry-safe processor: существующий ledger
   reconciles stale request; unique `sourceRequestId` relation не допускает
   второй entry.
5. `src/logic-functions/reconcile-pending-loyalty-adjustments.logic-function.ts`
   является recovery/cron backstop.
6. Object/field/index definitions находятся в
   `src/objects/loyalty-adjustment-request.object.ts`,
   `src/objects/loyalty-ledger-entry.object.ts`,
   `src/indexes/unique-source-request-on-loyalty-ledger-entry.index.ts` и
   связанных files в `src/fields/loyalty-ledger-entry/`.

Sandbox-safe UUID fix: `createAdjustmentIdempotencyKey` в front component
использует `crypto.getRandomValues`, с локальным UUID-v4 fallback, потому что
`crypto.randomUUID()` в Twenty sandbox ранее отсутствовал. Никаких debug hooks
в текущем обработчике нет.

## Aggregate import

`workbook` → parser → normalization → stable identity → aggregate data →
rerun-safe upsert:

- `scripts/import-aggregate-workbook.py` читает private workbook read-only,
  пропускает `Итого:` totals и передаёт строки в API;
- `src/aggregate-sales/aggregate-sales-contract.ts` содержит
  `normalizeSourceText`, `normalizeItemKey`, `normalizeDecimalString`,
  `decimalTengeToMoney`, `buildAggregateLineIdentityKey`,
  `normalizeAggregateSalesLine`, `toSalesSnapshotLinePayload` и
  `importAggregateSalesLines`;
- `src/objects/sales-snapshot-line.object.ts` — read-only API object;
- `scripts/aggregate-sales-smoke.mjs` и
  `src/aggregate-sales/__tests__/aggregate-sales-contract.test.ts` проверяют
  fractional quantity, zero revenue, near-duplicate names, retry и race.

Historical rows intentionally do **not** become `Order`/`OrderItem`: the source
report is aggregated by item/month/warehouse and lacks receipt, customer,
timestamp and transaction identity. It is safe for Dashboard/top-products and
catalog bootstrap, not for Customer 360 operational history.

## Dashboard

`SalesSnapshotLine` + `Order` → native page layout → Dashboard:

- `src/page-layouts/mahabbat-dashboard.page-layout.ts` defines the native
  `STANDALONE_PAGE` widgets. The top of the page is an operational overview:
  a BlockNote welcome panel, live Order/OrderItem/Reservation KPI cards and
  compact tables for the latest orders and upcoming reservations;
- aggregate revenue/quantity/top-products/monthly trend query
  `SalesSnapshotLine`;
- operational order totals/status counts query `Order`;
- the historical charts remain below the operational widgets and are not
  populated from fabricated transactions;
- `src/navigation-menu-items/mahabbat-dashboard.navigation-menu-item.ts` puts
  the Dashboard on the Mahabbat-first path.

Sources are deliberately not blended into fabricated transactions.

## Reservations

`src/objects/reservation.object.ts` defines the object and fields; Person
relation fields live in `src/fields/person/reservations-on-person.field.ts`.
`src/views/upcoming-reservations.view.ts` filters future `reservationTime`,
sorts ascending and exposes host-facing columns. Native object CRUD performs
the mutation and Twenty persists it; the browser acceptance reloaded the
record. `src/navigation-menu-items/mahabbat-reservations.navigation-menu-item.ts`
provides the main entry.

## Segment: «Не возвращались 30 дней»

`Person.lastActivityAt` → `src/views/customers-not-returned.view.ts` → native
Twenty view. The filter is a relative `PAST_30_DAY` exclusion wrapped in a
`NOT` filter group, so it recalculates with time. It does not create a second
segmentation backend or hard-code a date.

## Other domain definitions

- Objects: `src/objects/`.
- Person extensions and relations: `src/fields/person/`.
- Indexes: `src/indexes/`.
- Roles/permissions: `src/roles/`.
- Views/navigation/layouts: `src/views/`, `src/navigation-menu-items/`,
  `src/page-layouts/`, `src/page-layout-tabs/`.
- Deterministic seed: `scripts/seed-demo.mjs`.
- App manifest/config: `src/application-config.ts` plus entity modules loaded by
  `twenty-sdk`.
