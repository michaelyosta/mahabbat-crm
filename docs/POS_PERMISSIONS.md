# Mahabbat POS — Permissions

## Правило (ультра-премиум, но честное)
На всех «Ультра-премиум» разрешениях действует максимально широкое-but-derived правило: владелец заказа = `ownerStaffId` == токен аутентификации. Реализация только на **level 1 (app-wide)** в `canUserAccessX`/roles; N/A на workspace-member level.

## Operational auth boundary

`Twenty WorkspaceMember` используется для CRM/backoffice, но не является POS
identity. `TWENTY_APP_ACCESS_TOKEN` — service credential data plane и не является
identity официанта.

POS login выполняется командой `authenticatePosStaff` по PIN или card identifier.
Сервер ищет `PosStaff`, проверяет `isActive`, scrypt PIN hash и rate/backoff
boundary, затем создаёт короткую `PosSession`. В Twenty хранится только
`tokenHash`; raw token возвращается только login-клиенту.

Для каждой команды, кроме login, resolver вызывает
`getAuthenticatedPosContext()`. Поэтому `actorStaffId` и `actorRole` всегда
получаются из verified session. Поля `body.staffId`, `body.actorStaffId` и
`body.role` отсутствуют в рабочем контракте и client-supplied `actor` отвергается.

### Что это НЕ значит
- Не «роли платформы» (их нет).
- Не «полноценная server-side RBAC» для multi-user одноранговой сети.
- Не полноценная Internet auth platform: внешний route всё ещё требует Twenty
  route authentication, а pilot rate limit хранится в памяти процесса.

### Что это значит на практике
- Все POS-объекты на уровне ролей — read-only для WAITER (кроме явных exceptions, кк-бд).
- Контекст `role=ADMIN` используется **только** для команд, явно помеченных ADMIN-only (bounded).
- Server-resolver с `auth context` принудительно блокирует криминальные переходы (напр., `closeShift` по чужой смене блокируется owner-проверкой на сервере).

## Действительные разрешения (initial server enforcement)

### WAITER
| Объект | CRUD | Описание |
|---|---|---|
| PosZone | R | просмотр зон |
| PosTable | R | просмотр столов |
| PosMenuItem | R | меню |
| PosShift | R + создание открытой | открыть/закрыть СВОЮ смену |
| PosOrder | R + создать открытый | открыть СВОЙ заказ; НЕ видит чужие в read views (только через смену/стол) |
| PosOrderGuest | R/W | guest-ы СВОЕГО заказа |
| PosOrderLine | R/W | линии СВОЕГО заказа |
| PosStopListEntry | R | просмотр стоп-листа; add/clear через команды |
| PosKitchenTicket / PosKitchenTicketLine | R | immutable kitchen history; создание только через print command |
| Граф QP | R | любые read-запросы по POS-графу (для работы UI), polite limitation |

### ADMIN
Всё из WAITER + реализованные ADMIN-only команды `cancelPrecheck`,
`voidOrderLines`, `transferOrderToTable`, `transferOrderToWaiter` и
`transferOrderLinesToGuest`. Stop-list и
`printKitchenTicket` доступны обоим operational roles в текущем Slice 2.

## Физическая привязка owner (server-side)
- `openShift` → staffId из verified `PosSession`.
- `openOrder` → ownerStaffId/openedByStaffId = staffId из verified `PosSession`.
- `closeShift` → только смена, где `staffId == ctx.staffId`; чужая смена → `FORBIDDEN`.
- `openOrder` на стол, где уже есть активный заказ (чужой) → unique-конфликт → ошибка, запись не создаётся.
- `addGuest`/`addLine`/`changeLineQuantity` → только на заказе, где `ownerStaffId == ctx.staffId` (или ADMIN, слайс 3+).
- Будущее: `transferOrderToTable/ToWaiter` — ADMIN-only, на чужой смене невозможны (проверка на receiver-стороне).

## Открытая документация (честно)
Ограничения, оставшиеся за пределами foundation:
- 2FA, refresh-token rotation и распределённый rate limiter для Internet-развёртывания
- granular workspace-member RBAC (за ManageWorkspace) для CRM, не POS identity
- IP-whitelisting и edge policy
- полноценный distributed audit/event-sourcing pipeline (bounded
  `PosOperationalEvent` для критичных Slice 6 действий уже реализован)

## Что важно для QA
- WAITER НЕ может закрыть чужую смену/заказ (проверка owner, тесты есть).
- c двух терминалов: один закрыл смену — другой получает честную ошибку (не 500).
- bounded `:3000` + role-boundary-тесты = off.
- `isActive=false` столов/меню НЕ мешает открытию активной смены, но мешает openOrder/addLine на неактивном.

## Read-only demo UI

Роль Twenty `Mahabbat Demo User` получает только `canReadObjectRecords` для
операционных POS-объектов, необходимых странице `Касса`, без create/update/
delete, settings или tools. `PosStaff` и `PosSession` намеренно не входят в
эту read-поверхность: browser demo не должен получать PIN hashes или записи
сессий. POS ADMIN/WAITER authorization по-прежнему выполняется внутри
Mahabbat command boundary после PIN-аутентификации; разрешение Twenty на
чтение не заменяет эту проверку.
