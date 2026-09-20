# Changelog

All notable changes to this application are documented in this file.

## Unreleased (main)

- Security/correctness remediation from the 2026-09-20 audit. Highlights:
  - Prepayments are owner-bound, cumulative `prepaidTotal` cannot exceed the order total, and cancelled/closed orders reject prepayment application; `attachReservationToOrder` honours its idempotency key.
  - POS PIN login resolves a single candidate through the `pinLookup` index (no full-staff scrypt scan), the throttle counter is compare-and-swap atomic, the global bucket is cleared on success, and a durable per-staff lockout is wired. Seed writes `pinLookup`.
  - Closed orders consume their active precheck (no resurrection); precheck ownership is checked before replay branches; totals writes are fenced to editable orders.
  - Inventory: revision claims are released on planning errors; receipt/production/recipe replays complete missing movements; repeated ingredients aggregate instead of collapsing; a line without a recipe keeps the request retryable and attempts are bounded to terminal `FAILED`; transfers are a single atomic batch; `startCount` uses a DRAFT→ACTIVE compare-and-swap. New unique indexes on movement idempotency key and `(countId, stockItemId)`.
  - Printing from the CRM requires an explicit `MAHABBAT_PRINTING_ADMIN_USER_IDS` allowlist; printer `host` is restricted to LAN ranges; the print lease exceeds worst-case dispatch and a late success may override `OUTCOME_UNKNOWN`.
  - Gateway: body-size cap (413), card-identifier login, NaN-expiry rejection. ESC/POS text strips C0 control bytes. `.gitignore` covers non-dot env files. Docker build context minimised.
  - CI runs the standalone POS and printing suites; `.node-version` pins Node 24.16.0.
  - Verified: 320 unit tests, 8 gateway tests, 14 printing tests, oxlint 0, TypeScript no-emit clean.
- Consolidated POS printing, client-review polish and `remove-unsent-line` command into `main`; inventory command boundary included. Verified: 288 unit tests, oxlint 0, TypeScript no-emit clean.
- Added Windows system-printer discovery and configuration-driven routing: the host print gateway uses `Get-Printer`/Windows Print Spooler, the authenticated backend exposes safe discovery data, and the `Печать` UI binds `PrinterDevice` records to exact system queues and `ProductionStation` routes. Existing simulator and Ethernet RAW TCP transports remain available. Physical paper output is not implied by software `SENT`.
- Removed stale worktrees/branches (`codex/inventory-live-pilot`, `fix/inventory-client-handoff-ux`, `polish/client-review-v1`, `feature/physical-printing-v1`, `integration/pilot-review*`; superseded baseline tagged `archive/pilot-review-final`).
- Standalone POS gateway: `pos:deploy:build` uses inner-repo Docker context; `.env.example` documents `TWENTY_APP_ACCESS_TOKEN` and `FRONT_AUTO_BASE_URL`.
- Aligned `.nvmrc` to 24.16.0 (matches upstream Twenty checkout).

## 0.1.0

- Initial application scaffolded with [`create-twenty-app`](https://www.npmjs.com/package/create-twenty-app)
