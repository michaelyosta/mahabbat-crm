# Mahabbat POS — State Machines

Источник истины по состояниям. Числовые постоянные зашиты в коде (см. `src/pos/pos-order-state.ts`); настоящие GraphQL enums — будущий слайс.

## PosSession

```
authenticatePosStaff ─► ACTIVE ─► EXPIRED
                              └► REVOKED (logout)
```

`ACTIVE` проверяется на каждом POS command. Сотрудник должен оставаться
`PosStaff.isActive=true`, а текущая роль должна совпадать с ролью в сессии.
Клиент не может продлить, изменить или подменить session actor.

## PosShift

```
        openShift
  (none) ──────────► OPEN ──────────► CLOSED
                       │              closeShift
                       │              (открытие заказа возможно)
                       │
                 STUCK? (эвристика: OPEN дольше N часов — UI-сигнал, не статус)
```
- Только один OPEN на authenticated `PosStaff.staffId` (unique). Повторный
  openShift = идемпотентный ответ.
- CLOSED не меняет принадлежность и не закрывает заказы.
- Команда заказа на закрытую смену: `SHIFT_REQUIRED` (сервер).

## PosOrder

```
 openOrder        addGuest        addLine          checkPrecheck(ADMIN)
 Site ──────► OPEN ────────► IN_PROGRESS ────► PRECHECK_PRINTED ───► CLOSED
                │  ▲                                  │              │
                │  │ changeLineQuantity               │ cancelPrecheck(ADMIN) ─┘
                │  │ addGuest / addLine               │ (server lock)
                │  └─ PREP (в слайсе 1 не существует  │
                │     отдельно на строках; строки      │ transferOrder*(ADMIN, slice 6)
                │     ACTIVE)                          └► Transfer готовит новый контекст
                │
                └─ (CANCEL_ORDER — slice 6)
```
Переходы и разрешения:
| Целевое        | Команда         | Роль   | Требования                                          |
|----------------|-----------------|--------|------------------------------------------------------|
| OPEN           | openOrder       | оба    | активная смена актора; активный стол; никто не занял claim* |
| IN_PROGRESS    | addGuest        | owner  | OPEN или IN_PROGRESS (незакрытый, не PRECHECK)        |
| IN_PROGRESS    | addLine         | owner  | OPEN или IN_PROGRESS; нет активной стоп-лист записи; гости уже добавлены (кроме snack addLine) |
| IN_PROGRESS    | changeLineQuantity | owner | только ACTIVE строки, qty ≥ 1, незакрытый заказ      |
| PRECHECK_PRINTED | createPrecheck | owner/ADMIN | server snapshot; add/change/guest/print locked |
| CLOSED         | closeOrder (remaining=0) | WAITER/ADMIN | Slice 4, server financial guard |
| (пер. в новый контекст) | transferOrder* | ADMIN | slice 6, НЕ реализовано                              |

*) Конфликт claim: второй `openOrder` на занятый стол — детерминированный уникальный конфликт; запись не создаётся. При ошибках доказуемо не создаётся частичный заказ (transaction + серии пересчётов идемпотентны).

## PosOrderLine / PosOrderGuest
- Line: `ACTIVE` → `VOIDED` (slice 6, сервер хранит voidPreparedState). В Slice 2
  `kitchenSentQuantity` отделяет unsent quantity от уже отправленной; quantity
  нельзя уменьшить ниже sent cursor до административного correction slice.
- Guest: объект создаётся/существует до удаления; удаление c удержанием истории — slice 6. Равенство гостей — по `ordinal`, не по id.

## Протухшие предоплаты / резервы
НЕТ auto-delete на сервере (спека §27). UI показывает negative timer; пользователь решает.

## Запрет списаний на закрытом / PRECHECK
После `PRECHECK_PRINTED` или `CLOSED` любые mutate-команды строк/гостей отклоняются сервером (защита целостности), даже если клиент ещё не знает о ликвидации.

## KitchenTicket (Slice 2)

`printKitchenTicket` создаёт immutable `NEW_ITEMS` snapshot только для активных
строк, где `quantity > kitchenSentQuantity`. Успешная команда продвигает cursor;
повтор без дельты возвращает `NO_UNSENT_LINES`. Semantic/request idempotency и
уникальная `(ticket, orderLine)` строка защищают retry/concurrency. Будущий
`CANCELLATION` ticket остаётся частью Slice 6.

## Precheck (Slice 3)

`createPrecheck` создаёт ровно один ACTIVE snapshot на заказ (`activeOrderKey`
unique), переводит заказ в `PRECHECK_PRINTED` и вызывает
`PrecheckPrintAdapter`. Повтор того же ключа или гонка возвращает тот же
snapshot и repair-ит статус заказа. `cancelPrecheck` — ADMIN-only; он сохраняет
историческую запись как `CANCELLED`, очищает active lock и возвращает заказ в
`IN_PROGRESS`. Отмена также идемпотентна по отдельному ключу.

## Payment / Close (Slice 4)

```
recordPayment ─► PENDING ─► SUCCESS
                    │          │
                    └──────► REJECTED (overpayment/invalid state)

PRECHECK_PRINTED + remaining>0 ──► order remains open
PRECHECK_PRINTED + remaining=0 ──closeOrder─► CLOSED
```

- Только `SUCCESS` входит в server-owned `PosOrder.paidTotal`; `PENDING`
  сериализует concurrent requests через unique order lock.
- Сервер отклоняет положительный платёж, превышающий `total - paidTotal`, и
  повторно проверяет остаток перед закрытием. `closeOrder` атомарно фиксирует
  actor/time и освобождает table claim; повтор ключа возвращает тот же результат.

## Reservation / Prepayment (Slice 5)

```
Reservation: ACTIVE ──► COMPLETED | CANCELLED | NO_SHOW
                         (ручная команда; overdue только derived UI state)

Prepayment: UNAPPLIED ──(CAS applyPrepayment)──► APPLIED
```

`applyPrepayment` принимает только одну победившую запись по статусному CAS;
повторный или параллельный вызов перечитывает уже применённую запись. После
каждого применения сервер пересчитывает `PosOrder.prepaidTotal` из всех
`APPLIED` предоплат. Финансовый остаток: `total - prepaidTotal - paidTotal`.

## Void / Transfers (Slice 6)

```text
ACTIVE line --(ADMIN voidOrderLines)--> VOIDED
ACTIVE order + all active lines = 0 -----------------> CANCELLED (derived)

Kitchen-sent VOIDED line --(same command)--> immutable CANCELLATION ticket
```

Void не удаляет строку. `preparedState`, reason, actor и время остаются в
строке; audit event дополнительно фиксирует список line IDs и ticket ID.
Transfer-команды не меняют ownership generic update: они проходят ADMIN-only
command boundary, проверяют состояние и создают append-only audit event.

## ESC
Выход из flow (пункт 6 спеки) — **клиентская симуляция**: закрывает модалку, ничего с итогами не делает. Никакого серверного состояния не трогает (слайс 1).
