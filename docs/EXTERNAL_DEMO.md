# External demo preparation

Status: PASS for a temporary controlled demo.

## Runtime

- Pinned self-hosted Twenty `v2.29.0` remains the only exposed application.
- Temporary HTTPS origin: `https://deluxe-sql-query-alto.trycloudflare.com`.
- Tunnel type: Cloudflare Quick Tunnel (`cloudflared tunnel --url http://127.0.0.1:3000`). It has no persistent account or domain configuration and must be treated as ephemeral.
- Disposable Apps dev container `:2020`, PostgreSQL, Redis, worker-only ports and Docker API are not published by the tunnel.
- The server uses the tunnel origin for browser URL generation; the worker keeps its internal `http://server:3000` URL and `LOGIC_FUNCTION_TYPE=LOCAL`.

## Demo account

- Account: `demo@mahabbat.local` (`Mahabbat Demo`).
- Role: `Mahabbat Demo User`.
- Permissions: read-only Person, Order, OrderItem, Reservation, LoyaltyLedgerEntry and SalesSnapshotLine; no settings, tools, role, user, application or generic object administration.
- Direct ledger create/edit/delete checks are denied. The controlled authenticated adjustment route remains an intentional platform compromise: it is idempotent and server-controlled, but v2.29.0 App roles cannot conditionally hide a front-component action by role.
- Temporary credentials are stored outside the repository in `C:\Users\misa\.mahabbat-demo-credentials.txt`; the value is intentionally not copied into Git or this document.

## Recovery point

- Backup directory: `C:\Users\misa\.mahabbat-demo-recovery\20260809-155031`.
- Contains a verified PostgreSQL custom-format dump, `pg_restore --list` output, compose/runtime metadata, the App source/config snapshot, generated manifest and SHA-256 inventory.
- Secrets are not copied into the backup; runtime secret values must be supplied again from the private runtime environment during recovery.

## Checks completed

- Anonymous external REST access to People: denied (`403`). Anonymous adjustment route: denied (`400` with no secret material). `/client-config` and the SPA shell are reachable without CRM records.
- External Chrome browser: login, Dashboard, People, `Не возвращались 30 дней`, Customer 360, Orders, Loyalty, Reservations, `Ближайшие бронирования` and reload all passed.
- The profile `Выход` action returned the browser to `/welcome`; the same
  demo credentials logged in again on the external origin and returned to the
  Dashboard without a localhost redirect.
- Customer 360 showed real orders/items, reservations, ledger history and computed balance. No browser console errors, localhost API base, broken assets or settings/admin surface were observed in the demo route.
- External read-only API access succeeded for People; direct ledger mutation returned `PERMISSION_DENIED` without secrets.
- PostgreSQL/Redis were confirmed internal-only; only host port `3000` is mapped.

## Disable and recover

1. Stop the `cloudflared` process (the current process is the one running the Quick Tunnel) and remove the temporary URL from any shared message.
2. Disable or delete `demo@mahabbat.local` from Twenty Settings -> Members, or restore the PostgreSQL recovery point above.
3. If the local-only state must be restored, set the self-hosted server `SERVER_URL` back to `http://localhost:3000` using the existing compose environment and restart only the server/worker services.
4. Delete the local credential handoff file after the demo. It is outside Git and is not required by the runtime.
5. The one-time self-host API-key handoff file was deleted after the successful
   apply and clean plan; it is not required by the runtime.

## Residual risks

- Quick Tunnel URLs are ephemeral and have no Cloudflare Access policy; the CRM login remains the access boundary. Do not use real guest data or production credentials.
- Twenty v2.29.0 still exposes generic standard sections after Mahabbat navigation and keeps a user self-settings link; these are not admin/config permissions for the demo role.
- The native People entry remains visible as `People` in one navigation slot;
  the Mahabbat segment and Customer 360 labels are Russian. Renaming that
  native entry without a core change is a separate platform limitation.
- The instance retains upstream synthetic Twenty sample People rows alongside Mahabbat demo data. No real guest records or the private Excel workbook are exposed.
- This is a short-lived demo, not a production deployment. Stop the tunnel after the demonstration.
- The one-time self-host API-key handoff file was not included in the browser
  bundle, tunnel, backup or Git history and was deleted after apply.
