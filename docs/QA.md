# QA

- Linux Node 24 Docker CLI with pinned `twenty-sdk@2.29.0`: schema plan/apply
  succeeded against the official pinned Twenty `v2.29.0` Apps dev container.
  The final Customer 360 update was `0 add, 1 change, 0 destroy`.
- Automated: `yarn typecheck`, `yarn lint`, `yarn test:unit`, `node --check
  scripts/seed-demo.mjs` and `yarn seed:demo:dry` pass. `yarn test` is excluded:
  its scaffold setup installs/uninstalls an App and is unsafe outside a disposable
  target.
- Seed on `:2020`: 24 customers, 72 orders, 144 items, 12 reservations and 48
  ledger entries. Immediate rerun reports 0 creations for every entity type. It
  is explicitly a disposable-demo bootstrap, not the production ledger writer.
- Browser on `:2020`: Mahabbat navigation is visible; People search/list opens
  a seeded customer; Customer 360 displays live related orders/items,
  reservations, ledger history and a computed 1380-point balance; an Order was
  created and named in UI, then remained after a route reload.
- Independent review found no new P0/P1 blocker. It confirmed the controlled
  ledger boundary, deterministic seed relations/cursors and the relation-edge
  Customer 360 query. Its non-blocking follow-up is cursor pagination for a
  customer with more than 100 order items.
- Ordinary self-hosted `:3000`: basic authenticated UI and Apps/API settings
  opened; Linux plan/apply added 146 App entries without a Twenty core edit.
  Seed created 24/72/144/12/48 records and the immediate rerun created none.
  Browser verified People search, Customer 360 data and reload persistence.
  Generic ledger UI has no create action. The temporary handoff key was never
  displayed; local execution policy prevented automated deletion of its file.

## Windows system-printer discovery and routing — 2026-09-13

- The Windows self-hosted runtime passed `mahabbat-status.ps1` and
  `mahabbat-doctor.ps1`: Docker services, Windows Spooler, host print gateway,
  Cloudflare connector and local/public health checks were available. The host
  provider discovered one installed virtual queue; configured PrinterDevices
  and broken bindings were reported by the operational scripts.
- Browser acceptance on `Печать` used the real admin UI: refresh loaded the
  server-provided queue list, a human-readable `PrinterDevice` was created and
  persisted, Test Print used the normal `/s/pos/command` → PrintJob path, and
  a device was assigned to multiple ProductionStations. Route replacement and
  reload persistence were verified. The browser did not enumerate printers or
  receive a service credential.
- Server-side checks covered exact queue binding, unavailable queue handling,
  missing route diagnostics, immutable PrintJob destination snapshots and
  rejection of arbitrary client destination overrides. The simulator and
  Ethernet RAW TCP transport remain available.
- Deterministic UI smoke at `1024×768` and `1366×768` reported
  `document.documentElement.scrollWidth === viewport width` and
  `document.body.scrollWidth === viewport width`; no document-level horizontal
  overflow or blocking layout defect was observed. Evidence is stored outside
  the inner application repository in the deployment repository's
  `evidence/printing/` directory.
- Targeted software gates passed: 288 unit tests, 13 printing tests, 7
  standalone gateway tests, runtime parity, revision atomicity and inventory
  reconciliation with zero mismatches. The discovered virtual queue is not
  evidence of physical ESC/POS compatibility; paper, Cyrillic, 80 mm and
  cutter behavior remain NOT TESTED.
## P0 loyalty write-boundary checks

- Disposable `:2020`: valid request produced one ledger entry; same-key retry,
  two concurrent creates and two concurrent recovery updates never duplicated
  the entry. Crash recovery restored `PENDING` to `APPLIED`; tampering with an
  applied request was repaired from the ledger snapshot.
- Validation: zero, `+/-100001`, malformed amount and missing customer were
  rejected; `+/-100000` boundaries were accepted; negative balance was tested
  and remains allowed for manual corrections.
- Negative security: anonymous ledger create/edit/delete returned `403`; an
  unauthenticated processor route returned `404`; the Mahabbat Staff manifest
  is read-only for ledger writes.
- Ordinary self-hosted `:3000`: the same processor was installed by the Linux
  SDK workflow. A new request automatically became `APPLIED`; retry returned
  `400`; parallel create returned `201/400` and produced one entry; parallel
  recovery and tamper repair preserved one entry and one balance change. Live
  Customer 360 showed the resulting history and balance after reload.
- Front-component diagnostic: temporary visible markers proved the real click
  reached `onClick`, the handler and validation, then stopped before the saving
  state at `crypto.randomUUID()`. The form submit pattern was also unsuitable
  for the sandbox because `preventDefault()` does not cross the host boundary.
  The fix is the official imperative pattern: `button type="button"` with a
  direct `onClick`, plus a sandbox-safe UUID-v4 idempotency-key helper. Debug
  markers were removed after diagnosis; no secrets or payloads were logged.

- Disposable `:2020` UI acceptance: entered `+17`, clicked `Сохранить`, observed
  `Сохраняем…`, received success feedback, saw exactly one new ledger row and
  balance `1421 -> 1438`; reload preserved the row and balance.
- Self-hosted `:3000` UI acceptance: entered `+17`, clicked `Сохранить`, observed
  `Сохраняем…`, received success feedback, saw exactly one new ledger row and
  balance `1396 -> 1413`; reload preserved the row and balance.
- Retry safety remains verified with the same idempotency key by the API and
  processor checks on both targets; the UI disables the button while the first
  request is in flight, so a second click cannot create a parallel request.

- Route boundary on `:3000`: authenticated POST `/s/loyalty/adjustments` created
  a PENDING request and the worker applied it once; the same payload retried
  returned the existing request. Two parallel POSTs returned `201/200` and
  produced one ledger entry. Client-supplied type/status/actor/source metadata
  was ignored. Zero amount and anonymous route calls were rejected.
- Cron backstop on `:3000`: executing the installed
  `reconcile-pending-loyalty-adjustments` function returned SUCCESS with no
  failed records and reconciled pending requests. The same helper is used by
  database events and the cron sweep.
- Staff boundary: manifest sync created field permissions with
  `canUpdateFieldValue=false` for every request and ledger field, and removed
  Mahabbat Staff generic update permission for adjustment requests. The admin
  API key used for deployment intentionally bypasses Staff restrictions and is
  not evidence of a Staff negative test.

## P0 route hardening evidence

- The same manifest was applied to disposable `:2020` and pinned self-hosted
  `:3000` with Linux Node 24 and `twenty-sdk@2.29.0`; no Twenty core file was
  changed.
- On both targets, authenticated `POST /s/loyalty/adjustments` returned a
  pending request, the worker applied it, and a retry returned the same request
  without a second ledger entry. Two concurrent calls with the same idempotency
  key likewise converged to one request and one ledger entry.
- The route now delegates its write to the app-only server resolver
  `create-loyalty-adjustment-request-resolver`. A missing/invalid HMAC signature
  was rejected with `403`; the resolver endpoint is not a public write API.
  Anonymous calls to the authenticated `/s` route were denied by the server
  authentication boundary. The internal secret is configured as a required
  server variable on both proof environments; its value is not stored in the
  repository.
- The route payload only contains customer, amount, reason and idempotency key.
  Server-owned type, actor, source, status, processedAt and ledger relation
  fields are set by the processor/resolver and client-injected values are
  ignored. The unique `sourceRequestId` relation remains the ledger exactly-once
  boundary, including retry/crash reconciliation and foreign-key race rejection.
- Browser Customer 360 create/apply/reload proof is complete on both pinned
  targets with the real visible button. The initial failure was product-side
  sandbox incompatibility, not a CUA limitation; no Twenty core change was
  required. An external Chrome tab was not needed.

## P0 customer identity checks

- Unit coverage: Kazakhstan phone variants (`+7`, `8`, `7`, local 10-digit,
  separators; international `+8` is rejected), malformed/non-Kazakhstan values, canonical provider/externalId,
  source-owned updates, protected-field conflicts and retry/concurrent races.
- Disposable `:2020`: schema plan/apply created Person's unique
  server-controlled `externalIdentityKey` plus Reservation identity fields and
  its composite index. The smoke import repeated a Person as a noop, kept the
  same phone under a different external identity, updated a source-owned field,
  and converged concurrent Person/Order/Reservation creates to one row each.
- Deterministic seed after identity schema: first run reconciled only missing
  demo identity keys; the immediate rerun reconciled/created zero records.
- Self-hosted `:3000`: the same App plan/apply succeeded; deterministic seed
  reconciled old demo keys without creating rows, the immediate rerun created
  zero records, and the same identity smoke converged all concurrent imports.
- Identity metadata fields (`provider` and `externalId` on Person, Order and
  Reservation) are non-editable in the generic UI; the importer owns them and
  Person's unique `externalIdentityKey` is server-controlled. Mahabbat Staff
  field permissions also set `canUpdateFieldValue=false` for these identity
  fields on both proof environments.

## Aggregate sales workbook fixture (read-only profile)

- Private source: the user-provided April-June 2026 workbook remains outside
  Git. It has three monthly sheets (`A1:M128`, `A1:M140`, `A1:M129`) and one
  aggregate table per sheet; report headers occupy rows 1-4 and product lines
  begin at row 5.
- Observed edge cases: fractional quantities (including `401.5`, `24.25`,
  `83.666`, `11.5`), positive quantity with zero revenue (`-Кола`, `-Фанта`,
  `-Спрайт`), duplicate/near-duplicate names and blank category cells. `Итого:`
  total rows are report totals, not product lines.
- Contract decision: import aggregate snapshots/lines only, preserve raw names,
  keep decimal quantity and zero-revenue rows, use stable snapshot/line identity
  for retry-safe upsert, and never fuzzy-merge uncertain MenuItem matches. The
  durable contract is in `docs/AGGREGATE_SALES_IMPORT.md`; implementation is
  intentionally deferred to the post-Orders/pre-Dashboard slice.

## Customers UX checkpoint

- On self-hosted `:3000`, the standard People list showed the identity fields,
  search opened `Identity Smoke`, Customer 360 displayed its linked order,
  reservation and computed loyalty balance, and a route reload preserved the
  same data. The native `People` entry remains the supported customer list;
  no duplicate App navigation item is installed.

## Customer 360 polish checkpoint

- On self-hosted `:3000`, Linux plan/apply updated only the `customer-360`
  front-component checksum; no Twenty core file or backend/security boundary
  changed.
- Browser verification showed real loading completion, linked Order and
  Reservation sections, the empty `Лояльность (0)` state, and a derived balance
  of `0` from the real ledger. A missing-record route showed a visible error
  and `Повторить` action. Reload preserved the Customer 360 data and produced
  no browser console errors.
- The same front component update and metadata cleanup were applied to the
  disposable `:2020` target. The separate aggregate-sales workbook remains a
  documented future snapshot import and was not used to fabricate Orders.

## Orders UX checkpoint

- Orders remain native Twenty CRUD; no custom composer or core change was
  needed. The deterministic seed now sets the built-in Order `name` to the
  stable `externalId` (`MAHABBAT-DEMO-ORD-###`). Reconciliation fills only
  missing names and never overwrites a non-empty user value.
- The seed was run twice on both `:2020` and `:3000`: zero duplicate Orders,
  OrderItems, or other foundation records were created; the first pass
  reconciled 72 existing demo Order names and the second pass was a noop.
- Browser verification on self-hosted `:3000` showed the labeled Orders list,
  real customer/items/channel/status/totals, native status editing, and status
  persistence after reload. The test status was restored to its original
  deterministic value. Browser console errors: none.

## Aggregate sales snapshot checkpoint

- The private April-June workbook was profiled read-only; it remains outside
  Git and was not used to fabricate operational Orders or OrderItems.
- Linux `twenty-sdk@2.29.0` plan/apply created the bounded, API-only
  `SalesSnapshotLine` object on disposable `:2020` and self-hosted `:3000`.
  The plan contained no Twenty core changes and no operational-object changes.
- The synthetic fixture covered three lines: a fractional quantity, a positive
  quantity with zero revenue, and near-duplicate raw names. Raw names remained
  distinct; no fuzzy MenuItem merge occurred.
- Repeat import and concurrent retry smoke passed on both targets. Each ended
  with exactly three unique `salesSnapshotLines`; the operational Orders count
  remained 74 on both targets. KZT money stayed in Currency micro-units and
  source identity remained stable.
- Automatic checks after the slice: lint (0 errors), typecheck, and 110 unit
  tests passed. The private workbook adapter is verified below; the Dashboard
  checkpoint is recorded after it, and the next product slice is Reservations
  UX followed by the return-frequency segment.

## Private workbook adapter checkpoint

- The original workbook was mounted read-only and parsed in place with the
  bundled Python/openpyxl runtime; no copy was added to the repository.
- The adapter read three monthly sheets, skipped every `Итого:` report-total
  row, and produced 382 aggregate lines. It retained nine positive-quantity
  zero-revenue lines and five fractional-quantity lines.
- On disposable `:2020` and self-hosted `:3000`, the first real load reported
  `created=382, updated=0, conflicts=0`. The immediate rerun reported
  `created=0, updated=0, conflicts=0` on both targets.
- API verification after the real load found 385 aggregate lines including the
  three synthetic proof rows, while operational Orders remained 74 on each
  target. No Order or OrderItem was created from the workbook.

## Dashboard checkpoint

- Linux `twenty-sdk@2.29.0` plan/apply created the native Dashboard page layout
  and navigation item on disposable `:2020` and self-hosted `:3000`; replans
  were clean and no Twenty core files changed.
- The page uses native `STANDALONE_PAGE`/`PAGE_LAYOUT` graph widgets. Aggregate
  historical revenue and quantity, top products and monthly trend read only
  `SalesSnapshotLine`; operational order total and status counts read only
  `Order`. The two sources are not blended into fabricated transactions.
- Browser verification on self-hosted `:3000` opened `Дашборд Mahabbat` and
  observed real values: historical revenue `27.2m`, quantity `39 873,166`,
  operational order total `589.7k`, and status total `74`. The corrected
  `Выручка по операционным заказам` title was visible and browser console logs
  were empty.

## Reservations UX checkpoint

- The native Reservations object keeps its existing workspace navigation. A
  bounded custom view `Ближайшие бронирования` is available in the view picker;
  it filters `reservationTime` to the future, sorts ascending and exposes the
  operational columns needed by a host: guest, customer, status, party size,
  zone and table.
- The same view was applied on disposable `:2020` and self-hosted `:3000`.
  Sequential replans were clean on both targets and no Twenty core file
  changed. A direct custom-view navigation item was rejected by v2.29.0's
  server validation, so the supported object navigation plus view picker is the
  smallest working UX and is not an architectural blocker.
- Browser verification on self-hosted `:3000` selected the view, showed 7 future
  reservations and excluded past dates, opened a real record side panel,
  changed `Подтверждена` to `Запланирована`, reloaded, and restored the original
  status. The view then remained at 7 future records.

## Return-frequency segment checkpoint

- The native People view `Не возвращались 30 дней` uses a `NOT` view-filter
  group around the relative `PAST_30_DAY` range on `lastActivityAt`. It is a
  dynamic date rule, not a hard-coded date or a second segmentation backend.
- The view was applied on disposable `:2020` and self-hosted `:3000`; sequential
  plans are clean and no Twenty core file changed. It exposes last activity,
  customer status and normalized phone for the next follow-up workflow.
- Browser verification on self-hosted `:3000` selected the view and showed 20
  records. Recent `Concurrent Import` identity data was absent, confirming the
  relative filter is materially narrowing the real People dataset.

## External demo smoke checkpoint

- The self-hosted `:3000` smoke pass loaded the native Dashboard, the 30-day
  People segment, future Reservations, Orders and the real Person Customer 360
  route. Dashboard markers included the corrected operational revenue title;
  the segment showed its last-activity column; Reservations and Orders opened
  their real lists; Customer 360 loaded its real reservation section.
- The first 900 ms of the Dashboard/People loads is intentionally a skeleton;
  the smoke waits for the normal data load before judging the route. No data was
  changed, and all browser tabs were closed after the check.

## Demo-ready product shell checkpoint

- App-level navigation puts `Главная`, `Заказы`, `Бронирования` and
  `Лояльность` before the generic Twenty entries; the root URL opened the real
  Mahabbat Dashboard on self-hosted `:3000`.
- Orders and Loyalty use bounded App-defined table views with Russian,
  business-facing columns only. Native object navigation remains the
  supported entry because a direct App VIEW navigation item was rejected by the
  v2.29.0 server validator; the view picker exposes both views.
- Browser acceptance on `:3000` completed: Dashboard -> People -> `Не
  возвращались 30 дней` -> Customer 360 -> Orders -> Loyalty -> Reservations ->
  `Ближайшие бронирования`. Customer 360 showed real Orders/Items,
  Reservations, Loyalty and computed balance; the future view showed 7 rows and
  remained selected after reload.
- Customer-facing copy contains no `ledger`, provider/external-identity or
  other ingestion terminology in the checked demo route. Standard Twenty
  sections remain visible after Mahabbat navigation by platform limitation.
- Shell changes were App metadata/views/front-component copy only; Twenty core
  modifications remain `0`.

## External demo preparation checkpoint

- Self-hosted Twenty `v2.29.0` is reachable for the temporary demo only through
  the HTTPS Quick Tunnel documented in `docs/EXTERNAL_DEMO.md`; `:2020`, the
  database, Redis and worker ports remain private.
- The synthetic demo account is assigned `Mahabbat Demo User` and has the
  required read-only object permissions. Direct ledger create/edit/delete
  requests were denied; no secrets appeared in responses.
- The external Chrome path passed: login -> Dashboard -> People -> `Не
  возвращались 30 дней` -> Customer 360 -> Orders -> Loyalty -> Reservations ->
  `Ближайшие бронирования` -> reload. Dashboard metrics and real Customer 360
  relations rendered without console errors or localhost redirects.
- Recovery point verification passed: PostgreSQL custom dump and manifest/config
  snapshot are outside Git, with a `pg_restore --list` inventory and SHA-256
  file inventory.
- The one-time self-host API-key handoff file was deleted after the successful
  apply; no runtime or browser bundle depends on it.
- External profile logout returned to `/welcome`; a fresh login with the demo
  account returned to Dashboard on the tunnel origin. The browser console log
  remained empty after the relogin.
- This checkpoint is demo-only. Stop the tunnel and remove the demo account or
  restore the recovery point after the demonstration.

## Post-preliminary-pos hardening checkpoint

### Corrective gate totals (C1, same base `832be7d` at `origin/main`)

- `yarn lint`: 0 errors; `yarn typecheck`: pass; `yarn test:unit`: 176/176.
- After the corrective C1 change the deterministic seed reconcile ran on
  `:2020`: rerun reports 0 creations for every entity type (see below).

### C1 last-activity atomic invariant (live evidence)

- The previous read-MERGE-write maintenance was replaced by guarded,
  single-statement `updatePeople` calls. Every write is one grouped conditional
  UPDATE: the first write filters `lastActivityAt: { is: 'NULL' }`; each bump
  filters `lastActivityAt: { lt: <candidate> }`. An older concurrent event
  therefore cannot overwrite a newer stored value; monotonicity holds without a
  Twenty core change.
- Live readiness experiment on disposable `:2020`: 12 concurrent writers with
  ordered candidates converged to the maximal candidate (27612 points), the
  single surviving `lastActivityAt` was the maximum candidate, and no
  intermediate value survived. Evidence captured in a temporary script
  (`race-check.mjs`, outside the repository).
- The logic function fires on Order creation and on the late
  customer-assignment update (`updatedFields: ['createdAt', 'customerId']`);
  unrelated Order edits do not trigger it (see `docs/DECISIONS.md`).

### C6 RBAC evidence-bounded conclusion

- Final persisted Mahabbat Staff object-permission rows (verified on BOTH
  disposable `:2020` and self-hosted `:3000`; identical, manifest-aligned):

| object | read | update | soft_delete | destroy |
| --- | --- | --- | --- | --- |
| person | t | t | f | f |
| order | t | t | f | f |
| orderItem | t | t | f | f |
| reservation | t | t | f | f |
| loyaltyLedgerEntry | t | f | f | f |
| loyaltyAdjustmentRequest | t | f | f | f |

- These rows implement the product boundary (operational records: staff may
  read and update but may not soft-delete or destroy; adjustments and the
  ledger are read-only). Destructive capabilities
  (`canSoftDeleteObjectRecords`, `canDestroyObjectRecords`) are `false` for
  every critical operational object; the configured Admin and API-key
  principals are the only destructive contexts and are project-owned.
- **Verified limitation (accepted, not fabricated PASS):**
  Staff destructive permissions are verified by application manifest,
  persisted role/object-permission rows and executable tests. Person
  hard-destroy is additionally blocked structurally by FK `RESTRICT` when
  related Orders exist. A live authenticated Staff-session denial could not be
  exercised because Twenty v2.29.0 exposes no supported headless path in these
  environments to obtain a non-admin user session; API-key authentication
  behaves as workspace admin and is therefore not valid RBAC evidence.
- The live probe on `:2020` confirmed the API-key principal executes with
  workspace-admin capabilities even when its `roleTarget` is rebound to the
  App-function role, so runtime RBAC enforcement is not exercisable through
  the API key path. The FK `RESTRICT` finding is an additional structural
  safeguard, not a substitute for role enforcement.
- The seeded `staff@local.test` user for the disposable `:2020` cannot be
  exercised end-to-end because the login/password-reset mutations are not
  mounted in the product GraphQL surface of these environments (probed
  `signIn`, `login`, `signInWithCredentials`, `verifyEmailAndGetLoginToken`,
  `generateApiKeyToken` on both targets; `/admin-panel/graphql` and
  `/metadata/graphql` return 404). See `docs/TWENTY_GAPS.md`.

### Disposable `:2020` probe side-effect log and reconciliation

- Runtime RBAC probe (`runtime-denial.mjs`, outside the repository) executed as
  the workspace-admin API key: `deletePerson` soft-deleted Person
  `0b0271e8-43ad-4530-8584-c8d39c5488df` (restored immediately via
  `restorePerson`, idempotent) and `destroyOrder` hard-destroyed two seeded
  demo orders `065f61cc-0170-4139-b734-a402f3c278eb` and
  `0c29c1e8-84c1-4d0f-9d1b-f0bb2cd0d4f7` together with their OrderItems
  (verified cascade: 0 orphan OrderItems remained).
- The API key's `roleTarget` was temporarily rebound to the App-function role
  and restored to the original admin role (`89e7cf1c-…` -> restore finished);
  the soft-deleted Person was restored; no other workspace record changed.
- Baseline reconciliation after the probe: `yarn seed:demo` against `:2020`
  recreated exactly the 2 destroyed demo Orders and 4 OrderItems (Order count
  returned to the documented 74, OrderItems to 144, 0 orphan items), and the
  immediate rerun reported 0 creations for every entity type (1232 People,
  74 Orders, 144 OrderItems, 13 Reservations, 57 ledger entries all skipped).
  The accidental probe mutations therefore did not leave `:2020` in a silently
  altered baseline.

### C5 large-ledger Customer 360 correctness

- Disposable `:2020` only: a synthetic Customer (`HARDENING C5`,
  externalIdentityKey `HARDENING::MAHABBAT-C5-SYNTHETIC`) was created and 120
  ledger entries were loaded through the real `/rest/batch/loyaltyLedgerEntries`
  path (100 `EARN` of `+10`, 20 `REDEEM` of `-5`; distinct
  customer+occurredAt+reason values and idempotency-compatible keys, respecting
  the persisted exactly-once boundary: unique `sourceRequestId` relation +
  unique `idempotencyKey`. The legacy composite (customer, occurredAt, reason)
  unique index was removed in P1 — same-millisecond same-reason adjustments
  are legitimate and must not collide.)
- The app-equivalent of the Customer 360 balance read (cursor-paginated
  `loyaltyLedgerEntries` filtered by `customerId`, the same pagination the
  front component uses for relations) returned **n=120, sum=900** on two full
  passes; the balance is the complete ledger sum and reload-stable. PostgreSQL
  cross-check: 120 rows, `sum(amount)=900`, matching the API exactly.
- The fixture is disposable and confined to `:2020`; `:3000` was not seeded.
- Platform note surfaced during the check: `GET /rest/<object>` cursor
  pagination (`starting_after`) does not advance in this build once the
  collection exceeds one page, so the REST read path is not safe for >100-row
  reads; the GraphQL cursor pagination used by the product is sound. Recorded
  in `docs/TWENTY_GAPS.md`.

### C7 workflow static verification

- `ci.yml`: triggers only `push: main` and `pull_request` — no tag trigger;
  `permissions: contents: read`; `TWENTY_VERSION: v2.29.0`; `actions/checkout@v4`,
  `actions/setup-node@v4` and the Twenty action pinned to
  `80fb91c033dfd367f17ba58e2095526faa016e70`; runs lint, typecheck, unit tests
  and the disposable-instance integration suite (`yarn test` is safe there
  because it spawns its own App target, unlike a dev workstation).
- `cd.yml`: `workflow_dispatch` only; runs on the `production` GitHub
  Environment; the guard step fails unless the environment owns
  `TWENTY_DEPLOY_URL`; deploy/install use `vars.TWENTY_DEPLOY_URL` +
  `secrets.TWENTY_DEPLOY_API_KEY` (no operator-entered URL); Twenty actions
  pinned to `80fb91c033dfd367f17ba58e2095526faa016e70`. No production target is
  configured, so the job remains unusable by construction.
- `publish.yml`: `workflow_dispatch` only with a required `release_version`
  input; no automatic tag/push trigger; `DISTRIBUTION_ENABLED: 'false'`
  fail-closed gate committed in the workflow; a version tag cannot enable
  publication; `npm@11.5.1` pinned; version gate compares `package.json` to the
  requested release. Distribution remains `NOT DISTRIBUTED`
  (`docs/DISTRIBUTION_DECISION.md`).

### Final convergence and smoke

- Linux Node 24 + `twenty-sdk@2.29.0` against disposable `:2020`: sequential
  `plan` -> `No changes`, `apply` -> "No changes. Twenty metadata matches your
  manifest." + "Synced Mahabbat CRM (14 files)", replan -> `No changes`.
  Metadata is fully converged with the repository manifest.
- Contract checks after the corrective pass: `yarn lint` 0/0, `yarn typecheck`
  pass, `yarn test:unit` 176/176 (including the 7 `roles-permission-boundary`
  contract tests), `yarn seed:demo:dry` valid + no records sent. The live
  integration suite (`yarn test`) is covered in CI against the spawned
  disposable App instance and is intentionally not run on a workstation (it
  installs/uninstalls an App; documented above).
- Bounded smoke, safe: `:2020/healthz` 200, `:3000/healthz` 200, both roots
  serve 200. On `:2020` a third full cursor-paginated Customer 360 read of the
  C5 persona returned rows=120, sum=900 (reload-stable, matching the two
  earlier passes and the PostgreSQL `sum(amount)=900`). `:3000` was not written
  and its seeded `staff@local.test`/demo fixtures were left untouched.

### Dashboard operational overview refresh

- The native Mahabbat Dashboard was refreshed through the App page-layout
  manifest, without modifying Twenty core or business logic. The first screen
  now presents a Russian welcome panel, four live operational KPIs, latest
  orders, upcoming reservations and order-status distribution; historical
  sales charts remain available lower on the page.
- The self-hosted `:3000` browser smoke confirmed the rendered panel and tables
  with the current review workspace data: 72 orders, 252 sold items and
  `589.6k` order revenue. The dashboard document had no horizontal overflow:
  `documentScrollWidth = documentClientWidth = 1280` and
  `bodyScrollWidth = bodyClientWidth = 1280` in the verification viewport.
- Verification: metadata plan `4 to add, 6 to change, 0 to destroy` followed
  by successful apply; runtime SDK parity PASS; inner `typecheck` PASS;
  inner `lint` PASS; `mahabbat-status.ps1` PASS; `mahabbat-doctor.ps1` PASS.

### Printing settings usability refresh

- The CRM `Печать` page now uses a guided three-step flow: select the Windows
  device, save its Mahabbat-facing name/profile, then assign it to stations.
  It no longer displays the extra POS administrator PIN gate inside CRM.
- The ordinary view now has a short setup guide, status summary cards and
  clear availability/capability labels. Per-dish routing and diagnostics/job
  history are collapsed until needed; technical review printer fixtures are
  hidden from the normal restaurant setup surface.
- The backend keeps the existing server-authoritative boundary. Only the
  bounded printing-configuration command allowlist can use the authenticated
  CRM route, which derives an active ADMIN actor server-side. POS and inventory
  PIN boundaries are unchanged.
- Browser smoke on local `:3000` confirmed the page opens without a PIN field,
  loads discovered devices and routes, and Test Print returned
  `Тестовая печать отправлена на принтер`. The page is responsive without
  introducing a document-level overflow in the checked viewport.
- Verification: Node 24 unit suite `288/288 PASS`; printing and standalone
  targeted suite `20/20 PASS`; typecheck PASS; lint PASS; status/doctor PASS;
  post-change PostgreSQL backup validated with `pg_restore --list`.
