# Mahabbat POS — Command Boundary

Архитектура команд: клиент не пишет в POS-объекты через GraphQL/REST напрямую; он вызывает серверные команды через **один HTTP-канал с подписью**. Это граница целостности (валидация + консистентность + вычисление итогов) и честный инструмент против stale-клиента до настоящей auth.

## Канал доставки (Slice 1)

```
POS UI (2nd terminal / web)
      │  POST /pos/command
      │  body: { command: <строка-команды>, payload: {...}, idempotencyKey }
      │  headers: x-mahabbat-signature = HMAC-SHA256(secret, canonicalString)
      ▼
[logic-function] pos-command.logic-function.ts
      │ isAuthRequired: true (де-факто API-ключ + подпись уже есть)
      │ fetch('{apiUrl}/webhooks/server/<resolver-uid>', { forwardedRequestHeaders: ['x-mahabbat-signature'] })
      ▼
[server action] pos-command.resolver.logic-function.ts  (src/logic-functions/)
      │  читает контекст, подпись, декодирует в envelope
      │  ctx: CommandContext { staffId, role }
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

Каждая команда несёт `idempotencyKey` и `actor`. Payload валидируется на клиенте и сервере (`src/pos/pos-command-input.ts`).

| Команда | Payload | Валидация | Допущения |
|---|---|---|---|
| `openShift` | `{ staffId }` | staffId UUID-формат | unique `(staffId, isOpen=true)`; повтор = существующий shift |
| `closeShift` | `{ shiftId }` | owner-проверка ctx.staffId | закрытые заказы не трогает |
| `openOrder` | `{ shiftId, tableId }` | активная смена, активный стол, free claim | idempotency на заказ |
| `addGuest` | `{ orderId, name? }` | заказ owner/OPEN-IN_PROGRESS | ordinal = max+1 |
| `addLine` | `{ orderId, guestId, menuItemId, quantity }` | guest-при-заказе (кроме snack), нет активной stopList, qty≥1 | snapshot цены, subtotal order/guest пересчёт |
| `changeLineQuantity` | `{ lineId, quantity }` | ACTIVE строка, qty≥1, owner, не закрытый | last-write-wins (допущение) |
| `addStopListEntry`/`clearStopListEntry`/`cancelOrder`/`voidLines`/`transfer*` | slice 2/3/6 | — | НЕ реализовано |

### Хранение
Объекты и их связи создаются как обычные записи Twenty (через CoreApiClientLike), но с **двумя гарантиями idempotency + unique** через индексы, перечисленные в `src/indexes/*` (см. POS_DOMAIN.md §Идемпотентность).

## Race-fallback (обязательный шаг dispatch)
Каждый execute пишет в ветке, где идём через transaction-подобную семантику:
1. пытаемся создать;
2. если падает на повторе/constraint (например, второй терминал занял claim) — **идемпотентный fallback**: ищем существующий объект по idempotencyKey (или claim, статус) и возвращаем его;
3. если и это невозможно — честная ошибка (не 500).

Та же логика покрывает `closeShift`, `openOrder` (double-transaction-конфликт на unique claim).

## Вычисления и статусы (server-owned)
- **subtotal/total** считаются в микроумножениях по sum -> integer safe math; после addLine/changeQuantity выполняется пересчёт `PosOrder.subtotal`, `PosOrder.total`, `PosOrderGuest.subtotal`.
- **status** строк/заказа не пишется клиентом; переходы — только через команды (см. POS_STATE_MACHINES.md).
- Стоп-лист: `addLine` проверяет `PosStopListEntry` с `isActive=true` по menuItem на момент команды.

## Открытые вопросы (за пределами slice 1)
- Настоящая auth/сессии (см. POS_PERMISSIONS.md).
- Канал между терминалами (WebSocket или polling вероятность открытых жизненных кейсов).
- Печать: printer adapter (slice 2), parsed в `KitchenPrint`/`Precheck` объекты.
- `x-mahabbat-signature`: HMAC-ключ на канал; в slice 1 — статический секрет, документированный в конфиг env `MAHABBAT_POS_HMAC_SECRET`.

## QA-указания
- План тест-кейсов приведён в POS_QA.md §Acceptance; dispatcher-тесты покрывают race + idempotency + stop-list + totals (src/pos/__tests__).