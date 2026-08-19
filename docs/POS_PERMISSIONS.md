# Mahabbat POS — Permissions

## Правило (ультра-премиум, но честное)
На всех «Ультра-премиум» разрешениях действует максимально широкое-but-derived правило: владелец заказа = `ownerStaffId` == токен аутентификации. Реализация только на **level 1 (app-wide)** в `canUserAccessX`/roles; N/A на workspace-member level.

## Platform ограничение (документировано)
Twenty App на своём слое доверяет `staffId` из контекста команды. У нас это **не настоящие роли**: это клиент postлает `x-mahabbat-signature` (HMAC), которым сервер подписывает посылку, а роль `{staffId, role: WAITER|ADMIN}` идёт в контексте payload. Это документированный компромисс «лучше, чем ничего, а настоящая auth — за рамками FOUNDATION LOOP».

### Что это НЕ значит
- Не «роли платформы» (их нет).
- Не «полноценная server-side RBAC» для multi-user одноранговой сети.
- Не безопасная API-граница для интернета (слайс 6 должен ввести реальный auth/сессии).

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
| PosStopListEntry | R | стоп-лист (слайс 1: read; команды слайс 2) |
| Граф QP | R | любые read-запросы по POS-графу (для работы UI), polite limitation |

### ADMIN
Всё из WAITER + команды ADMIN-only (слайсы 3–6): checkPrecheck, cancelPrecheck, close, transfer*, cancelOrder, voidLines. Слайс 1 — только WAITER-набор (ADMIN пока не нужен для команд, но контекст готов).

## Физическая привязка owner (server-side)
- `openShift` → staffId из payload; смена привязана к staffId.
- `openOrder` → ownerStaffId = staffId из payload.
- `closeShift` → только смена, где `staffId == ctx.staffId`; чужая смена → `FORBIDDEN`.
- `openOrder` на стол, где уже есть активный заказ (чужой) → unique-конфликт → ошибка, запись не создаётся.
- `addGuest`/`addLine`/`changeLineQuantity` → только на заказе, где `ownerStaffId == ctx.staffId` (или ADMIN, слайс 3+).
- Будущее: `transferOrderToTable/ToWaiter` — ADMIN-only, на чужой смене невозможны (проверка на receiver-стороне).

## Открытая документация (честно)
Недостающие «настоящие» вещи на FOUNDATION LOOP (за пределами scope):
- реальная auth (сессии, password hashing, 2FA, refresh) — для Internet-развёртывания
- granular workspace-member RBAC (за ManageWorkspace)
- IP-whitelisting / rate limiting
- audit log (OperationalEvent — задокументирован, слайс 6)

## Что важно для QA
- WAITER НЕ может закрыть чужую смену/заказ (проверка owner, тесты есть).
- c двух терминалов: один закрыл смену — другой получает честную ошибку (не 500).
- bounded `:3000` + role-boundary-тесты = off.
- `isActive=false` столов/меню НЕ мешает открытию активной смены, но мешает openOrder/addLine на неактивном.