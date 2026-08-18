# PRE-POS STATE REPORT

Документ — входная точка фазы PRE-POS HARDENING перед разработкой POS.
Резюмирует, что уже PASS, что требует изменения, приоритеты P0/P1 и что
не трогать. Источник истины — код зафиксированный в `93671a1` + живые
проверки, а не только документация.

## Уже PASS (базовая линия, подтверждена в сессии)

- Автоматические гейты: `yarn lint` (0 warnings/0 errors, 70 файлов),
  `yarn typecheck` (tsgo), `yarn test:unit` (6 файлов, 110 тестов),
  `yarn seed:demo:dry` — все PASS.
- Twenty и SDK запинованы на `v2.29.0`, `twenty-sdk`/`twenty-client-sdk`
  `2.29.0`; Twenty core (`../packages/**`) не модифицирован и не должен
  модифицироваться.
- Контролируемая граница записи лояльности: PENDING request ->
  database-event processor -> append-only `LoyaltyLedgerEntry`, unique
  `sourceRequestId` exactly-once, cron backstop, route
  `/s/loyalty/adjustments` + app-only resolver (HMAC). Проверена ранее на
  `:2020` и `:3000`.
- Контракт идентичности Person: `externalIdentityKey` (PROVIDER::externalId),
  защищённые поля, retry/race converge. Проверен в тестах и smoke на обоих
  таргетах.
- `SalesSnapshotLine` изолирован от операционных Orders; Dashboard читает
  агрегатную историю и операционные заказы раздельно.
- Роли: Mahabbat Staff — ledger read-only; Mahabbat Demo User — read-only;
  App function role не назначается пользователям/агентам/API-ключам.

## Требует изменения (слайсы H1–H10)

| Слайс | Проблема (подтверждено кодом) | Приоритет |
| --- | --- | --- |
| H1 Бонусный баланс | Баланс считается клиентом из усечённой выборки `first:100` ledger (`customer-360.front-component.tsx:166, 353-355`). Клиент с >100 записями получит неверный баланс. | P0 |
| H2 Разрушающие права | Mahabbat Staff имеет `canDestroyObjectRecords: true` на Person, Order, OrderItem, Reservation (`mahabbat-staff.role.ts:37-66`). Нет создания/редактирования ledger — ок, но жёсткое/мягкое удаление операционных записей небезопасно. | P0 |
| H3 lastActivityAt | `lastActivityAt` пишется только сидом (`scripts/seed-demo.mjs:102`) и защищён в identity-import. Серверного монотонного обновления нет, поэтому сегмент «Не возвращались 30 дней» деградирует. | P1 |
| H4 CI-воспроизводимость | `ci.yml` использует `TWENTY_VERSION: latest` и `twentyhq/twenty/.github/actions/...@main` — невоспроизводимо. | P0 |
| H5 CD-шлюз | `cd.yml` — `workflow_dispatch` с произвольным `target_url` и одним секретом `TWENTY_DEPLOY_API_KEY`; нет Environments. | P0 |
| H6 Публикация | `publish.yml` активен (тег `v*` / dispatch) и публикует в npm. Решение о дистрибуции остаётся UNDECIDED; гейт не настроен. | P0 |
| H7 Регрессионные тесты | Инварианты `processLoyaltyAdjustmentRequest` (retry/idempotency/concurrency/recovery) покрыты только ручными QA-заметками (`docs/QA.md`), нет исполняемых регрессионных тестов. | P0 |
| H8 Безопасность тестов | `src/__tests__/global-setup.ts` деструктивно делает `appUninstall`+`appDevOnce` по `TWENTY_API_URL` без fail-closed guard. | P0 |
| H9 Брендинг-overlay | `deploy/mahabbat-branding.Dockerfile` делает строковые замены без assertion; пропуск цели молча даёт не-брендированный образ. | P1 |
| H10 Граница POS | Нет `docs/POS_BOUNDARY.md`: модель POS (order-identity, зоны/столы, будущие POS-сущности, серверные команды). | P1 |

## P0 (блокеры, делать первыми в этом порядке)

1. H1 — корректный серверный баланс или полный курсорный обход; ledger остаётся
   источником истины.
2. H7 — исполняемые регрессионные тесты процессора (до/после любых правок H1).
3. H2 — снять/ограничить destroy на операционных объектах у Staff.
4. H4, H5, H6 — пиннинг CI, Environments для CD, гейт/отключение publish +
   `docs/DISTRIBUTION_DECISION.md`.
5. H8 — fail-closed guard для деструктивных тестов.

## P1 (сделать после P0)

- H3 — серверное монотонное обновление `lastActivityAt` (проверяемое).
- H9 — assertions в брендинг-overlay.
- H10 — `docs/POS_BOUNDARY.md`.
- Отчётные артефакты: `docs/PRE-POS-CHECKLIST.md`, итоговый `PRE-POS HARDENING
  REVIEW` с PASS/BLOCKED по критериям A–M.

## Не трогать

- Twenty core `../packages/**` и любые файлы core checkout.
- `scripts/seed-demo.mjs` поведение (повторный запуск = noop) и контракт
  идентичности — только расширять тестами, не менять семантику.
- Контракт controlled ledger writer: ослаблять нельзя, только добавлять
  проверки/тесты.
- `.env`, ключи, HMAC-секрет, приватный workbook, recovery-точка — не коммитить.
- Рабочий self-hosted `:3000` — как production-like; деструктивные операции
  только против одноразового `:2020`.
- `publish.yml`/CD поведение не менять отдельно от решения по дистрибуции
  (сначала `DISTRIBUTION_DECISION.md`).

*Дата: 2026-08-18. База: commit `93671a1`. Среда: Windows, сервер `:3000` healthy,
одноразовый `:2020` остановлен.*