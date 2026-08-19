# Roadmap

- [x] Prove Apps SDK schema, relations, roles, navigation and custom UI on a
  disposable pinned Twenty `v2.29.0` server under Linux.
- [x] Seed and verify deterministic Customer -> Order/Item -> Reservation ->
  Loyalty Ledger Customer 360, including rerun idempotency and UI persistence.
- [x] Apply the unchanged App to ordinary pinned self-hosted Twenty `:3000`,
  seed it and repeat the focused UI/API checks.
- [x] Make the Twenty GO decision: separate Mahabbat App on Twenty is confirmed.
- [x] P0 Customer Identity + Import Idempotency (phone normalisation,
  provider/externalId upsert and race-safe retry boundary) verified on
  disposable `:2020` and self-hosted `:3000`.
- [x] Customers UX baseline: standard People search/list opens real Person
  records and Customer 360; search and reload persistence were browser-verified
  on self-hosted `:3000`.
- [x] Customer 360 polish and useful empty/error states: real loading,
  section-level error/retry and empty states verified on self-hosted `:3000`.
- [x] Orders UX and operational order workflows: native Orders list/detail,
  stable demo labels, customer/items/status visibility and status persistence
  verified on self-hosted `:3000`.
- [x] Aggregate sales snapshot foundation: bounded `SalesSnapshotLine` object,
  source-preserving identity contract and synthetic repeat/concurrent smoke on
  disposable `:2020` and self-hosted `:3000`; operational Orders remain
  untouched.
- [x] Aggregate sales workbook adapter: read the private April-June report,
  skip `Итого:` totals, map 382 monthly lines to the bounded snapshot contract
  and verify no-duplicate imports without committing the raw file.
- [x] Useful Dashboard powered by aggregate and operational data: native
  `STANDALONE_PAGE`/`PAGE_LAYOUT` widgets show real historical revenue,
  quantity, top products, monthly trend, operational order totals and status
  counts on both pinned environments.
- [x] Reservations UX: native future-only view with time sorting, customer,
  guest, status, party size, zone and table columns; record edit/reload was
  browser-verified on self-hosted `:3000`.
- [x] First actionable segment: customers not returned for 30 days, using a
  dynamic relative `lastActivityAt` view filter and verified on self-hosted
  `:3000`.
- [x] External demo smoke across Dashboard, People segment, Reservations,
  Orders and Customer 360 on self-hosted `:3000`.
- [x] Minimal navigation/branding cleanup: Mahabbat-first App navigation,
  Russian user labels, clean Orders/Loyalty table views, Customer 360 copy and
  a Dashboard-first entry point verified on self-hosted `:3000`.
- [x] P0 loyalty write boundary implementation and disposable/self-hosted API
  invariants: unique request relation, retry/crash repair, immutable projection,
  server-controlled audit fields, validation and negative security checks.
- [x] Final browser-only submit/apply/reload proof for a newly created
  adjustment on disposable `:2020` and self-hosted `:3000`.
- [x] Route-boundary hardening: authenticated create route, Staff read-only
  request/ledger permissions, shared processor helper, cursor recovery fallback
  and five-minute pending-request cron backstop.
- [x] P0 PASS checkpoint: create/apply/reload through the real Customer 360
  button passed on both pinned environments; same-key retry and concurrency
  remain covered by the processor/API checks.

Browser verification tabs are closed after each check; no user-facing tab is
kept open by the QA loop.

Current checkpoint: the controlled route/resolver, processor invariants and
self-hosted deployment are verified automatically on both pinned environments;
the real UI create/apply/reload path, P0 Customer Identity + Import Idempotency,
the standard People -> Customer 360 flow, Customer 360 loading/error/empty
states, the native Orders workflow, the bounded aggregate snapshot API, the
private workbook adapter, the native Dashboard and the Demo-ready product shell
are verified as well. External demo preparation is now PASS; stop after the
temporary handoff and wait for the user's decision on the next phase.

- [x] External demo preparation: assign a read-only `Mahabbat Demo User` role,
  create a separate synthetic demo account, create a verified PostgreSQL/App
  recovery point outside Git, configure the self-hosted server for the
  temporary HTTPS origin and complete the external-browser route smoke. See
  `docs/EXTERNAL_DEMO.md`.

- [x] PRE-POS HARDENING (H1–H10) plus the final corrective checkpoint
  (C1–C7): full-ledger loyalty balance, executable processor regressions, Staff
  destroy revocation, concurrency-safe `lastActivityAt`, pinned/reproducible
  CI, environment-owned CD, frozen distribution, fail-closed test setup and
  branding overlay, aligned source-of-truth docs and documented POS boundary.
  Status: **FINAL PASS** — see `docs/PRE-POS-CHECKLIST.md`.

## POS FOUNDATION CHECKPOINT

- [x] `MAHABBAT POS DOMAIN DISCOVERY` — POS/CRM boundary, state machines,
  permissions, command contracts and non-goals are documented in `docs/POS_*`.
- [ ] POS Foundation Slice 1 — server-side Shift → Zone/Table → Order → Guests
  → OrderLines, context-bound idempotency, server totals, owner checks,
  persistence and close-shift-with-open-order behavior. Implementation and
  unit gates pass; live `:2020`/`:3000` command acceptance remains pending a
  user-managed workspace API key. Twenty core changes: 0.

## NEXT

- `KITCHEN PRINT + STOP LIST` — immutable kitchen ticket abstraction and
  server-side stop-list commands. Do not start automatically until this
  checkpoint is accepted.
