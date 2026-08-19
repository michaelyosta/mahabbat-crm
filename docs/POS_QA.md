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
- График: `yarn test:unit` (сейчас 222 passed / 20 файлов); новые кейсы добавляются через `yarn test:unit -- --runInBand <file>` (в Windows) или `npx jest scripts`-паттерн в Linux-контейнере.

## Runtime acceptance (:2020 — dev workspace)
1. `seed-pos`: `MAHABBAT_API_URL=... MAHABBAT_API_KEY=... yarn seed:pos` → зоны/столы/меню созданы; повторный запуск — 0 создано; `--dry-run` сообщает план без записи.
2. **authenticatePosStaff** → short-lived session; wrong/inactive credentials denied; tampered session and client actor/role spoofing rejected; `openShift` derives staff from that session.
3. Повтор с тем же idempotencyKey → та же смена; второй distinct-вызов на тот же staffId → уникальный конфликт → НЕ две смены.
4. **openOrder** (свободный стол, активная смена) → `status=OPEN`, `claimToken=tableId`, owner = staff из verified session. Повтор с тем же ключом → тот же заказ. Второй openOrder на занятый стол → честная ошибка (не 500, дубля нет).
5. **addGuest ×2** → ordinal 1,2, displayNumber «Гость 1/2».
6. **addLine** (goosh, menu item, qty) → позиция со snapshot имени/цены, subtotal order/guest пересчитаны; второй одинаковый addLine → независимая строка (НЕ merge); addLine на активный стоп-лист → отклонён.
7. **changeLineQuantity** → totals обновились; qty=0 → отклонён.
8. **closeShift** → `status=CLOSED`, `isOpen=null`; открыть заказ на закрытую смену → SHIFT_REQUIRED.
9. **CRM smoke** (:2020): обычные люди/заказы читаются/создаются как раньше; POS-объекты не ломают стандартную схему (core 0 изменений).
10. **Concurrency race**: два параллельных `openOrder` на один стол / два `openShift` на один staffId / повтор `addLine` с одним ключом → не более одного результата (FakePosDb в тестах + live-проверка скриптом curl/xargs).

## Bounded validation (:3000 — compose %26 bounded-stack)
- Plan/apply той же конфигурации SDK → интеграция не падает, workspace-рабочий.
- Роль/функции/индексы применены; seed читается; команды POS работают в ограниченном стеке (bounded = только expected objects).
- Regression: CRM-фикстуры (seed-demo) не трогаются POS-планом.

## CJ (frontend-IST)
- Не входит в runtime acceptance slice 1 (серверная граница). Пользовательский сценарий клиента через Vue компоненты — слайс UI (отдельно от slice 1).

## Exit criteria (STOP после чистого PASS)
- [x] typecheck чисто
- [x] `yarn test:unit` зелёный (222 tests)
- [x] `yarn lint` 0 warnings/errors
- [ ] seed-pos idempotent на :2020 (staff provisioning uses private PIN env)
- [x] auth/domain unit tests: `yarn test:unit` (222 tests)
- [ ] acceptance 2–10 прошли на :2020 (скрипт/curl)
- [ ] concurrency race подтверждён (не более 1 смены/заказа, ошибка не 500)
- [ ] CRM smoke на :2020 (people+orders не сломались)
- [ ] :3000 plan/apply + POS command smoke
- [ ] график и вопросы документации закрыты

## Не входит в этот маршрут
Платежи, печать, предоплаты, void, transfer, стоп-лист-команды и аудит —
слайсы 2–6/отдельные инициативы. POS PIN/card auth context уже реализован в
текущем Slice 1; полноценные Internet auth controls (2FA, refresh rotation,
distributed rate limiting) остаются отдельной инициативой.
