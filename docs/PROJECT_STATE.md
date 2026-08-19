# Сейчас работает

- Pinned Twenty `v2.29.0` runs self-hosted at `:3000` and in the disposable
  official Apps dev container at `:2020`; the App source is separate and now
  applied to both environments.
- The Mahabbat App is applied to `:2020` through Linux Node 24 with
  `twenty-sdk@2.29.0`: Person extensions, Order, OrderItem, Reservation,
  LoyaltyLedgerEntry, relations, indexes, roles, navigation and a Person tab.
- `Mahabbat Demo User` is an assignable read-only demo role: Person, Order,
  OrderItem, Reservation, LoyaltyLedgerEntry and SalesSnapshotLine are readable;
  writes, settings, tools and API-key assignment are disabled.
- A deterministic seed is live: 24 Mahabbat customers, 72 seeded orders,
  144 order items, 12 reservations and 48 ledger entries. A UI-created order
  is also retained as browser-persistence evidence.
- Customer 360 is real UI. It loads Person, orders and their items, reservations
  and ledger from Twenty, and computes the balance from ledger amounts.
- Ordinary self-hosted `:3000` has the same 24/72/144/12/48 seeded foundation
  data. Its seed rerun created zero duplicates and Customer 360 survived reload.
- Customer identity contract is implemented and unit-tested: Kazakhstan phone
  normalization, canonical `PROVIDER::externalId`, conflict policy, race-safe
  upsert, and a unique server-controlled Person `externalIdentityKey`.
- Disposable `:2020` identity smoke passed: same-phone/different-identity,
  changed source-owned data, retry, and concurrent Person/Order/Reservation
  imports converge without duplicates. The identical App passed the same
  smoke on self-hosted `:3000`.
- The bounded aggregate model `SalesSnapshotLine` is applied on both targets.
  It is API-only, read-only in generic UI, preserves raw item names and
  fractional/zero-revenue metrics, and uses a unique server-controlled line
  identity. Synthetic repeat and concurrent imports converge to three lines.
- The private April-June workbook adapter loaded 382 lines from three monthly
  sheets on both targets. It skipped report totals, preserved nine zero-revenue
  and five fractional-quantity lines, and its immediate rerun was
  `created=0, updated=0, conflicts=0`.
- The native Mahabbat Dashboard is applied on both targets. It reads aggregate
  history and operational Orders as separate sources and shows real revenue,
  quantity, top products, monthly history, order totals and status counts.
- Reservations UX is a native future-only workspace view with ascending time
  sort and the customer, guest, status, party size, zone and table columns. It
  is available from the Reservations object view picker on both targets.
- The first bounded business segment is a native People view `Не возвращались
  30 дней`: a dynamic relative filter excludes `lastActivityAt` from the past
  30 days, with status and normalized-phone columns for follow-up.
- The Demo-ready product shell is applied on both pinned environments: the
  Mahabbat entries `Главная`, `Заказы`, `Бронирования` and `Лояльность` are
  first in App navigation, the root opens the Dashboard, and user-facing
  Customer 360/Order/Reservation/Loyalty labels are Russian and non-technical.
- Orders and Loyalty have clean App-defined table views with technical/system
  columns excluded. Because v2.29.0 rejects direct App VIEW navigation in this
  setup, the supported native object entry plus view picker is retained for
  these views and for `Не возвращались 30 дней`/`Ближайшие бронирования`.

## POS Foundation Slice 1

- POS is a separate operational layer on `pos*` custom objects; the CRM
  `Order`/`OrderItem` model and Customer 360 remain unchanged.
- Implemented objects: `PosShift`, `PosZone`, `PosTable`, `PosOrder`,
  `PosOrderGuest`, `PosOrderLine`, `PosMenuItem`, `PosStopListEntry`,
  `PosStaff` and `PosSession`.
- The signed `/pos/command` route dispatches `openShift`, `closeShift`,
  `openOrder`, `addGuest`, `addLine` and `changeLineQuantity`. Server-owned
  Currency micro-unit totals, ownership checks, active-table claims and
  context-bound idempotency are enforced in `src/pos/pos-command.dispatch.ts`.
  `authenticatePosStaff` creates the short-lived session; later commands derive
  actor staff/role from `getAuthenticatedPosContext()`.
- Duplicate active shifts/orders are prevented by unique indexes; identical
  menu items remain independent POS lines; closing a shift leaves its order
  open and owned.
- POS Slice 1 docs and acceptance harness are in `docs/POS_DOMAIN.md`,
  `docs/POS_STATE_MACHINES.md`, `docs/POS_PERMISSIONS.md`,
  `docs/POS_COMMANDS.md`, `docs/POS_QA.md` and `scripts/accept-pos.mjs`.
- Live Slice 1 acceptance is PASS on both pinned targets: `:2020` and `:3000`
  each completed 47/47 checks. The harness uses `MAHABBAT_POS_PIN_A` as ADMIN
  and `MAHABBAT_POS_PIN_B` as WAITER, and only the idempotent `POS Acceptance`
  fixtures (`POS-A1`/`POS-A2`/`POS-A3`) are reconciled between runs.
- Twenty core modifications remain `0`. A real member identity is not exposed
  in Twenty v2.29.0 App `RoutePayload`; POS therefore uses the separate
  Mahabbat `PosStaff`/`PosSession` context. The outer Twenty route/API key is
  still not claimed as production RBAC.

## POS Slice 2 — Kitchen Print + Stop List (PASS)

- Added `PosKitchenTicket`/`PosKitchenTicketLine` and the server-owned
  `PosOrderLine.kitchenSentQuantity` cursor. `MockKitchenPrintAdapter` is the
  bounded printer boundary; no physical printer is configured.
- Added authenticated `addStopListEntry`, `clearStopListEntry` and
  `printKitchenTicket`. Stop-list validation runs on every `addLine`; stale
  clients are rejected. Semantic/request idempotency plus unique ticket-line
  handling make retry and concurrent PRINT re-read the winner instead of
  duplicating tickets or lines.
- Live acceptance passed on `:2020` and `:3000` with 55/55 checks each. It
  covers stop-list lifecycle, first/retry/no-op/delta PRINT, parallel PRINT,
  sent-quantity guard, persistence, Slice 1 races and CRM smoke. Unit total:
  225 passed.

## POS Slice 3 — Precheck + Order Lock (PASS)

- `PosPrecheck` stores immutable server-owned order/guest money snapshots and
  lifecycle `ACTIVE → CANCELLED`; `activeOrderKey`, create key and cancel key
  provide deterministic retry/concurrency boundaries.
- `createPrecheck` moves the order to `PRECHECK_PRINTED` and the existing command
  lock rejects guest/line/quantity/new kitchen mutations. `cancelPrecheck` is
  ADMIN-only, records cancellation and restores `IN_PROGRESS`.
- Live acceptance passed on `:2020` and `:3000` with 62/62 checks each,
  including lock, waiter denial, ADMIN cancel, retries and CRM smoke. Unit total:
  226 passed.

## POS Slice 4 — Payments + Partial Payments + Close Order (PASS)

- Added configurable `PosPaymentMethod` (`CASH`, `CARD`, `OTHER`) and
  immutable controlled `PosPayment` records. The server owns accepted actor,
  amount, method snapshots, payment status and the paid aggregate.
- `recordPayment` requires `PRECHECK_PRINTED`, rejects invalid/overpaying
  amounts, serializes one pending payment per order, repairs a crash after the
  aggregate update and is context-bound by a unique idempotency key.
  `closeOrder` requires remaining `0`, uses a guarded bulk update, clears the
  active table claim and is retry-safe.
- Live acceptance passed on both `:2020` and `:3000` with 68/68 checks each:
  parallel payment retry, partial cash/card payments, overpayment rejection,
  zero-remaining close, close retry, reload/shared state, previous POS races
  and CRM smoke. Unit total: 227 passed.

## POS Slice 5 — Reservations + Prepayment (PASS)

- `PosReservation` is a POS-specific table-linked reservation layer, separate
  from the CRM reservation object. It keeps optional scheduled time, guest
  name/phone, status and authenticated creator; overdue is derived and never
  auto-deletes the record. A reservation may attach to an order on the same
  table, including an already reserved table.
- `PosPrepayment` is an immutable controlled financial record. It starts
  `UNAPPLIED` and moves to `APPLIED` through a CAS update keyed by an
  idempotency key. `PosOrder.prepaidTotal` is reconciled from applied records;
  payment remaining is `total - prepaidTotal - paidTotal`.
- Live acceptance passed on both pinned targets with 73/73 checks each:
  reservation persistence/overdue, retry, exactly-once parallel apply,
  same-table attach, payment/close integration, prior POS races and CRM smoke.
  Unit total remains 227; lint/typecheck pass; Twenty core modifications: 0.

## POS Slice 6 — ADMIN Void + Transfers (PASS)

- `PosOperationalEvent` is an append-only audit object. Its unique operation
  key makes void and transfer retries return the same semantic event.
- `voidOrderLines` is ADMIN-only, keeps the line in history, records actor/time,
  prepared state and reason, and creates one immutable `CANCELLATION` kitchen
  ticket for already sent quantities. All-active-lines-voided derives
  `CANCELLED` order status.
- ADMIN-only transfer commands move an editable order to a free table, change
  owner to an active PosStaff, or move active lines to a guest in the same
  order. Each writes an audit event; generic CRUD remains outside the path.
- Live acceptance passed on both pinned targets with 78/78 checks each,
  including waiter denial, sent-line cancellation, retry/no duplicate ticket,
  all three transfers, previous POS/CRM checks and concurrency. Twenty core
  modifications: 0.

# PRE-POS hardening (FINAL PASS)

- Loyalty balance: Customer 360 computes the balance from the **full ledger**
  via cursor pagination (`first:100` + `after`, up to 10 000 pages) instead of
  a truncated `first:100` client-side sum. `computeLoyaltyBalance` and the
  paginated fetch are unit-tested (14 tests).
- Loyalty processor regression suite is executable (11 tests): happy path,
  retry, crash recovery, tamper repair, concurrent convergence, foreign
  idempotency rejection, invalid input, missing customer/request, terminal
  REJECTED state and cursor fallback beyond page 1.
- Roles: Mahabbat Staff `canDestroyObjectRecords=false` and
  `canSoftDeleteObjectRecords=false` for Person, Order, OrderItem and
  Reservation (7 boundary tests). Demo User stays read-only; ledger/request
  surfaces stay non-writable.
- `Person.lastActivityAt`: server-owned, **atomic guarded monotonic** update —
  two single-statement conditional mutations (`is: 'NULL'` for the first write,
  `lt: candidate` for bumps) so a concurrent older event cannot overwrite a
  newer value (proven live on `:2020`, see `docs/QA.md`; 8 tests including
  12-way concurrency convergence to max). Exact guarantee is recorded in
  `docs/DECISIONS.md`.
- CI is pinned and reproducible (`TWENTY_VERSION: v2.29.0`, Twenty composite
  action at commit `80fb91c0`). CD binds the production URL and credential to
  one GitHub Environment (`production`) and accepts no operator-entered URL.
  Distribution is frozen: `publish.yml` has no tag trigger and a fail-closed
  gate; `docs/DISTRIBUTION_DECISION.md = NOT DISTRIBUTED`.
- Destructive integration-test setup is fail-closed (target allowlist guard,
  11 tests). Branding overlay is fail-closed (7 tests) and fails the build when
  a target literal is missing.
- POS Foundation Slices 1–6 are implemented after the documented boundary
  decision. Kitchen, precheck and cancellation output use mock adapters only;
  physical printer routing remains outside the pilot.
- Gate totals after the corrective checkpoint: `yarn lint` 0/0, `yarn typecheck`
  clean, `yarn test:unit` 226/226, `yarn seed:pos:dry` PASS. Slice 3 live
  acceptance is recorded below.

# POS Slice 4 live checkpoint — 2026-08-19

- Disposable `:2020`: `scripts/accept-pos.mjs` PASS 68/68 after Linux
  plan/apply/replan. It proved Slice 1–3 behavior plus payment concurrency,
  partial payments, overpayment rejection, close and retry.
- Self-hosted `:3000`: the same manifest and deterministic harness PASS 68/68;
  plan after apply returned `No changes`.
- No physical printer, fiscal or bank-terminal integration is implied;
  Twenty core modifications remain 0.

# Сейчас не работает

- The private workbook remains outside Git; no aggregate line is converted into
  an operational Order or OrderItem. Generic Twenty standard sections remain
  available after the Mahabbat entries because v2.29.0 App metadata has no
  supported hide flag.

# Последняя проверка

- 2026-08-20 POS Slice 6 live acceptance: `:2020` PASS (78/78) and `:3000`
  PASS (78/78). This includes Slice 1–5 plus ADMIN void/cancellation ticket,
  table/waiter/guest transfers, audit and retry/concurrency checks.
  Final local gates: `yarn lint`, `yarn typecheck`, `yarn test:unit` (227/227)
  PASS.
- On 2026-08-09 Linux `twenty-sdk@2.29.0` plan/apply updated Customer 360 on
  pinned Twenty `v2.29.0` without a core change; the same update was applied
  to disposable `:2020` and ordinary self-hosted `:3000`.
- `yarn typecheck`, `yarn lint`, `yarn test:unit` and `yarn seed:demo:dry` pass.
- Seed rerun created zero duplicate Person, Order, OrderItem, Reservation or
  LoyaltyLedgerEntry records.
- Disposable browser (`:2020`) created a `+17` correction from Customer 360,
  showed the processing state, one new ledger row and balance `1438`; reload
  preserved both the row and balance.
- Linux plan/apply on ordinary `:3000` updated the same App front component
  without touching Twenty core. Browser created the acceptance `+17` correction,
  showed the processing state, one new ledger row and balance `1396 -> 1413`;
  reload preserved the result and the success feedback.
- Identity unit suite: 104 unit tests pass, including malformed identities,
  phone formats, protected-field conflicts and concurrent importer races.
- Disposable identity smoke: repeat import is a noop; same phone with another
  external identity remains separate; concurrent Person/Order/Reservation
  creates converged to one row each.
- Self-hosted `:3000` identity smoke passed with the same result; the same App
  manifest and no Twenty core change were used on both targets.
- The standard People list is the current customer entry point: browser search
  found `Identity Smoke`, opened its real Customer 360 tab, showed linked order,
  reservation and derived loyalty balance data, and preserved them after reload.
- Customer 360 now exposes explicit loading, section-level error/retry and
  empty states for Orders, Reservations and Loyalty. The browser check on
  `:3000` showed real Order/Reservation data, the empty `Лояльность (0)` state,
  no browser console errors, and the same state after reload.
- Orders UX is currently native Twenty CRUD: the Orders list shows real
  customer, item, channel, status and money data; demo orders now use their
  stable external ID as the built-in visible name. Seed reconciliation fills
  only missing names and preserves non-empty user names.
- Identity fields are non-editable in the generic UI and Mahabbat Staff field
  permissions deny their updates; deployment API keys intentionally bypass
  those Staff restrictions for seeding and proof.
- Orders verification on `:3000`: seeded labels were visible, a seeded order
  opened with its customer/items/status context, native status changed to
  `Готовится`, survived reload, and was restored to its deterministic fixture
  status. Browser console errors: none.
- Aggregate schema plan/apply on both targets created only the bounded
  `SalesSnapshotLine` object and its generated metadata; no Twenty core files
  changed. The synthetic smoke repeated and concurrently retried three lines;
  each target ended with exactly three unique aggregate lines and 74 existing
  Orders.
- The private workbook adapter loaded 382 lines on each target from a read-only
  mount. Both immediate reruns returned `created=0, updated=0, conflicts=0`;
  API counts were 385 aggregate lines including the three synthetic proof rows,
  and Orders remained 74.
- Native Dashboard browser verification on self-hosted `:3000` showed the real
  aggregate revenue (`27.2m`), aggregate quantity (`39 873,166`), operational
  order total (`589.7k`) and 74-order status total. The corrected operational
  title was visible, browser console logs were empty, and the page used native
  Twenty page-layout widgets rather than mock cards.
- Reservations browser verification on self-hosted `:3000` selected
  `Ближайшие бронирования`, showed 7 future records and no past-date record,
  opened a real reservation side panel, changed its status, reloaded, and
  restored the original status. The view picker and native edit path remained
  free of browser errors.
- People browser verification on self-hosted `:3000` selected `Не возвращались
  30 дней`, showed 20 customers, displayed the `Последняя активность` column,
  and excluded recent `Concurrent Import` identity records.
- External demo smoke on self-hosted `:3000` loaded Dashboard, the People
  segment, Reservations, Orders and the real Person Customer 360 route. The
  Dashboard and segment needed the normal initial load wait; after loading their
  real titles/markers were present, and browser tabs were closed afterward.

# Финальный Demo-ready checkpoint

- Browser route on self-hosted `:3000`: root opened Dashboard; People ->
  `Не возвращались 30 дней` showed 20 real customers; Customer 360 showed
  real Orders/Items, Reservations, Loyalty and computed balance; Orders and
  Loyalty opened the clean custom views; Reservations -> `Ближайшие
  бронирования` showed 7 future records and stayed selected after reload.
- Final Linux gate: `yarn lint` (0 warnings/errors), `yarn typecheck`,
  `yarn test:unit` and `yarn seed:demo:dry` passed; sequential Twenty plans on
  `:2020` and `:3000` were clean after applying the shell.
- Independent DeepSeek review found and the final pass removed remaining
  visible `loyalty`/`ledger` wording from the adjustment-request metadata and
  added the Russian `REJECTED` order status label; the updated Customer 360
  bundle reloaded successfully on `:3000`.

# Известные проблемы

- POS Slice 1 is implemented and covered by the server-side command boundary.
  Kitchen printing, payments, fiscalisation and the remaining restaurant
  operations are not implemented; their bounded sequence is documented in
  `docs/POS_DOMAIN.md` and requires separate checkpoints.
- POS auth context is implemented with `PosStaff`/`PosSession`; the outer
  Twenty route still requires a workspace API key and is not a POS employee
  identity. The pilot brute-force limiter is process-local and must be replaced
  by a distributed boundary before Internet production use.
- Native Windows Apps SDK paths are a development-environment limitation.
  Standard development is Linux/WSL; it is not a Twenty architectural blocker.
- Twenty v2.29.0 cannot plan a composite App index on standard Person; the
  identity slice uses the verified unique server-controlled key field
  `externalIdentityKey` instead. This is recorded as a bounded platform
  limitation, not a core modification.
- `seed:demo` bootstraps only disposable demo data with an administrator API key;
  it deliberately bypasses the future controlled ledger writer and is not a
  production loyalty-write path.
- Customer 360 intentionally requests at most 100 order items for the selected
  customer. The foundation dataset fits; production needs cursor pagination.
- The scaffold `yarn test` syncs and uninstalls an App, so only `test:unit` is
  safe as a read-only local check. Integration tests require a disposable target.
- The user-managed one-time API-key handoff file could not be deleted by the
  local execution policy after successful deployment. It was never displayed;
  remove `C:\Users\misa\.mahabbat-selfhost-api-key` manually.
- The POS auth-context checkpoint is committed. The only local
  untracked item is `prototypes/mahabbat-pos-ultra-premium.html`, a standalone UI
  reference for the future touch flow; it is not runtime and is not a source
  of data or staff identity.
- Generic standard navigation (`Companies`, `People`, `Opportunities`,
  `Tasks`, `Notes`, `Dashboards`, `Workflows`) cannot be hidden from an App
  manifest. The supported compromise is Mahabbat-first negative positions and
  native object navigation with discoverable view pickers.
- The workspace switcher still displays the existing workspace name `Mahabbat`;
  v2.29.0 App metadata does not safely rename workspace chrome, so no core or
  workspace-level mutation was made.

## External demo preparation checkpoint

- `DEMO-READY PRODUCT SHELL` and `EXTERNAL DEMO PREPARATION` are PASS for a
  short-lived controlled demo. Only self-hosted `:3000` is exposed through the
  ephemeral Cloudflare Quick Tunnel documented in `docs/EXTERNAL_DEMO.md`.
- A separate `demo@mahabbat.local` account uses the read-only `Mahabbat Demo
  User` role. It can read the Customer 360 route, Dashboard, Orders,
  Reservations, Loyalty and SalesSnapshotLine data, but it has no settings or
  generic ledger CRUD permission.
- External Chrome acceptance passed login, Dashboard, People segment, Customer
  360, Orders, Loyalty, Reservations, the upcoming-reservations view and reload.
- A verified recovery point is outside Git at
  `C:\Users\misa\.mahabbat-demo-recovery\20260809-155031`; no secrets or the
  private workbook are in that backup.
- Residuals: the Quick Tunnel has no edge access policy beyond Twenty login;
  generic Twenty sections and synthetic upstream sample People rows remain
  visible. This is not a production deployment.

# Текущий vertical slice

Dev verified: Person/Customer -> Orders -> OrderItems; Person/Customer ->
Reservations; Person/Customer -> LoyaltyLedgerEntry; the separate aggregate
`SalesSnapshotLine` API; the native Dashboard over both data sources; and the
native future Reservations view, and the bounded 30-day return-frequency
segment, including Customer 360, controlled adjustment write, UI persistence
and reload on disposable and ordinary self-hosted `:3000`. The Demo-ready
product shell (Dashboard-first navigation, Russian labels, clean Orders/Loyalty
views and discoverable business views) is complete; the generic scaffold page
has been removed.

The current POS slice is the server-side operational foundation through
Kitchen Print, Stop List, Precheck lock, payments, reservations/prepayments and
ADMIN void/transfers:
PosStaff PIN/card -> PosSession -> active Shift -> free Table -> POS Order ->
multiple Guests -> independent OrderLines -> server totals -> persistence.
There is no physical touch POS UI yet; kitchen, precheck and cancellation
adapters are mock-only.

# Следующий лучший шаг

CRM foundation, aggregate import, Dashboard, Reservations, Demo-ready shell and
PRE-POS hardening are complete. POS Slices 1–6 are PASS on both runtime
targets. The next slice is `REAL TOUCH POS UI`, connected to the existing
server command boundary and prototype-informed only.

## P0 loyalty write boundary status

- P0 loyalty write boundary status: the controlled flow is `LoyaltyAdjustmentRequest -> database-event processor -> LoyaltyLedgerEntry`.
- `LoyaltyLedgerEntry.sourceRequest` is a physical many-to-one relation with a unique index. `sourceRequestId` is the exactly-once boundary; request `idempotencyKey` is also unique.
- Processor is retry-safe and repairs a request from the existing ledger after a crash or attempted tamper. It owns entry type, actor/source, status, processedAt and ledger relation; the UI sends only customer, amount, reason and idempotency key.
- Disposable `:2020` and ordinary self-hosted `:3000` passed API invariants: valid request applies once, retry returns duplicate, parallel create is `201/400` with one entry, parallel recovery leaves one entry, tamper is repaired, invalid amounts/customers are rejected, and anonymous ledger create/edit/delete are denied.
- Self-hosted worker requires `LOGIC_FUNCTION_TYPE=LOCAL` and `SERVER_URL=http://server:3000` for worker-side SDK calls. This is deployment configuration, not a Twenty core gap.
- Live `:3000` Customer 360 uses a direct `button type="button" onClick` action.
  The initial diagnostic showed click -> handler -> validation, then a failure at
  unsupported `crypto.randomUUID()` before saving/request creation. Temporary
  hooks were removed; idempotency keys now use a sandbox-safe UUID-v4 helper.
- P0 loyalty write-boundary browser proof is complete on both targets. Same-key
  retry/concurrency/idempotency remains covered by the API and processor checks;
  the UI guard disables the action while the request is in flight.

## P0 loyalty boundary review follow-up

- The employee write path is now the authenticated App route
  `/s/loyalty/adjustments`; it accepts only customer, amount, reason and
  idempotency key, then creates a PENDING request with the App function role.
- Mahabbat Staff has no generic update/create permission for the request and has
  field-level read-only permissions for request and ledger fields. Ledger writes
  remain App-function-only.
- The database-event processor and five-minute cron backstop share one
  idempotent processing helper. Cursor fallback recovery no longer assumes the
  first 100 requests, and foreign idempotency-key races are rejected.
- Disposable and ordinary `:3000` route/API checks passed: parallel calls
  returned one request and one ledger entry; retry returned the same request;
  server-controlled fields were ignored; malformed input and unauthenticated
  route calls were denied; cron execution completed successfully.
- P0 is marked PASS: the real button click reaches the handler, the request is
  applied once, the Customer 360 balance updates, success is visible and the
  result survives reload on both pinned environments.

## P0 loyalty write-boundary deployment shape

- The authenticated `/s/loyalty/adjustments` route is deliberately limited to
  authentication, input validation and request intent. It does not write the
  request with the employee's intersected Staff role.
- The route delegates to the app-only server resolver
  `create-loyalty-adjustment-request-resolver` through Twenty's server webhook
  endpoint. The resolver requires the signed request body and performs the
  controlled request write with the App function role. This preserves a
  read-only Mahabbat Staff surface while keeping the UI route authenticated.
- `MAHABBAT_INTERNAL_ROUTE_SECRET` is a required server variable. It is filled
  on both disposable `:2020` and ordinary self-hosted `:3000` for this proof;
  production use must provide and rotate it through deployment secret
  management.
- Negative checks included invalid/missing resolver signatures, anonymous route
  access, direct ledger mutation attempts, client audit-field injection, and
  same-key parallel/retry processing. Each valid request produced one request
  and one ledger entry, with one balance change.
- Automatic code checks after the hardening pass: typecheck passed, lint passed
  with zero warnings/errors, and 45 unit tests passed. Temporary diagnostic
  hooks were removed after the root cause was isolated.
- The same App build was applied on disposable `:2020` and self-hosted `:3000`;
  both real UI paths now create and persist the correction. No Twenty core files
  were changed.
