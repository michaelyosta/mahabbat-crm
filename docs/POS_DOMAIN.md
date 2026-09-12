# Mahabbat POS — Domain

Слой документации и контрактов POS. Реализованы **Slice 1** (Shift → Table → Order → Guests → Lines), **Slice 2** (Stop List + Kitchen Tickets), **Slice 3** (Precheck + Order Lock), **Slice 4** (Payments + Close), **Slice 5** (Reservations + Prepayment), **Slice 6** (ADMIN Void + Transfers) и **Slice 7** (touch-oriented `Касса` UI) через server-side command boundary.

## Граница (ADR-2026-08-POS-1)

POS — **отдельный операционный слой** на собственных кастомных объектах Twenty (`pos*`), а не расширение CRM `Order`.

Причины:
- Существующий CRM `OrderItem` имеет UNIQUE(`orderId`, `menuItemId`) — спека POS §11 требует, чтобы две одинаковые позиции были **независимыми строками** (этот unique-индекс несовместим).
- CRM `Order` привязан к Customer 360, импорту, агрегатам продаж и demo-сиду; у POS другой lifecycle (OPEN→IN_PROGRESS→PRECHECK_PRINTED→CLOSED), лифтайм смены, владение официантом, посадка на стол и гости.
- Расширение CRM-модели рискует регрессами в существующих отчётах без выигрыша.

Мост POS→CRM (pull в CRM Order/Item для отчётности) — будущий слайс, вне текущей границы.

Последствия:
- Все объекты POS имеют префикс `pos`.
- `PosStaff` — отдельная operational identity ресторана. `staffId`/`ownerStaffId` — UUID `PosStaff`, а не `workspaceMember`; это логические TEXT-поля без зависимости POS-команд от WorkspaceMember.
- Деньги: только `FieldType.CURRENCY` = `{ amountMicros, currencyCode }`, целые числа микров, без float.

## Operational identity и сессия

`Twenty WorkspaceMember` остаётся identity пользователя CRM/backoffice. POS не
доверяет `staffId` или `role` из HTTP body и не трактует
`TWENTY_APP_ACCESS_TOKEN` как identity официанта.

### PosStaff — РЕАЛИЗОВАНО

- Поля: `displayName`, `staffRole` (`WAITER|ADMIN`), `pinHash` (scrypt),
  `cardIdentifier`, `isActive`, служебные `failedLoginCount`/`lockedUntil`.
- Plaintext PIN не хранится и не возвращается. Запись недоступна generic UI.
- Card identifier — только lookup value, не криптографический секрет.

### PosSession — РЕАЛИЗОВАНО

- Поля: `sessionId`, `staffId`, `staffRole`, `tokenHash`, `issuedAt`, `expiresAt`,
  `revokedAt`, `terminalId`.
- `authenticatePosStaff` возвращает raw short-lived token только клиенту
  login-flow; в Twenty хранится только SHA-256 hash.
- Все остальные команды проходят `getAuthenticatedPosContext()`. Actor
  (`staffId`, `role`) получается из активной сессии, а не из body.
- `logoutPosStaff` ставит `revokedAt`; истёкшая, отозванная, tampered или
  inactive-staff сессия отклоняется.
- Базовый brute-force boundary: 5 неудач на credential key → 60 секунд
  lockout в процессе App. Это pilot guard, не распределённый WAF/rate limiter.

## Сущности

### 1. PosShift (Смена) — РЕАЛИЗОВАНО
- **Цель**: рабочая сессия официанта; заказы открываются внутри смены.
- **Владелец**: `staffId` из verified `PosSession`. Одна активная смена на сотрудника (гарантируется UNIQUE(`staffId`, `isOpen`) + атомарный claim по `isOpen=true`).
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
- **Владелец**: `ownerStaffId` из verified `PosSession` (официант, открывший заказ). `openedByStaffId` совпадает с owner на слайсе 1.
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
- Поля: `order` (N:1), `guest` (N:1), `menuItem` (N:1), `itemNameSnapshot`, `unitPrice` (CURRENCY snapshot), `quantity` (int ≥1), `kitchenSentQuantity` (server-owned cursor), `status` (ACTIVE/VOIDED), `voidedAt`/`voidReason`/`voidPreparedState`/`voidedByStaffId` (слайс 6), `createdByStaffId`, `idempotencyKey`.
- **Инварианты**:
  - Нет UNIQUE(`order`, `menuItem`) — идентичные позиции существуют как независимые строки.
  - Снапшот имени/цены не меняется командой (только quantity).
  - Spисанные строки не удаляются физически.
  - STOP_LISTED блокируется **на сервере** в `addLine` (проверка активной записи стоп-листа на момент команды — защита от stale-клиента).

### 7. PosMenuItem (Позиция меню) — РЕАЛИЗОВАНО (master data)
- Поля: `name`, `category`, `price` (CURRENCY), `isActive`, `lines` (1:N), `stopListEntries` (1:N). Редактирование меню — будущий слайс (не в слайсе 1).

### 8. PosStopListEntry (Стоп-лист) — Slice 2 РЕАЛИЗОВАН
- Поля: `label`, `menuItem` (N:1), `isActive`, `createdByStaffId`, `clearedAt`, `clearedByStaffId`, `idempotencyKey`.
- Одна lifecycle-запись на MenuItem переиспользуется при повторном включении. `addStopListEntry`/`clearStopListEntry` доступны WAITER и ADMIN, а `addLine` всегда проверяет свежий `isActive`; stale client получает `STOP_LISTED`.

### 9. KitchenPrint — Slice 2 РЕАЛИЗОВАН
- `PosKitchenTicket` + `PosKitchenTicketLine`: immutable `NEW_ITEMS` snapshot, guest attribution, action/quantity delta, actor и print status.
- `kitchenSentQuantity` различает sent/unsent; semantic hash и request key защищены unique indexes. Повтор без новых строк — `NO_UNSENT_LINES`; повтор/параллельный вызов не создаёт дубль.
- `KitchenPrintAdapter` отделяет physical printer; `MockKitchenPrintAdapter`
  remains the automated acceptance transport. Windows Spooler and Ethernet
  delivery are documented separately in `docs/SYSTEM_PRINTER_DISCOVERY.md`
  and `docs/PHYSICAL_PRINTING.md`; neither claims physical paper acceptance.

### 10. Precheck — Slice 3 РЕАЛИЗОВАН
- `PosPrecheck` хранит immutable order/guest monetary snapshot, actor, print status,
  lifecycle `ACTIVE → CANCELLED` и отдельные create/cancel idempotency keys.
- `createPrecheck` пересчитывает server totals, создаёт один active snapshot на
  order и переводит заказ в `PRECHECK_PRINTED`; server-side mutation lock
  запрещает гостей, строки, quantity и новые kitchen prints.
- `cancelPrecheck` доступен только ADMIN, сохраняет cancelled history и
  возвращает заказ в `IN_PROGRESS`; retry/crash recovery не создаёт второй
  snapshot.

### 11. PosPaymentMethod / PosPayment — Slice 4 РЕАЛИЗОВАН
- `PosPaymentMethod`: `name`, `methodType` (`CASH|CARD|OTHER`), `isActive`, `sortOrder`; seed создаёт Наличные и Карту, но домен не хардкодит банки.
- `PosPayment`: `order`, `paymentMethod`, `amount`, `status` (`PENDING|SUCCESS|REJECTED`), actor и method snapshots, `orderPaidTotalBefore`, `appliedToOrder`, unique `idempotencyKey` и per-order `lockKey`.
- `recordPayment` принимает только положительные целые micros на `PRECHECK_PRINTED`, сервер повторно считает remaining и отклоняет overpayment. Один pending payment сериализует concurrent writes; retry после crash завершает ровно одну запись.
- `closeOrder` разрешён только при remaining = 0, guarded `updatePosOrders` переводит заказ в `CLOSED`, записывает actor/time и освобождает table claim. Payment records immutable для operational UI; физический refund/void пока не реализован.

### 12. PosReservation — Slice 5 РЕАЛИЗОВАН
- POS-операционная бронь имеет relation `table`, optional `order`, `scheduledAt`,
  `guestName`, `phone`, status `ACTIVE|COMPLETED|CANCELLED|NO_SHOW`, creator и
  unique idempotency key. Overdue — derived (`scheduledAt < now` while ACTIVE),
  запись не удаляется автоматически. Attach разрешён только к заказу того же
  стола и не запрещает открыть заказ на забронированном столе.

### 13. PosPrepayment — Slice 5 РЕАЛИЗОВАН
- Отдельная финансовая запись (`amount`, optional payment method, reservation,
  optional order), lifecycle `UNAPPLIED → APPLIED`. Применение использует
  conditional update по статусу, поэтому retry/crash/parallel вызовы дают одну
  связь и один вклад. `PosOrder.prepaidTotal` всегда восстанавливается суммой
  APPLIED записей; предоплата не является скидкой.

### 14. PosOperationalEvent — Slice 6 РЕАЛИЗОВАН
- Append-only audit object с `eventType`, authenticated `actorStaffId`, временем,
  связанным order, безопасными JSON-деталями и unique idempotency key.
- Generic сотрудники могут только читать журнал; записи создаёт исключительно
  controlled command boundary.

### 15. Void order lines — Slice 6 РЕАЛИЗОВАН
- `voidOrderLines` доступна только ADMIN, физически не удаляет строки и пишет
  `voidedAt`, actor, prepared state и optional reason.
- Если строка уже была отправлена, создаётся immutable `CANCELLATION`
  `PosKitchenTicket`/`PosKitchenTicketLine` с действием `CANCEL`; повтор не
  создаёт вторую фишу. Если активных строк не осталось, статус заказа derived
  `CANCELLED`.

### 16. Transfer-команды — Slice 6 РЕАЛИЗОВАН
- ADMIN-only `transferOrderToTable`, `transferOrderToWaiter` и
  `transferOrderLinesToGuest` валидируют свободный стол, active staff,
  принадлежность guest/lines одному заказу и редактируемый lifecycle.
- Прямого generic update ownership/table/guest нет; каждая операция пишет
  `PosOperationalEvent` с from/to и affected IDs.

## Идемпотентность (слайс 1)
Каждая создающая команда несёт `idempotencyKey` (UUID) с unique-индексами:
`PosShift.idempotencyKey`, `PosOrder.idempotencyKey`, `PosOrderGuest.idempotencyKey`, `PosOrderLine.idempotencyKey`.
Повторный вызов с тем же ключом возвращает существующий объект (200), при
конфликте другого authenticated staff/context — `409 IDEMPOTENCY_CONFLICT`, без
создания дубля и без раскрытия первого результата.

Ключ не является безусловным глобальным алиасом: повтор принимается только если
контекст совпадает (staff для Shift, table/owner для Order, order/name для Guest,
order/guest/menu/quantity/creator для Line). Повтор с изменённым контекстом
получает `409 IDEMPOTENCY_CONFLICT`.

## Concurrency (слайс 1)
- Одна активная смена на staff: UNIQUE(`staffId`, `isOpen`).
- Один активный заказ на стол: UNIQUE(`tableId`, `claimToken`), `claimToken`=tableId пока открыт.
- Повторная сеть-команда: idempotency unique.
- `changeLineQuantity` last-write-wins (безопасно: безусловно меняет количество; документированное допущение слайса 1).

## Идемпотентность и деньги (слайс 4)
- `PosPayment.idempotencyKey` уникален и проверяется вместе с order, method,
  amount и authenticated actor; foreign reuse возвращает конфликт.
- `PosPayment.lockKey = orderId` существует только у одного `PENDING` payment,
  поэтому два терминала получают один успешный semantic result либо честный
  `PAYMENT_IN_PROGRESS`, после чего обычный retry re-reads победителя.
- `PosOrder.paidTotal` — server-owned aggregate успешных платежей. Он меняется
  guarded bulk update по id/status/текущему paidTotal; `remaining = total -
  paidTotal`, переплата и close при ненулевом остатке отклоняются.
- `PaymentMethod` snapshots сохраняются в payment и не позволяют изменению
  настройки метода задним числом переписать историю.
