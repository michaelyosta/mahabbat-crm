# Mahabbat CRM

Mahabbat CRM — ресторанная CRM для одного бизнеса в Казахстане. Проект
использует **Twenty v2.29.0 как upstream-платформу** и отдельное приложение
Mahabbat, которое содержит ресторанную модель данных, интерфейс и правила
обработки. Это не новый fork Twenty и не CRM, написанная с нуля.

## Что предоставляет платформа

Twenty предоставляет self-hosted сервер, PostgreSQL-backed object API,
стандартные `Person`/workspace objects, роли и permissions, relations, views,
navigation, page layouts, front components и Apps SDK.

## Что реализует Mahabbat App

- клиентскую модель на стандартном `Person`;
- `Order`, `OrderItem`, `Reservation`, `LoyaltyLedgerEntry`;
- Customer 360 с реальными связями и вычисляемым loyalty balance;
- server-controlled loyalty adjustment boundary с idempotency и HMAC;
- нормализацию казахстанских телефонов и `provider + externalId` ingestion;
- read-only aggregate `SalesSnapshotLine` для исторических отчётов;
- Dashboard, views, Russian labels и demo navigation;
- русский пользовательский интерфейс CRM; настройка языка пользователя описана
  в [docs/LOCALIZATION.md](docs/LOCALIZATION.md);
- deterministic seed и smoke/import tooling.

## Архитектура и версии

- Upstream platform: `twentycrm/twenty:v2.29.0`.
- Twenty core modifications: **0**.
- Mahabbat source: `src/`.
- Tests and verification: `src/**/__tests__`, `src/**/*.test.ts`, `scripts/`.
- Deployment templates: `deploy/`.
- Physical Ethernet ESC/POS printing: `docs/PHYSICAL_PRINTING.md`.
- Windows system-printer discovery and routing: `docs/SYSTEM_PRINTER_DISCOVERY.md`.
- Temporary home-to-restaurant physical print bridge: `docs/TEMPORARY_REMOTE_PRINT_BRIDGE.md`.
- Project decisions and operational notes: `docs/`.

The app is intentionally kept as a separate repository from a local Twenty
checkout. The repository contains the Mahabbat App source and templates, not
the upstream Twenty monorepo.

## Environments

- `:2020` — disposable Linux/WSL Apps SDK development target.
- `:3000` — ordinary self-hosted Twenty v2.29.0 target.
- PostgreSQL — durable application data for the self-hosted target.
- Redis and worker — queues/background logic functions; they are internal.

The local development workflow is documented in [SETUP.md](SETUP.md). Runtime
credentials are supplied through private environment variables; see
[`.env.example`](.env.example) for names only. Never commit real values.

## Quick start without secrets in Git

```bash
yarn install
yarn twenty docker:start
yarn twenty dev
```

For tests or API tooling, export `TWENTY_API_URL`, `TWENTY_API_KEY`,
`MAHABBAT_API_URL` and `MAHABBAT_API_KEY` in the current private shell. The
integration suite requires a disposable target and is intentionally not a
shortcut to production data.

Useful checks:

```bash
yarn lint
yarn typecheck
yarn test:unit
yarn seed:demo:dry
```

## Known limitations

- Native Windows Apps SDK path handling is a development-environment
  limitation; App plan/apply is standardized through Linux/WSL.
- Twenty v2.29.0 does not expose a supported App way to hide all generic
  standard navigation entries.
- A composite App index over standard `Person` is unavailable, so the identity
  contract uses a unique server-controlled key field.
- Aggregate workbook rows are historical snapshots and never fabricate Orders.
- The current Customer 360 item query is bounded; production-scale pagination
  is a future slice.
- `:2020` and the ephemeral external demo are not production deployment.

See [docs/CODEMAP.md](docs/CODEMAP.md),
[docs/TECHNICAL_WALKTHROUGH.md](docs/TECHNICAL_WALKTHROUGH.md),
[docs/OPERATIONS.md](docs/OPERATIONS.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/QA.md](docs/QA.md), [docs/DECISIONS.md](docs/DECISIONS.md) and
[docs/TWENTY_GAPS.md](docs/TWENTY_GAPS.md) for the detailed source map,
operations and evidence.
