# Mahabbat POS — Domain

Слой документации и контрактов POS. Реализовано на момент FOUNDATION LOOP: **Slice 1** (Shift → Table → Order → Guests → Lines, server-side command boundary). Слайсы 2–6 задокументированы, но **не реализованы**.

## Граница (ADR-2026-08-POS-1)

POS — **отдельный операционный слой** на собственных кастомных объектах Twenty (`pos*`), а не расширение CRM `Order`.

Причины:
- Существующий CRM `OrderItem` имеет UNIQUE(`orderId`, `menuItemId`) — спека POS §11 требует, чтобы две одинаковые позиции были **независимыми строками** (этот unique-индекс несовместим).
- CRM `Order` привязан к Customer 360, импорту, агрегатам продаж и demo-сиду; у POS другой lifecycle (OPEN→IN_PROGRESS→PRECHECK_PRINTED→CLOSED), лифтайм смены, владение официантом, посадка на стол и гости.
- Расширение CRM-модели рискует регрессами в существующих отчётах без выигрыша.

Мост POS→CRM (pull в CRM Order/Item для отчётности) — будущий слайс, вне текущей границы.

Последствия:
- Все объекты POS имеют префикс `pos`.
- Отношения к `workspaceMember` (staffId/ownerStaffId/…) — **логические UUID-поля TEXT**, валидируются на сервере при команде (де-факто НЕ внешние ключи). Стандартный объект не тронут (принцип "core 0 изменений").
- Деньги: только `FieldType.CURRENCY` = `{ amountMicros, currencyCode }`, целые числа микров, без float.

## Сущности

### 1. PosShift (Смена) — РЕАЛИЗОВАНО
- **Цель**: рабочая сессия официанта; заказы открываются внутри смены.
- **Владелец**: `staffId`. Одна активная смена на сотрудника (гарантируется UNIQUE(`staffId`, `isOpen`) + атомарный claim по `isOpen=true`).
- **Lifecycle**: OPEN → CLOSED. Закрытие смены **не** закрывает заказы и не меняет их владельца.
- **Поля**: `label`, `staffId`, `status`, `openedAt`, `closedAt`, `isOpen` (nullable; true только пока открыта), `openToken` (маркер активной смены), `idempotencyKey`, `orders` (1:N).
- **Инварианты**:
  - Не более одной `isOpen=true` смены на `staffId` (unique).
  - `status=CLOSED` ⇒ `closedAt` задан, `isOpen=null`, `openToken=null`.
  - Повторный `openShift` с тем же `idempotencyKey` возвращает существующую смену.
  - Гонка двух `openShift`: создаётся ровно одна смена; проигравший получает существующую.
- **Future**: суммарный отчёт по смене, cash-закрытие (slice 5+ — требует решения пользователя).

### 2. PosZone (Зона зала) — РЕАЛИЗОВАНО (master data)
- Поля: `name`, `isActive`, `tables` (1:N). Валидация master-data — будущий слайс.

### 3. PosTable (Стол) — РЕАЛИЗОВАНО (master data)
- Поля: `number`, `zone` (N:1 PosZone), `isActive`, `layout` (nullable, пока не используется), `orders` (1:N, reverse).
- **Инвариант стола**: не более одного активного заказа на столе. Гарантия — UNIQUE(`tableId`, `claimToken`) на `PosOrder` (см. §6); `claimToken` детерминирован (равен `tableId`) пока заказ открыт и `null` после закрытия, поэтому PG unique пропускает закрытые (NULL) и блокирует второй активный.

### 4. PosOrder (Заказ POS) — РЕАЛИЗОВАНО
- **Владелец**: `ownerStaffId` (официант, открывший заказ). `openedByStaffId` совпадает с owner на слайсе 1.
- **Lifecycle**: OPEN → IN_PROGRESS → PRECHECK_PRINTED → CLOSED (+ derived CANCELLED, слайс 6).
- **Поля**: `label`, `status`, `shift` (N:1 PosShift, RESTRICT), `table` (N:1 PosTable, RESTRICT), `ownerStaffId`, `openedByStaffId`, `openedAt`, `closedAt`, `claimToken`, `idempotencyKey`, `guests` (1:N), `lines` (1:N), `subtotal`/`total` (CURRENCY, server-owned), `notes`.
- **Инварианты**:
  - Открывается только при активной смене актора (SHIFT_REQUIRED).
  - Открывается только на активном столе; на столе может быть максимум один активный заказ (unique-claim).
  - `PRECHECK_PRINTED`/`CLOSED`/`CANCELLED` — lock: addGuest/addLine/changeLineQuantity запрещены.
  - Владелец/стол меняются только будущими ADMIN-командами transfer (слайс 6); прямого update нет.
  - Итоги вычисляет сервер (сумма активных позиций в микро; пересчёт при addLine/changeQuantity).
  - Повторный `openOrder` с тем же `idempotencyKey` не создаёт дубль.

### 5. PosOrderGuest (Гость заказа) — РЕАЛИЗОВАНО
- Поля: `order` (N:1, RESTRICT), `ordinal` (int), `displayNumber` («Гость N»), `name` (nullable), `subtotal` (server-owned), `lines` (1:N), `idempotencyKey`.
- Позиции принадлежат гостю; per-guest subtotal пересчитывается сервером.

### 6. PosOrderLine (Позиция заказа) — РЕАЛИЗОВАНО
- Поля: `order` (N:1), `guest` (N:1), `menuItem` (N:1), `itemNameSnapshot`, `unitPrice` (CURRENCY snapshot), `quantity` (int ≥1), `status` (ACTIVE/VOIDED), `voidedAt`/`voidReason`/`voidPreparedState`/`voidedByStaffId` (слайс 6), `createdByStaffId`, `idempotencyKey`.
- **Инварианты**:
  - Нет UNIQUE(`order`, `menuItem`) — идентичные позиции существуют как независимые строки.
  - Снапшот имени/цены не меняется командой (только quantity).
  - Spисанные строки не удаляются физически.
  - STOP_LISTED блокируется **на сервере** в `addLine` (проверка активной записи стоп-листа на момент команды — защита от stale-клиента).

### 7. PosMenuItem (Позиция меню) — РЕАЛИЗОВАНО (master data)
- Поля: `name`, `category`, `price` (CURRENCY), `isActive`, `lines` (1:N), `stopListEntries` (1:N). Редактирование меню — будущий слайс (не в слайсе 1).

### 8. PosStopListEntry (Стоп-лист) — СХЕМА + ПРОВЕРКА в addLine
- Поля: `label`, `menuItem` (N:1), `isActive`, `createdByStaffId`, `clearedAt`, `clearedByStaffId`, `idempotencyKey`.
- Команды стоп-листа (add/clear) — слайс 2; на слайсе 1 выполняется server-side проверка «нет активной записи ⇒ позиция доступна».

### 9–16. Future (задокументированы, не реализованы)
- **KitchenPrint** (слайс 2): KitchenTicket + KitchenTicketLine, печать только неотправленных строк, printer adapter (реальный/mock/PDF).
- **Precheck** (слайс 3): денежный снапшот, PRECHECK_PRINTED lock, cancelPrecheck только ADMIN.
- **PaymentMethod** / **Payment** (слайс 4): конфигурируемые методы (Cash/Card база; Kaspi/Halyk/Freedom — не хардкодить), платежи, remaining=0 ⇒ close.
- **Reservation** (слайс 5): все поля optional, протухшие NOT auto-deleted, negative-timer UI.
- **Prepayment** (слайс 5): авто-применяется к remaining, не скидка.
- **OperationalEvent** (аудит): append-only журнал критичных действий.
- **Transfer-команды** (слайс 6): transferOrderToTable/ToWaiter/LinesToGuest — только ADMIN.

## Идемпотентность (слайс 1)
Каждая создающая команда несёт `idempotencyKey` (UUID) с unique-индексами:
`PosShift.idempotencyKey`, `PosOrder.idempotencyKey`, `PosOrderGuest.idempotencyKey`, `PosOrderLine.idempotencyKey`.
Повторный вызов с тем же ключом возвращает существующий объект (200), при конфликте чужого ключа — не создаёт дубль и не маскирует ошибки.

## Concurrency (слайс 1)
- Одна активная смена на staff: UNIQUE(`staffId`, `isOpen`).
- Один активный заказ на стол: UNIQUE(`tableId`, `claimToken`), `claimToken`=tableId пока открыт.
- Повторная сеть-команда: idempotency unique.
- `changeLineQuantity` last-write-wins (безопасно: безусловно меняет количество; документированное допущение слайса 1).