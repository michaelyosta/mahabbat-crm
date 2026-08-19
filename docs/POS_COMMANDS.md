# Mahabbat POS — Command Boundary

Архитектура команд: клиент не пишет в POS-объекты через GraphQL/REST напрямую; он вызывает серверные команды через **один HTTP-канал с подписью**. Это граница целостности (валидация + консистентность + вычисление итогов). POS staff identity проходит отдельный `PosSession` auth-context.

## Канал доставки (Slice 1)

```
POS UI (2nd terminal / web)
      │  POST /pos/command
      │  body: { command, payload, sessionToken? }
      │  headers: x-mahabbat-signature = HMAC-SHA256(secret, canonicalString)
      ▼
[logic-function] pos-command.logic-function.ts
      │ isAuthRequired: true (де-факто API-ключ + подпись уже есть)
      │ fetch('{apiUrl}/webhooks/server/<resolver-uid>', { forwardedRequestHeaders: ['x-mahabbat-signature'] })
      ▼
[server action] pos-command.resolver.logic-function.ts  (src/logic-functions/)
      │  читает подпись, декодирует envelope
      │  authenticatePosStaff → PosSession
      │  остальные команды → getAuthenticatedPosContext()
      ▼
[domain dispatch] src/pos/pos-command.dispatch.ts
      execute<Command>(input, db) ──► ops: read (QueryClientLike) / write
      во write-ветке: открывает transaction (savepoint), ловит unique/constraint,
      пересчитывает totals/status, на финише коммитит
```

### Функции и UID
| Функция | Файл | Примечание |
|---|---|---|
| POS_COMMAND_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER = `9be5d52e-b0a9-4b6f-b847-98f60a993634` | `src/logic-functions/pos-command.logic-function.ts` | HTTP `/pos/command` entry |
| POS_COMMAND_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER = `54be0dfa-2fd6-45bc-be93-6ba4c64a21d9` | `src/logic-functions/pos-command.resolver.logic-function.ts` | Server action, `forwardedRequestHeaders: ['x-mahabbat-signature']` |

## Упаковка (envelope) и payload-контракты

Каждая команда валидируется на клиенте и сервере (`src/pos/pos-command-input.ts`).
Создающие команды несут `idempotencyKey`; actor не передаётся клиентом.

| Команда | Payload | Валидация | Допущения |
|---|---|---|---|
| `authenticatePosStaff` | `{ pin }` или `{ cardIdentifier }` | PosStaff, scrypt, active, rate limit | создаёт short-lived PosSession |
| `logoutPosStaff` | `{}` | действующая PosSession | ставит `revokedAt` |
| `openShift` | `{ idempotencyKey }` | authenticated PosStaff | unique `(staffId, isOpen=true)`; повтор = существующий shift |
| `closeShift` | `{ shiftId }` | owner-проверка ctx.staffId | закрытые заказы не трогает |
| `openOrder` | `{ tableId, idempotencyKey }` | активная смена authenticated staff, активный стол, free claim | idempotency на заказ |
| `addGuest` | `{ orderId, name? }` | заказ owner/OPEN-IN_PROGRESS | ordinal = max+1 |
| `addLine` | `{ orderId, guestId, menuItemId, quantity }` | guest-при-заказе (кроме snack), нет активной stopList, qty≥1 | snapshot цены, subtotal order/guest пересчёт |
| `changeLineQuantity` | `{ lineId, quantity }` | ACTIVE строка, qty≥1, owner, не закрытый | last-write-wins (допущение) |
| `addStopListEntry` | `{ menuItemId, idempotencyKey }` | authenticated operational staff, active menu item | reuses one lifecycle row; idempotent |
| `clearStopListEntry` | `{ menuItemId, idempotencyKey }` | authenticated operational staff | idempotent state transition; no physical delete |
| `printKitchenTicket` | `{ orderId, idempotencyKey }` | order owner/admin, editable order | immutable `NEW_ITEMS` ticket with unsent deltas only |
| `createPrecheck` | Slice 3 | `{ orderId, idempotencyKey }` | server snapshot; ACTIVE precheck locks order |
| `cancelPrecheck` | Slice 3 | `{ orderId, idempotencyKey }` | ADMIN-only; cancelled snapshot unlocks order |
| `recordPayment` | Slice 4 | `{ orderId, paymentMethodId, amountMicros, idempotencyKey }` | PRECHECK_PRINTED; positive integer micros; server remaining/actor; retry-safe |
| `closeOrder` | Slice 4 | `{ orderId, idempotencyKey }` | remaining must be zero; guarded close releases table claim |
| `createReservation` | Slice 5 | `{ tableId, scheduledAt?, guestName?, phone?, idempotencyKey }` | table-linked, optional fields, derived overdue |
| `updateReservationStatus` | Slice 5 | `{ reservationId, status, idempotencyKey }` | owner/ADMIN, no automatic expiry/delete |
| `createPrepayment` | Slice 5 | `{ reservationId, paymentMethodId?, amountMicros, idempotencyKey }` | positive integer, immutable UNAPPLIED record |
| `applyPrepayment` | Slice 5 | `{ prepaymentId, orderId, idempotencyKey }` | CAS exactly-once; recomputes prepaid aggregate |
| `attachReservationToOrder` | Slice 5 | `{ reservationId, orderId, idempotencyKey }` | same-table only; applies remaining UNAPPLIED prepayments |
| `voidOrderLines` | Slice 6 | `{ lineIds[], preparedState, reason?, idempotencyKey }` | ADMIN-only; immutable void fields; sent lines create `CANCELLATION` ticket |
| `transferOrderToTable` | Slice 6 | `{ orderId, targetTableId, idempotencyKey }` | ADMIN-only; target must be active and free; audit event |
| `transferOrderToWaiter` | Slice 6 | `{ orderId, targetStaffId, idempotencyKey }` | ADMIN-only; target PosStaff must be active; audit event |
| `transferOrderLinesToGuest` | Slice 6 | `{ lineIds[], targetGuestId, idempotencyKey }` | ADMIN-only; same-order active guest/lines; audit event |

### Хранение
Объекты и их связи создаются как обычные записи Twenty (через CoreApiClientLike), но с **двумя гарантиями idempotency + unique** через индексы, перечисленные в `src/indexes/*` (см. POS_DOMAIN.md §Идемпотентность).

## UI reference

`prototypes/mahabbat-pos-ultra-premium.html` — standalone-прототип touch-oriented POS UI. Он используется как reference для будущей последовательности экранов (POS → зал → стол → гости → меню → заказ → оплата), размеров touch-targets и русских operational labels. Прототип не является runtime, источником данных или security boundary.

Реальный UI `src/front-components/pos.front-component.tsx` вызывает
`authenticatePosStaff`, хранит короткоживущий `sessionToken` только в памяти
компонента, передаёт его в POS commands и очищает при logout. Поля `actor`,
`staffId` и `role` из прототипа/клиента не отправляются как доверенный контекст:
actor выводится сервером из `PosSession`. `prototypes/mahabbat-pos-ultra-premium.html`
остаётся только визуальным reference; runtime-данные и security boundary
находятся в App/API.

## Race-fallback (обязательный шаг dispatch)
Каждый execute пишет в ветке, где идём через transaction-подобную семантику:
1. пытаемся создать;
2. если падает на повторе/constraint (например, второй терминал занял claim) — **идемпотентный fallback**: ищем существующий объект по idempotencyKey (или claim, статус) и возвращаем его;
3. если и это невозможно — честная ошибка (не 500).

Та же логика покрывает `closeShift`, `openOrder` (double-transaction-конфликт на unique claim).

Idempotency replay is context-bound. The resolver compares the stored command
context before returning an existing record; a key reused for another
authenticated staff, table, order, guest or line payload returns
`409 IDEMPOTENCY_CONFLICT` instead of exposing or mutating the first result.

## Вычисления и статусы (server-owned)
- **subtotal/total** считаются в микроумножениях по sum -> integer safe math; после addLine/changeQuantity выполняется пересчёт `PosOrder.subtotal`, `PosOrder.total`, `PosOrderGuest.subtotal`.
- **status** строк/заказа не пишется клиентом; переходы — только через команды (см. POS_STATE_MACHINES.md).
- Стоп-лист: `addLine` проверяет `PosStopListEntry` с `isActive=true` по menuItem на момент команды. `addStopListEntry` и `clearStopListEntry` проходят через тот же command boundary; stale client получает `STOP_LISTED`.
- Kitchen print: `PosOrderLine.kitchenSentQuantity` — server-owned cursor. `printKitchenTicket` строит semantic hash текущих unsent deltas и сохраняет его в unique `PosKitchenTicket.idempotencyKey`; request key также unique. Retry/два терминала re-read уже созданную фишу и не создают duplicate ticket/line.
- `KitchenPrintAdapter` (`src/pos/kitchen-print-adapter.ts`) отделяет домен от физического принтера. В Slice 2 применяется `MockKitchenPrintAdapter`; printable ticket immutable в data plane.
- Precheck: `createPrecheck` пересчитывает totals на сервере, сохраняет immutable guest/order snapshot и переводит заказ в `PRECHECK_PRINTED`. Повтор repair-ит lock после crash; `cancelPrecheck` доступен только ADMIN, помечает snapshot `CANCELLED` и возвращает заказ в `IN_PROGRESS`.
- Payment: `recordPayment` creates one server-owned PENDING record per order,
  advances `paidTotal` through a guarded `updatePosOrders` filter and finalizes
  it as SUCCESS. The unique idempotency key and per-order pending lock make
  retry, crash repair and concurrent requests converge without double charge.
  `closeOrder` requires zero remaining and atomically sets CLOSED/clears claim.

## Открытые вопросы (за пределами Slice 4)
- 2FA, refresh rotation и distributed rate limiting (pilot session boundary уже реализован).
- Канал между терминалами (WebSocket или polling вероятность открытых жизненных кейсов).
- Физическая печать: текущие `KitchenPrintAdapter` и `PrecheckPrintAdapter` — mock/debug boundaries.
- Payments deliberately stop at CASH/CARD/OTHER records and server remaining;
  refunds, change and bank-terminal integrations are outside the pilot.
- `x-mahabbat-signature`: HMAC-ключ на канал; в slice 1 — статический секрет, документированный в конфиг env `MAHABBAT_POS_HMAC_SECRET`.

## QA-указания
- План тест-кейсов приведён в POS_QA.md §Acceptance; dispatcher-тесты покрывают race + idempotency + stop-list + totals (src/pos/__tests__).
