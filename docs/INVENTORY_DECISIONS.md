# Inventory Decisions (ADR)

## ADR-INV-001 — Ledger is Source of Truth; Balance is Projection

**Context**: требуется точный учёт остатков без float-дрейфа и без потери истории.
**Decision**: `InventoryStockMovement` — единственный источник истины. `InventoryStockBalance` — материализованная проекция, обновляемая только controlled commands и сверяемая `SUM(movements) vs balance`. Mismatch = FAIL QA.
**Consequences**: Никакого `UPDATE` ledger row; исправление — reversal. Balance может быть stale, но никогда authoritative.
**Alternatives**: Mutable `quantity` поле на StockItem — отклонено (потеря истории, race).

---

## ADR-INV-002 — Fixed-Point Micros, Integer Arithmetic

**Context**: JS float запрещён для authoritative количества/денег; units: g/kg, ml/l, piece.
**Decision**: Base units `GRAM | MILLILITER | PIECE`, storage `quantityMicros = units * 1000` (int, three decimals). Money = `amountMicros` как в POS (CURRENCY). Все расчёты — на integers, deterministic `Math.trunc`/`roundHalfUp` задокументирован.
**Consequences**: Presentation layer конвертирует `micros → display` (12500g → 12.5кг). Unit mismatch → 400 `INVALID_UNIT`.
**Alternatives**: Decimal.js / BigDecimal в storage — избыточен для v1, micros покрывает 3 знака и безопасен до ±9e15.

---

## ADR-INV-003 — Moving Weighted Average Costing (MWA)

**Context**: клиент хочет закупочную цену, стоимость остатков и недостачи; historical cost не должен переписываться.
**Decision**: MWA per (item, location).
- Receipt: `newAvg = (oldQty*oldAvg + receiptQty*receiptPrice)/ (oldQty+receiptQty)` round half-up to integer micrо.
- Production output: `unitCost = Σ(inputQty*inputAvg)/outputQty` snapshot себестоимости входов на момент production.
- Sale/WriteOff/Transfer consume at current `avgCostSnapshot`.
**Consequences**: Простота, нет FIFO слойности, детерминирован. Transfer сохраняет value (`qty * avgSource`). Шаг rounding задокументирован и unit-tested.
**Alternatives**: FIFO/LIFO — отклонены как out-of-scope v1 (усложняют ledger без бизнес-требования).

---

## ADR-INV-004 — RecipeVersion with Effective Timeline & DAG

**Context**: исторические движения не должны "переехать" при изменении кальк карты; полуфабрикаты могут ссылаться на полуфабрикаты.
**Decision**: `Recipe → RecipeVersion → RecipeLine`. Публикация новой версии помечает предыдущую `SUPERSEDED`, ставит `effectiveFrom = now()`. Выбор версии при списании продажи: наиболее поздняя версия с `effectiveFrom <= orderLineCreatedAt` (fallback: последняя до `orderClosedAt`). Сохраняется `recipeVersionId` в Movement. Циклы проверяются DFS на publish; `RECIPE_CYCLE` → 400.
**Consequences**: Воспроизводимость, audit. Self-cycle и A→B→A запрещены.
**Alternatives**: Mutable lines in place — отклонено (ломает историю). "Всегда текущая версия" — отклонено (меняет закрытые чеки).

---

## ADR-INV-005 — Semi-Finished Is Not Exploded on Sale

**Context**: блюдо с 20г Огонька не должно при продаже повторно списывать помидоры.
**Decision**: Sale потребляет полуфабрикат как StockItem. Сырьё списывается только при `PRODUCTION`.
**Consequences**: Корректный поток `raw → PRODUCTION → semi → SALE`. Тест `no recursive explosion` mandatory.
**Alternatives**: Взрывать полуфабрикат рекурсивно — отклонено (double consumption).

---

## ADR-INV-006 — Production Is Explicit & Idempotent

**Context**: производство 5кг Огонька должно создать −2.5кг помидоров, −2.5кг другого, +5кг Огонька atomically.
**Decision**: `produceSemiFinished` с `quantityMicros, locationId, recipeVersionId?, idempotencyKey`. Масштабирование: `required = lineQty * requestedYield / recipeYield` integer. Все movements группы имеют один `sourceId = productionId`. Retry = 200 same result.
**Consequences**: Атомарность групповая (логическая), не частичная. Cost snapshot фиксируется.
**Alternatives**: Производство как ревизия — отклонено (§10 спеки).

---

## ADR-INV-007 — Revision ≠ Production; Explicit Resolution for Positive Semi Variance

**Context**: клиентский сценарий "внесли 1кг Огонька при ревизии — ингредиенты должны списаться" нельзя делать скрыто, иначе повторная ревизия снова спишет.
**Decision**: Revision сравнивает expected vs actual. `variance = actual - expected`. Для `SEMI_FINISHED && variance > 0` требуется явный `resolution`: `UNRECORDED_PRODUCTION` (провести production для variance qty по RecipeVersion) или `DIRECT_ADJUSTMENT` (просто +variance без списания). Рекомендация UI: `UNRECORDED_PRODUCTION`.
**Consequences**: Повторная ревизия с `expected=1, actual=1` → variance 0 → никакого списания. Regression test mandatory (§75).
**Alternatives**: Авто-списание при каждой положительной ревизии — отклонено (double consumption).

---

## ADR-INV-008 — POS Consumption Is Durable & Non-Blocking

**Context**: заказ закрывается даже если Inventory недоступна; списание exactly once.
**Decision**: `CLOSE → create InventoryConsumptionRequest(orderId) → async processor → StockMovement`. POS close никогда не блокируется Inventory. Unique(orderId) — exactly-once. Cron recovery ищет CLOSED без request.
**Consequences**: Заказ 201 даже при `MISSING_RECIPE`; создаётся `InventoryConsumptionIssue` вместо падения. Loyalty pattern переиспользована (request→processor→ledger).
**Alternatives**: Синхронное списание внутри closeOrder — отклонено (риск блока кассы).

---

## ADR-INV-009 — Prepared Void Consumption

**Context**: OrderLine `VOIDED` с `PREPARED` означает ингредиенты потрачены впустую; `NOT_PREPARED` — нет.
**Decision**: `PREPARED → PREPARED_VOID_CONSUMPTION` (или `SALE_CONSUMPTION` с `voidPreparedState`); `NOT_PREPARED → no consumption`.
**Consequences**: Отчёт различает продажи и списания на кухне.
**Alternatives**: Всегда списывать / никогда не списывать void — отклонено (§26).

---

## ADR-INV-010 — Negative Stock Allowed, Warned

**Context**: приход может быть внесён позже; касса не должна вставать.
**Decision**: `DEFAULT V1: allow negative theoretical balance`, не блокировать close. Создавать visible warning/issue.
**Consequences**: `quantityMicros` может стать отрицательным; Costing по average сохраняется.
**Alternatives**: Блокировать продажу при нехватке — отклонено (§25, кроме явного client HARD STOP).

---

## ADR-INV-011 — Revision Staleness via Watermark

**Context**: между START и FINALIZE могут быть новые movements.
**Decision**: При `startInventoryCount` фиксируется `ledgerWatermark = MAX(occurredAt) per location`. При `finalize` — если после watermark появились movements → `REVISION_STALE` → refresh/restart.
**Consequences**: Никакого silent post stale count.
**Alternatives**: Оптимистичное затирание — отклонено.

---

## ADR-INV-012 — Transfer Atomically Paired

**Context**: перемещение не должно потерять товар.
**Decision**: TRANSFER = `OUT (-qty, costSnapshot)` + `IN (+qty, тот же costSnapshot)` с общим `sourceId = transferId`. Логическая атомарность; retry-safe; same location rejected.
**Consequences**: Global quantity unchanged; value preserved.

---

## ADR-INV-013 — Idempotency Keys Everywhere

**Context**: retry, crash, concurrent terminals.
**Decision**: Каждый external command несёт `idempotencyKey` (UUID v4) с unique index. Retry с тем же ключом и тем же контекстом → 200 same result. Foreign reuse → 409. Операция уровня группы хранит `sourceId` для групповой дедупликации.
**Consequences**: Покрывает все 30 adversarial cases §40.

---

## ADR-INV-014 — Auth: Backoffice-Only Writes, Server-Derived Actor

**Context**: склад — backoffice, не waiter.
**Decision**: Inventory writes требуют `ADMIN` (или authorized backoffice role) через `getAuthenticatedPosContext()`. `role` из body игнорируется. Reads могут быть шире (aggregate dashboards). Каждая movement хранит `actorStaffId`.
**Consequences**: WAITER не может делать receipt/production/transfer/write-off. Audit full.
**Alternatives**: Новая RBAC система — не требуется; переиспользуем POS auth boundary.

---

## ADR-INV-015 — Twenty App Objects Only, No Core Fork

**Context**: модификация Twenty core запрещена.
**Decision**: Все Inventory объекты — App custom objects через `twenty-sdk/defineObject`, как POS. Логика — в `src/inventory/*` + `src/logic-functions/*` с shared helpers. SDK mismatch — Linux/WSL, не форк.
**Consequences**: `Twenty core modifications = 0` сохраняется.

---

## ADR-INV-016 — Single Location per Recipe (v1)

**Context**: спека позволяет per-line location override в будущем.
**Decision**: v1: один `defaultLocationId` на Recipe/MenuItem. Расширение — добавить `locationId` на RecipeLine без изменения ledger.
**Consequences**: Упрощает модель списания, не блокирует будущее.

---

## ADR-INV-017 — Costing Rounding Determinism

**Context**: взвешенное среднее требует точного округления.
**Decision**: Division round half-up: `Math.floor((num + den/2)/den)` for positive; общий helper `divideRoundHalfUp`. 1000 sales × tiny quantities не копят дрейф за счёт integer micros.
**Consequences**: Unit-test `weighted-average rounding` и `1000 × tiny` mandatory.

---

## ADR-INV-018 — Standalone Inventory UI (Backoffice)

**Context**: склад не должен жить в waiter POS flow.
**Decision**: Отдельный раздел `СКЛАД` в CRM/backoffice навигации (App page layout / navigation-menu-items), таблицы Остатки/Приход/Производство/Перемещение/Списание/Ревизии/Калькуляции/История.
**Consequences**: POS workflow не перегружен. Inventory UI — плотные таблицы, быстрый ввод фактических.

