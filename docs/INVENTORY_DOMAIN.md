# Mahabbat Inventory — Domain Model (v1 Operational)

> **Source of truth: StockMovement ledger. Balance is a verified projection.**
> POS is frozen baseline. Twenty core modifications = 0.

---

## 1. Glossary

| Term | Meaning |
|---|---|
| **StockItem** | Универсальная складская позиция (сырьё или полуфабрикат). Один объект, не три на локацию. |
| **StockLocation** | Точка хранения (Кухня, Бар, Шашлыки). Конфигурируемая, не hardcode. |
| **StockBalance** | Проекция `Σ movement.quantity` per (StockItem × Location). Cache, не истина. |
| **StockMovement** | Неизменяемая запись ledger: delta, cost snapshot, source, idempotency. |
| **StockMovementLine** | Строка внутри StockMovement (плоская модель: один movement = одна строка; группировка через `sourceId`/`idempotencyKey`). Документ допускает обе формы; v1 — плоская с групповым ключом. |
| **Recipe** | Калькуляционная карта на MenuItem или на SEMI_FINISHED. |
| **RecipeVersion** | Версия Recipe, immutable, со `effectiveFrom` и линями. |
| **RecipeLine** | `stockItemId + quantityMicros (в базовых единицах)`. |
| **Production** | Команда произвести N базы полуфабриката → списания + приход атомарно. |
| **Receipt** | Приходное движение с `unitCostMicros`. |
| **Transfer** | Атомарная пара OUT + IN, глобально ноль. |
| **WriteOff** | Ручное списание с reason. |
| **InventoryConsumptionRequest** | Durable request для списания закрытого POS-заказа, exactly-once. |
| **InventoryIssue** | `MISSING_RECIPE` / `INSUFFICIENT_STOCK` предупреждение. |
| **InventoryCount** | Ревизия (DRAFT→ACTIVE→POSTED), с ожидаемыми/фактическими/разницей. |

---

## 2. Entities & Fields (Twenty App objects, prefix `inventory*` / `pos` reuse)

### 2.1 InventoryStockLocation
- `name` TEXT, `isActive` BOOLEAN, `sortOrder` NUMBER, `isDefault` BOOLEAN?
- Unique index on `name` (case-insensitive нормализация на сервере).
- Seed: Кухня, Бар, Шашлыки (configurable, не hardcode в dispatcher).
- Deactivate ≠ delete; movements остаются.

### 2.2 InventoryStockItem
- `name` TEXT
- `itemType` SELECT `RAW_MATERIAL | SEMI_FINISHED`
- `unitKind` SELECT `MASS | VOLUME | COUNT`
- `baseUnit` SELECT `GRAM | MILLILITER | PIECE` (выводится из unitKind)
- `defaultLocationId` TEXT? nullable FK к Location
- `isActive` BOOLEAN
- `averageCostMicros` CURRENCY? или NUMBER micros/kg (server-owned, производная от ledger, кэшируется на Projection, не редактируется UI).
- Unique index on normalized `name`.
- SEMI_FINISHED может иметь активную RecipeVersion; RAW — опционально (не требуется для продаж сырья напрямую).

### 2.3 InventoryRecipe
- `label` TEXT
- `targetKind` SELECT `MENU_ITEM | SEMI_FINISHED`
- `targetId` TEXT (MenuItemId или StockItemId)
- `defaultLocationId` TEXT nullable (списание по умолчанию)
- `isActive` BOOLEAN
- Unique index on `(targetKind, targetId)` — один активный Recipe на target.

### 2.4 InventoryRecipeVersion
- `recipeId` TEXT FK
- `versionNumber` NUMBER (int)
- `yieldQuantityMicros` NUMBER (выход, напр. 1kg = 1_000_000 micros)
- `yieldUnit` TEXT (совместим с baseUnit)
- `effectiveFrom` DATE_TIME (момент публикации)
- `status` SELECT `ACTIVE | SUPERSEDED`
- `createdByStaffId` TEXT
- `idempotencyKey` TEXT unique
- Unique `(recipeId, versionNumber)`, unique `idempotencyKey`.

### 2.5 InventoryRecipeLine
- `recipeVersionId` TEXT FK
- `stockItemId` TEXT FK
- `quantityMicros` NUMBER (сколько базовых единиц на `yieldQuantity`)
- `sortOrder` NUMBER
- Unique `(recipeVersionId, stockItemId)` — дубли ингредиента суммируются на сервере при создании версии.

### 2.6 InventoryStockMovement (ledger, append-only)
- `movementType` SELECT `RECEIPT | SALE_CONSUMPTION | PRODUCTION_INPUT | PRODUCTION_OUTPUT | WRITE_OFF | TRANSFER_OUT | TRANSFER_IN | INVENTORY_ADJUSTMENT | PREPARED_VOID_CONSUMPTION`
- `stockItemId` TEXT
- `locationId` TEXT
- `quantityDeltaMicros` NUMBER (signed: + приход, − расход)
- `unitCostMicros` NUMBER nullable (цена/баз. ед. на момент движения; для SALE_CONSUMPTION берётся averageCost snapshot)
- `totalCostMicros` NUMBER nullable (`quantity * unitCost`, signed)
- `sourceType` SELECT `RECEIPT | PRODUCTION | SALE | VOID | TRANSFER | REVISION | MANUAL`
- `sourceId` TEXT (связывает группу: `receiptOpId`, `productionOpId`, `orderId`, `transferOpId`, `revisionId`)
- `recipeVersionId` TEXT nullable
- `orderId` TEXT nullable, `orderLineId` TEXT nullable
- `reason` TEXT nullable + `comment`
- `actorStaffId` TEXT
- `occurredAt` DATE_TIME
- `idempotencyKey` TEXT unique (per movement row) — но для групповой операции дополнительно есть `sourceIdempotencyKey` на операцию.
- **Immutability**: после `POSTED` — no update/delete через generic CRUD (role-level deny; server-only writer).
- Index: `(stockItemId, locationId)`, `(sourceId)`, `(orderId)`.

> Альтернатива с InventoryStockMovementLine вынесена как логическое представление: v1 хранит плоские movements. Групповая атомарность достигается транзакционной видимостью (все movements одной операции имеют один `sourceId` и создаются в/после проверки idempotency ключа операции).

### 2.7 InventoryStockBalance (projection)
- `stockItemId` TEXT + `locationId` TEXT → composite unique
- `quantityMicros` NUMBER (server-owned)
- `averageCostMicros` NUMBER (weighted avg, server-owned)
- `totalValueMicros` NUMBER (`quantity * averageCost`)
- `version` NUMBER (optimistic, `ledgerWatermark` = max movement id / timestamp)
- `updatedAt` DATE_TIME
- Обновляется только controlled command boundary; reconciliation: `SELECT SUM(quantityDeltaMicros) FROM movements WHERE ...` must equal `quantityMicros`, иначе alert.

### 2.8 InventoryConsumptionRequest (durable, exactly-once POS→Inventory)
- `orderId` TEXT unique (один consumption per Order)
- `status` SELECT `PENDING | PROCESSING | APPLIED | FAILED_MISSING_RECIPE | FAILED`
- `idempotencyKey` TEXT unique (= `orderId`)
- `attemptCount` NUMBER
- `lastError` TEXT nullable
- `processedAt` DATE_TIME nullable
- Создаётся при `closeOrder` (или recovery cron), обрабатывается асинхронным processor/cron (shared helper) аналогично `LoyaltyAdjustmentRequest`.

### 2.9 InventoryConsumptionIssue
- `orderId` TEXT, `orderLineId` TEXT, `menuItemId` TEXT, `issueType` SELECT `MISSING_RECIPE | MISSING_LOCATION`, `status` SELECT `OPEN | RESOLVED`, `createdAt`

### 2.10 InventoryCount (ревизия)
- `label` TEXT
- `locationId` TEXT
- `status` SELECT `DRAFT | ACTIVE | POSTED`
- `startedAt` DATE_TIME nullable
- `ledgerWatermark` TEXT nullable (snapshot версия/время на момент `ACTIVE`)
- `createdByStaffId` TEXT
- `idempotencyKey` TEXT unique

### 2.11 InventoryCountLine
- `countId` TEXT FK
- `stockItemId` TEXT
- `expectedQuantityMicros` NUMBER (фиксация на момент ACTIVE)
- `actualQuantityMicros` NUMBER nullable (вводит пользователь)
- `varianceMicros` NUMBER nullable (`actual - expected`)
- `unitCostMicrosSnapshot` NUMBER (averageCost на момент ACTIVE)
- `varianceValueMicros` NUMBER nullable (`variance * unitCost`)
- `resolution` SELECT `PENDING | UNRECORDED_PRODUCTION | DIRECT_ADJUSTMENT` (только для SEMI_FINISHED positive)
- `producedRecipeVersionId` TEXT nullable
- Unique `(countId, stockItemId)`.

---

## 3. Units & Arithmetic

- **Base units**: масса → граммы, объём → миллилитры, штуки → штуки.
- **Storage**: `quantityMicros = baseUnits * 1000` (integer, three decimals). 50g = 50_000, 1.5kg = 1_500_000, 2.5kg = 2_500_000. Штуки: 1 = 1_000.
- **Money**: `amountMicros` как в POS (`CURRENCY` amountMicros). Никогда float.
- **Conversion**: presentation `g → kg` делит на 1000; сервер всегда считает в micros. Unit mismatch → `INVALID_UNIT`.
- **Rounding**: детерминированное, half-away? Для costing — floor/round half-up, задокументировано в `INVENTORY_DECISIONS.md`. Никогда `0.1+0.2` float.

---

## 4. State Machines

### 4.1 InventoryStockItem
```
ACTIVE → INACTIVE (deactivate)
```
INACTIVE блокирует новые Recipe/Receipt/Production, но не удаляет историю.

### 4.2 InventoryRecipeVersion
```
DRAFT → ACTIVE → SUPERSEDED
```
Публикация новой версии автоматически `SUPERSEDED` предыдущую.

### 4.3 InventoryConsumptionRequest
```
PENDING → PROCESSING → APPLIED
PENDING → FAILED_MISSING_RECIPE (terminal with issue)
PENDING → FAILED (retry-able, backoff by cron)
```
Idempotent: повтор с тем же orderId — 200 same result.

### 4.4 InventoryCount
```
DRAFT → ACTIVE (фиксация expected + watermark)
ACTIVE → POSTED (finalize; variance movements created)
DRAFT/ACTIVE → CANCELLED? v1 — CANCELLED не нужен; POSTED — terminal.
```
Повтор finalize того же `idempotencyKey` → 200 same result.

---

## 5. Command Boundaries (server-owned, signed `/inventory/command` or `/pos/command` for close-order side-effect)

Все команды — через единый authenticated Inventory dispatcher (аналог POS), получающий `actorStaffId/role` из `getAuthenticatedPosContext()`. Generic CRUD для ledger/balance/projection — read-only для STAFF.

| Command | Roles | Idempotency | Atomicity |
|---|---|---|---|
| `createStockLocation` | ADMIN | `idempotencyKey` unique | single row |
| `createStockItem` | ADMIN | `idempotencyKey` unique | single row |
| `upsertRecipe` (new version) | ADMIN | `idempotencyKey` on version | DAG check + publish |
| `receiveStock` (multi-line) | ADMIN/authorized | `receiptIdempotencyKey` on group | all-or-nothing (partial crash → recovery re-reads group) |
| `produceSemiFinished` | ADMIN | `productionIdempotencyKey` | inputs + output atomically grouped |
| `transferStock` | ADMIN | `transferIdempotencyKey` | OUT + IN pair атомарно |
| `writeOffStock` | ADMIN | `writeOffIdempotencyKey` | single movement |
| `createInventoryCount` | ADMIN | key | header |
| `startInventoryCount` | ADMIN | key | snapshot expected |
| `finalizeInventoryCount` | ADMIN | key | watermark check + variance movements |
| `consumeOrderStock` (internal processor) | system | `orderId` unique | per-order single consumption |

Ошибки → Russian operational copy, technical → logs.

---

## 6. Ledger Model & Balance Projection

- **Append-only**: никакого `UPDATE` ledger row. Исправление = reversal movement + correct movement.
- **Group key**: `sourceId = <operationId>` (UUID). Все movements операции делят один `sourceId` для выборки/восстановления.
- **Watermark**: `MAX(occurredAt, id)` per location; хранится в Balance.version и в Count.ledgerWatermark.
- **Reconciliation job / query**: periodically `SUM(quantityDeltaMicros) GROUP BY (stockItemId, locationId)` vs Balance; mismatch → fail QA.

---

## 7. Recipe Versioning & DAG

- При создании версии: проверить что `targetItem` активен; для SEMI — cycle DFS по графу `recipeTarget ← lines`. Кол-во вершин ≤ 1000, O(V+E) достаточно.
- `effectiveFrom = now()`; для POS sale выбор версии — **`effectiveFrom <= orderLineCreatedAt`** (наиболее поздняя версия не позднее создания линии). Если нет такой — fallback к последней ACTIVE до `orderClosedAt`. Сохраняется `recipeVersionId` в Movement для воспроизводимости.
- Старые movements никогда не переписываются при изменении recipe.

---

## 8. Semi-Finished Production

Input: `stockItemId (SEMI)`, `quantityMicros`, `locationId`, `recipeVersionId?` (default active), `idempotencyKey`.

Steps (idempotent):
1. Check idempotency group exists → return 200.
2. Resolve RecipeVersion (active if not specified), check DAG already proven at publish.
3. Scale factor = `requestedYield / recipeYield` (integer micros ratio). Каждая линия: `required = line.quantityMicros * scaleNum / scaleDen`. Deterministic integer division with rounding (documented).
4. Check availability? V1: allow negative (не блокируем), но пишем warning issue if `expected - required < 0`.
5. Create `PRODUCTION_INPUT` movements (negative deltas) per component + `PRODUCTION_OUTPUT` (+quantityMicros) для produced item. Все с одним `sourceId`.
6. Weighted cost: `producedUnitCost = Σ(inputCostSnapshot * requiredQty) / producedQty`. Snapshot cost per input = current `averageCostMicros` на момент production (из Balance). Сохранить в movements.
7. Update Balances: decrement components, increment produced, recalc weighted average for produced via `moving weighted average`.
8. Audit + idempotency record.

Retry той же ключом: шаг 1 возвращает тот же result, новых movements нет.

---

## 9. POS Consumption (exactly-once)

Trigger: `closeOrder` (POS dispatcher) после успешного `status=CLOSED`:
- синхронно (в том же resolver, но без блокировки POS) создаёт `InventoryConsumptionRequest(orderId, PENDING)` — unique constraint на orderId.
- Если Twenty не даёт транзакционную границу между POS и Inventory — recovery: cron/processor `every 1-5 min` находит `CLOSED` Orders без request и создаёт недостающие (idempotent by unique).

Processor (db-event + cron shared helper, как в loyalty):
- `SELECT` request `PENDING`; `SELECT` Order + Lines + Guest? + MenuItem.
- Для каждой OrderLine:
  - `status === VOIDED` ?
    - `voidPreparedState === PREPARED` → consume как `PREPARED_VOID_CONSUMPTION`
    - `NOT_PREPARED` → skip (no movement)
  - `ACTIVE` → consume.
- Для потребляемой линии: найти Recipe for MenuItemId с effective version ≤ lineCreatedAt. Если нет → создать `InventoryConsumptionIssue(MISSING_RECIPE)`, пропустить эту линию (не блокирует остальные линии). Если есть — для каждой RecipeLine создать `SALE_CONSUMPTION` movement на `recipe.defaultLocationId` (или StockItem.defaultLocationId, или fallback Кitchens — configurably; v1 одна локация на рецепт). Quantity: `lineRecipeQty * orderLineQuantity` (line quantity factor). Сохранить `recipeVersionId, orderId, orderLineId`.
- SEMI lines: **НЕ взрывать** полуфабрикат (см. §11).
- Wrap: создать movements с `sourceId = orderId`, `sourceType = SALE`.
- Status → `APPLIED`; issue list persisted.

Recovery cases:
- worker crash before movement: request stays PENDING → cron retries → produces exactly one group.
- worker crash after movement but before status update: group already exists (by sourceId) → reconciles request to APPLIED.
- concurrent processors: unique `orderId` + unique movement `idempotencyKey = orderId:recipeLineId` обеспечивает победу одного.

POS availability: Inventory failure никогда не откатывает `closeOrder`. POS возвращает 201 даже если consumption PENDING/FAILED. Issue видна в Inventory UI.

---

## 10. Negative Stock Policy

- По умолчанию разрешён уход в минус. POS close не блокируется.
- При `quantity + delta < 0` — ledger всё равно записывает, Balance становится отрицательным, создаётся `InventoryIssue(INSUFFICIENT_STOCK)` warning.
- UI: строка с отрицательным остатком подсвечивается.

---

## 11. Critical Invariant: Semi-Finished НЕ раскрывать при продаже

Sale потребляет `Огонёк -20g`, а не его ингредиенты. Ингредиенты уже списаны при `PRODUCTION`. Double consumption запрещён — покрывается unit-test и acceptance F.

---

## 12. Costing Policy — Moving Weighted Average (MWA)

- Хранится `averageCostMicros` per (item, location) в Balance; movements хранят `unitCostSnapshot`.
- **Receipt**: `newAvg = (oldQty*oldAvg + receiptQty*receiptUnitCost) / (oldQty + receiptQty)`. Deterministic integer division: `Math.floor`? Решение: round half-up к целому micrо. Документ в `INVENTORY_DECISIONS.md`.
- **Production output**: см. §8.6 — ввод-weighted.
- **Sale / WriteOff / Transfer**: `unitCostSnapshot = currentAvg`; `totalValueDelta = delta * snapshot`. Transfer OUT and IN используют один и тот же snapshot (value preservation: amount перемещённого = `qty * avgSource`).
- **Revision adjustment**: shortage/surplus оценивается по snapshot на момент ACTIVE.
- История никогда не переписывается.

---

## 13. Revision Semantics

### Lifecycle
1. `createInventoryCount(locationId)` → DRAFT.
2. `startInventoryCount(countId)` → фиксирует `expectedQuantityMicros` per StockItem из Balances и `ledgerWatermark` (timestamp/maxId). Статус → ACTIVE.
3. Пользователь вводит `actualQuantityMicros` per line.
4. `finalizeInventoryCount(countId, idempotencyKey)`:
   - Проверить `status === ACTIVE`.
   - Проверить watermark: `SELECT MAX(occurredAt)` per location > `ledgerWatermark` → `REVISION_STALE` (требует refresh).
   - Для каждой линии `variance = actual - expected`.
   - `variance < 0` → `INVENTORY_ADJUSTMENT` negative movement.
   - `variance > 0 && RAW_MATERIAL` → `INVENTORY_ADJUSTMENT` positive.
   - `variance > 0 && SEMI_FINISHED` → требует `resolution`:
     - `UNRECORDED_PRODUCTION` → выполнить production flow для `+variance` qty (ингредиенты списываются по RecipeVersion), плюс output movement для полуфабриката. Это явный выбор пользователя, не скрытое списание.
     - `DIRECT_ADJUSTMENT` → прямое `INVENTORY_ADJUSTMENT` без списания компонентов.
   - Все variance movements одной ревизии имеют `sourceId = countId`.
   - `status → POSTED` атомарно.
   - Retry тем же idempotencyKey → 200 same result, без дублей.

### UI (требуемые колонки)
№ | Позиция | Должно быть | Фактически | Разница | Цена/кг | По учёту ₸ | Факт ₸ | Недостача/Излишек ₸. Человек вводит только фактическую, остальное считается.

---

## 14. Transfer & WriteOff

- **Transfer**: атомарная пара: `TRANSFER_OUT (-qty, costSnapshot)` на source + `TRANSFER_IN (+qty, тот же costSnapshot)` на dest с общим `sourceId = transferOpId`. Глобальная сумма ноль; retry-safe; same location → `INVALID_TRANSFER`.
- **WriteOff**: одна `WRITE_OFF` movement с `reason` enum + comment. Не удаляет.

---

## 15. Concurrency & Idempotency

- Каждый внешний command имеет `idempotencyKey` UUID с unique index на соответствующую таблицу/движение.
- Retry с тем же ключом: проверка контекста (orderId, locationId и т.д.) → 409 при mismatch, 200 при match.
- Concurrent receipts/productions/transfers: unique index + read-after-write reconciliation.
- Two finalized revisions concurrent: second gets `REVISION_STALE` or idempotency conflict.

---

## 16. Permissions & Audit

- Inventory — backoffice домен, требует `ADMIN` (или authorized backoffice role). WAITER не имеет write-доступа к ledger. Client-supplied `role` игнорируется; сервер берёт из `getAuthenticatedPosContext()`.
- Каждый ledger movement хранит `actorStaffId`, `occurredAt`, `sourceId`, `idempotencyKey`.
- Перемещения, списания, производства, ревизии, приходы — все оставляют `PosOperationalEvent`-style audit через тот же dispatcher (или отдельный InventoryOperationalEvent если нужен).

---

## 17. Recovery & Durability

- `CLOSED` Order без ConsumptionRequest → cron каждые 1–5 минут сканирует закрытые заказы без группы movements и регенерирует request.
- Processor shared helper (db-event + cron) — как loyalty: unique `orderId` boundary, reconciliation из ledger при race.

---

## 18. Performance / Scale

- Balance — server-side агрегат, UI не грузит весь ledger. Table views — пагинация 100.
- Indexes: `(stockItemId, locationId)`, `(movementType, occurredAt)`, `(sourceType, sourceId)`.
- Ожидаемый потолок v1: 500 items, 1000 recipe versions, 100k movement rows — все запросы должны работать с фильтром и пагинацией, без `load all → reduce`.

---

## 19. Extension Points (out of scope v1, но не блокировать)

- Supplier contracts, invoice OCR, procurement approvals → отдельные объекты, не мешают ledger.
- FIFO/LIFO, supplier price history → расширение cost policy, не менять ledger.
- Physical printers, fiscalization, bank terminals → adapter boundaries уже существуют.
- Mobile inventory, forecasting, auto-purchasing → future UI/service.

---

## 20. Acceptance Mapping to This Model

A…J (разделы 70-78 спеки) прямо проверяются: receipt, production, sale, prepared void, transfer, revision с unrecorded production, shortage, negative stock, recipe change, concurrency. Каждый имеет соответствующий unit + live acceptance.

