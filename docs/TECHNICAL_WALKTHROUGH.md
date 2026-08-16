# Технический walkthrough

Документ объясняет систему владельцу проекта простым языком, но без
архитектурных подмен.

## Что происходит после открытия CRM

Браузер открывает self-hosted Twenty server на `:3000` (или disposable Apps
server на `:2020`). Server отдаёт собранный Twenty frontend и API. Frontend
аутентифицирует пользователя через Twenty, загружает workspace metadata и
показывает native navigation, views и page layouts. Когда открывается Person,
Twenty page layout запускает Mahabbat front component из App manifest.

Front component не является отдельным публичным сервером: он исполняется в
поддерживаемом Twenty sandbox и обращается к authenticated Twenty API. Поэтому
страница Customer 360 получает реальные Person, Order, OrderItem, Reservation и
LoyaltyLedgerEntry, а не mock cards.

## Где что работает

- **Twenty platform** — server, authentication, workspace UI, object API,
  permissions, relations, views, page-layout runtime и Apps SDK.
- **Mahabbat App** — этот репозиторий: object/field/relation definitions,
  roles, front component, logic functions, import contracts, seed и tests.
- **PostgreSQL** — durable source of truth для workspace/object records,
  relations, permissions and application metadata. Перезапуск контейнеров не
  должен удалять этот volume.
- **Redis** — внутренняя очередь/cache инфраструктура Twenty.
- **Worker** — фоновые logic functions и recovery/cron обработка; он должен
  видеть server по внутреннему compose адресу `http://server:3000`.

## Object, field, relation

В Twenty `object` — тип записи (например Order или Reservation), `field` —
его атрибут (status, amount, orderedAt), `relation` — связь между двумя
записями (Person → Orders). App manifest описывает эти расширения; Twenty
создаёт metadata и API. Standard Person переиспользуется как Customer, чтобы
не создавать параллельную сущность.

## Front component

`src/front-components/customer-360.front-component.tsx` — React UI, встроенный
в Person tab. Он использует `useRecordId`, `CoreApiClient` для GraphQL-подобных
queries и `RestApiClient` для authenticated `/s/loyalty/adjustments` route.
Loyalty button использует imperative click pattern, а не ненадёжный generic
HTML form submit. После mutation component перечитывает записи и вычисляет
balance из ledger.

## Logic function и security boundary

Logic function — server/worker-side код App, зарегистрированный через
`defineLogicFunction`. Для loyalty граница разделена:

1. browser route требует authenticated user;
2. resolver принимает только подписанное HMAC сообщение от route;
3. app-only processor владеет server fields (`type`, `actor`, `source`,
   `status`, `processedAt`, ledger relation);
4. Staff role не получает generic ledger create/edit/delete.

`MAHABBAT_INTERNAL_ROUTE_SECRET` хранится только в server variable/secret
storage. В browser bundle и репозитории его нет.

## Idempotency и canonical phone

Loyalty request получает UUID-v4 idempotency key. Request и ledger имеют unique
constraints; ledger связывает `sourceRequestId`. При retry processor сначала
ищет уже созданный ledger, чинит статус request и не создаёт второй entry.
Параллельная гонка разрешается unique constraint и повторным чтением.

Телефон — это lookup aid, не external identity. `normalizeKzPhone` принимает
разрешённые варианты `+7`, `8`, `7` и local 10-digit, приводит их к
`7XXXXXXXXXX`, а невалидные/неоднозначные значения отклоняет. Внешняя
сущность идентифицируется отдельно парой `provider + externalId`.

## Self-hosted deployment

Обычный self-hosted runtime использует pinned `twentycrm/twenty:v2.29.0` плюс
Mahabbat App manifest. `deploy/mahabbat-branding.Dockerfile` — необязательный
тонкий overlay для пользовательского названия; он не меняет Twenty core.
Compose environment держит server, worker, PostgreSQL и Redis в одной
внутренней сети. Наружу публикуется только web port `:3000`.

При рестарте server/worker контейнеры поднимаются снова, а данные остаются в
PostgreSQL volume. Требуется резервировать PostgreSQL data и runtime/app
configuration, включая encryption/runtime secrets в отдельном private storage.
Секреты нельзя восстанавливать из Git.

## `:2020` и `:3000`

`:2020` — disposable Apps dev container для plan/apply и быстрых SDK
проверок. Его можно пересоздавать. `:3000` — закреплённый self-hosted Twenty
v2.29.0, на котором подтверждается реальная совместимость и persistence.
Критический pass считается только после проверки `:3000`.

## Windows limitation

Native Windows `twenty-sdk@2.29.0` может сформировать backslash paths в
front-component manifest. Это ограничение локального toolchain, а не
production runtime и не Twenty core gap: тот же manifest планируется и
применяется через Linux/WSL или Node 24 Apps dev container. Self-hosted
server/worker остаются обычными контейнерами.
