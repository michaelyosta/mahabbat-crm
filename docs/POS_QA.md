# Mahabbat POS — QA / Verification Plan

Соответствует §44 спеки. Полные локальные гейты — `yarn typecheck`, `yarn test:unit`, `yarn lint` (в `mahabbat-app`). Изменение схемы (объекты/индексы) → plan/apply через SDK на оба стека (`:2020` dev, `:3000` bounded) + перегенерить GraphQL, если затронуты типы.

## Unit / boundary
- `src/pos/__tests__/pos-money.test.ts` — микро-математика (сложение, хрупкость bigint-safe, KZT-unicity).
- `src/pos/__tests__/pos-order-state.test.ts` — таблица переходов, запреты после PRECHECK/CLOSED.
- `src/pos/__tests__/pos-permissions.test.ts` — owner-проверки; WAITER не закрывает чужое.
- `src/pos/__tests__/pos-command-input.test.ts` — рваные payload, ID валидация, envelope.
- `src/pos/__tests__/pos-domain.test.ts` — FakePosDb: unique race (два терминала), idempotency-повтор, stop-list block, totals/status recompute.
- `src/pos/__tests__/pos-domain.test.ts` — foreign idempotency-key reuse across
  authenticated staff contexts is rejected with an honest conflict.
- `src/pos/__tests__/pos-auth.test.ts` — scrypt PIN, card/inactive staff,
  short-lived session, expiry, revocation, tamper and brute-force boundary.
- `src/pos/__tests__/pos-command-input.test.ts` — client actor/role rejection;
  command payload no longer carries trusted staff identity.
- `src/roles/__tests__/pos-roles-permission-boundary.test.ts` — role-level CRUD границы.
- График: `yarn test:unit` (сейчас 230 passed / 20 файлов); новые кейсы добавляются через `yarn test:unit -- --runInBand <file>` (в Windows) или `npx jest scripts`-паттерн в Linux-контейнере.

## Runtime acceptance (:2020 — dev workspace)
1. `seed-pos`: `MAHABBAT_API_URL=... MAHABBAT_API_KEY=... MAHABBAT_POS_SEED_ADMIN_PIN=... MAHABBAT_POS_SEED_WAITER_PIN=... yarn seed:pos` → deterministic master data plus the `POS Acceptance` zone and `POS-A1`/`POS-A2`/`POS-A3` tables. Repeated runs create no duplicates and reconcile only the two synthetic PIN hashes. `--dry-run` reports the plan without writes.
2. **authenticatePosStaff** → short-lived session; wrong/inactive credentials denied; tampered session and client actor/role spoofing rejected; `openShift` derives staff from that session.
3. Повтор с тем же idempotencyKey → та же смена; второй distinct-вызов на тот же staffId → уникальный конфликт → НЕ две смены.
4. **openOrder** (свободный стол, активная смена) → `status=OPEN`, `claimToken=tableId`, owner = staff из verified session. Повтор с тем же ключом → тот же заказ. Второй openOrder на занятый стол → честная ошибка (не 500, дубля нет).
5. **addGuest ×2** → ordinal 1,2, displayNumber «Гость 1/2».
6. **addLine** (guest, menu item, qty) → позиция со snapshot имени/цены, subtotal order/guest пересчитаны; второй одинаковый addLine → независимая строка (НЕ merge); addLine на активный стоп-лист → отклонён.
7. **Stop list + PRINT**: WAITER ставит/снимает позицию; stale addLine получает `STOP_LISTED`; первый print создаёт один `NEW_ITEMS` ticket, retry/no-op не дублирует, новые quantity создают delta ticket; параллельный print сходится к одному semantic ticket.
8. **changeLineQuantity** → totals обновились; qty=0 → отклонён; уменьшение уже отправленной quantity → `LINE_ALREADY_SENT`.
8. **closeShift** → `status=CLOSED`, `isOpen=null`; открыть заказ на закрытую смену → SHIFT_REQUIRED.
9. **CRM smoke** (:2020): обычные люди/заказы читаются/создаются как раньше; POS-объекты не ломают стандартную схему (core 0 изменений).
10. **Concurrency race**: два параллельных `openOrder` на один стол / два `openShift` на один staffId / повтор `addLine` с одним ключом → не более одного результата (FakePosDb в тестах + live-проверка скриптом curl/xargs).

## Bounded validation (:3000 — compose %26 bounded-stack)
- Plan/apply той же конфигурации SDK → интеграция не падает, workspace-рабочий.
- Роль/функции/индексы применены; seed читается; команды POS работают в ограниченном стеке (bounded = только expected objects).
- Regression: CRM-фикстуры (seed-demo) не трогаются POS-планом.
- The same deterministic acceptance harness is run after the disposable pass; it must use
  `MAHABBAT_POS_PIN_A=ADMIN` and `MAHABBAT_POS_PIN_B=WAITER` and must not select
  arbitrary occupied restaurant tables.

## Live Slice 5 result — 2026-08-20

- `:2020`: PASS, 73/73 checks. Reservation creation/retry, optional fields,
  derived overdue, same-table attach, parallel exactly-once prepayment apply,
  prepaid remaining, payment/close and all previous Slice 1–4/CRM checks pass.
- `:3000`: PASS, the same 73/73 checks after identical manifest plan/apply;
  replan on both targets reports `No changes` and Twenty core changes remain 0.
- Unit: 227/227; lint/typecheck PASS. `MockKitchenPrintAdapter` and
  non-fiscal payments remain the declared pilot boundaries.

## Live Slice 6 result — 2026-08-20

- `:2020`: PASS, 78/78 checks. ADMIN-only line void records immutable void
  metadata; sent lines produce one `CANCELLATION` kitchen ticket and retry
  does not duplicate it. Table, waiter and guest-line transfers produce
  append-only `PosOperationalEvent` audit rows. Waiter denial, prior Slice 1–5
  idempotency/concurrency and CRM smoke also pass.
- `:3000`: PASS, the same 78/78 deterministic checks after identical
  plan/apply; replan on both targets returned `No changes`.
- Local gates: `yarn lint`, `yarn typecheck`, `node --check
  scripts/accept-pos.mjs`, and `yarn test:unit` pass (227 tests). Twenty core
  modifications remain 0.
- Physical printer, fiscalization, refunds and bank-terminal behavior remain
  outside this pilot; cancellation output uses the existing mock adapter.

## Live Slice 7 result — 2026-08-20

- `:2020`: PASS, the full 78/78 command acceptance remained green after the
  demo-role permission update. It still covers stop-list, kitchen delta,
  precheck lock, payments, reservations/prepayment, void/transfer, audit,
  concurrency, idempotency and CRM smoke.
- `:3000`: PASS, the same 78/78 API checks passed after identical plan/apply;
  sequential replans on both targets returned `No changes`.
- Browser on self-hosted `:3000`: PASS for the real `Касса` front component:
  synthetic POS PIN login, open shift, zone/table selection, open order,
  two guests, lines with server totals, reload and re-authentication,
  kitchen print, precheck lock, payment and close/release. The data was
  reloaded from the server after the browser refresh.
- The app remains App-only with Twenty core modifications `0`. The UI keeps
  `PosStaff`/`PosSession` out of the read-only demo role to avoid exposing
  authentication hashes; transfer-to-waiter remains available at the
  server command/API boundary rather than exposing staff records to the demo
  browser.
- Local gates: `yarn lint`, `yarn typecheck`, `yarn test:unit` (230/230).

## CJ (frontend-IST)
- Не входит в runtime acceptance slice 1 (серверная граница). Пользовательский сценарий клиента через Vue компоненты — слайс UI (отдельно от slice 1).

## Exit criteria (STOP после чистого PASS)
- [x] typecheck чисто
- [x] `yarn test:unit` зелёный (230 tests)
- [x] `yarn lint` 0 warnings/errors
- [x] seed-pos idempotent на :2020 (staff provisioning uses private PIN env)
- [x] auth/domain unit tests: `yarn test:unit` (230 tests)
- [x] acceptance flow прошёл на :2020 (`scripts/accept-pos.mjs`, 78 checks)
- [x] concurrency race подтверждён (не более 1 смены/заказа, ошибка не 500)
- [x] CRM smoke на :2020 (people+orders не сломались)
- [x] :3000 plan/apply + тот же POS command acceptance (78 checks)
- [x] acceptance tables are deterministic and reconciliation is limited to POS Acceptance fixtures
- [x] документация и текущий execution order обновлены

## Live Slice 1 result — 2026-08-19

- `:2020`: PASS, 47/47 checks. This covered ADMIN/WAITER PIN-role mapping,
  authenticated context, spoof/tamper rejection, shift idempotency, owner checks,
  deterministic tables, one-order-per-table concurrency, multiple guests,
  independent duplicate menu lines, server totals, reload/second-client state,
  close-shift-with-open-order, concurrent add-line idempotency and CRM smoke.
- `:3000`: PASS, the same 47/47 checks after the same App plan/apply. The
  self-hosted runtime initially had a stale temporary SDK layer without `posStaffs`;
  only that non-persistent runtime cache was removed and rebuilt. No Twenty core
  source or persistent data was changed for the fix.
- Acceptance credentials and PINs are local synthetic values only; they are not
  committed, logged or reused as production credentials.

## Slice 2 live result — 2026-08-19

- `:2020`: PASS, 55/55 checks: stop-list lifecycle, stale-client rejection,
  first/retry/no-op/delta PRINT, parallel PRINT convergence, sent-quantity guard,
  persistence, Slice 1 races and CRM smoke.
- `:3000`: PASS, 55/55 checks with the same manifest and deterministic fixtures.
- Kitchen output uses `MockKitchenPrintAdapter`; no physical printer or fiscal
  integration is claimed. Twenty core modifications remain `0`.

## Slice 4 live result — 2026-08-19

- `:2020`: PASS, 68/68 checks. `recordPayment` accepts configurable methods,
  serializes parallel same-key requests, rejects overpayment, reaches remaining
  zero with partial payments, and `closeOrder` releases the table with retry.
- `:3000`: PASS, the same 68/68 deterministic checks after the same plan/apply;
  CRM smoke and all prior Slice 1–3 checks remained green.
- Unit: 227/227; lint and typecheck PASS. Twenty core modifications: 0.
  Payments remain non-fiscal records; no bank terminal or refund semantics are
  claimed.

## Не входит в этот маршрут
Физическая печать, fiscalization, refunds, bank-terminal APIs, inventory и
полноценные Internet auth controls (2FA, refresh rotation, distributed rate
limiting) остаются отдельными инициативами. Slice 2–7 реализованы и
проверены; следующий шаг требует отдельного human product review.
