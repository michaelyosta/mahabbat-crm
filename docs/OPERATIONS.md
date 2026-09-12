# Operations map

Это карта текущего demo/self-hosted окружения, не production SOP.

## Startup

For the normal Windows self-hosted runtime, run these commands from the outer
`mahabbat-deployment` repository:

```powershell
.\scripts\mahabbat-start.ps1
.\scripts\mahabbat-status.ps1
.\scripts\mahabbat-doctor.ps1
```

`mahabbat-start.ps1` starts Docker services, the host-side Windows print
gateway and the existing tunnel, then waits for local health checks before
printing `READY`. It preserves named PostgreSQL/Redis volumes. The host print
gateway is not a Docker container: it runs beside the Windows Print Spooler so
that `Get-Printer` and spooler writes remain available.

For direct application work without the outer deployment wrapper:

1. Start Docker Desktop.
2. Start the pinned Twenty compose stack (server, worker, PostgreSQL, Redis)
   using a private `.env` containing runtime encryption and database values.
3. Verify `http://localhost:3000/healthz` returns HTTP 200.
4. Start the host print gateway with the same private internal route secret
   when Windows printer discovery or spooler output is in scope.
5. Start/attach the disposable Apps dev container only when working on
   `twenty dev`/plan/apply against `:2020`.
6. Apply the App from Linux/WSL with private API credentials when a manifest
   change is intended. Do not point development scripts at production data.

The exact compose path and branding overlay are examples under `deploy/`;
Twenty's upstream compose file is not copied into this repository.

The repository's deployment workflow is manual (`workflow_dispatch`) and is
driven by the `production` GitHub Environment: the deploy target
(`TWENTY_DEPLOY_URL` environment variable) and the deploy credential
(`TWENTY_DEPLOY_API_KEY` secret) belong to that environment, and the run fails
closed until `TWENTY_DEPLOY_URL` is set. No operator-entered URL is accepted.
It does not auto-deploy on push and should never be pointed at production
without a separate approval/checkpoint.

## Shutdown and restart

- For the outer deployment, run `.\scripts\mahabbat-stop.ps1`. It stops the
  host print gateway, temporary tunnel and Docker application services while
  preserving persistent volumes.
- For a manual stack, stop the temporary tunnel first, then stop the host print
  gateway and server/worker. Keep PostgreSQL and its volume when you need state
  to survive.
- For a normal restart, recreate server/worker with the same image tag and
  private `.env`; do not generate a new encryption key for an existing data
  volume.
- Restarting worker is appropriate for stuck background logic. A database
  restart may make the server unhealthy until PostgreSQL is ready.

## Health checks

- `GET http://localhost:3000/healthz` — server liveness/readiness signal.
- `GET http://127.0.0.1:3110/health` — host print gateway health.
- `Get-Service Spooler` and `Get-Printer` — Windows spooler/discovery checks.
- `mahabbat-status.ps1` — Docker services, gateway, discovered queue count,
  configured `PrinterDevice` count and broken bindings.
- `mahabbat-doctor.ps1` — fail-closed diagnostic for missing queues, gateway,
  Spooler and route bindings.
- `docker ps` — server should be healthy; PostgreSQL should be healthy; worker
  should be running.
- Browser smoke — login, Dashboard, People/Customer 360, Orders,
  Reservations and Loyalty reload.
- After a deployment, run targeted `yarn lint`, `yarn typecheck`,
  `yarn test:unit` and `yarn seed:demo:dry` before any broad build.

## Backup and restore

Before a material demo/deployment change, create one verified PostgreSQL custom
dump and a private manifest/config snapshot. Verify the dump with
`pg_restore --list`; store both outside Git with restricted access.

Restore outline:

1. Stop server/worker.
2. Preserve the failed volume as a separate recovery point.
3. Restore the dump into the intended PostgreSQL database using the same
   compatible Twenty version.
4. Restore required App/runtime configuration from private secret storage.
5. Start PostgreSQL, server and worker; run `/healthz` and a read-only browser
   smoke.
6. Reapply the exact Mahabbat App version only after the recovered workspace is
   reachable and the target is confirmed.

Never commit dumps, credentials, API keys, HMAC secrets, encryption keys or
private client workbooks.

## Persistence boundary

Persistent: PostgreSQL data volume; Twenty local storage volume when enabled;
pinned image/version and Mahabbat App source/config; private runtime secret
inventory and backup manifest.

Ephemeral: `:2020` disposable Apps dev container; worker process state, Redis
cache and temporary Cloudflare Quick Tunnel; local build output, `.twenty`,
`dist`, logs and test artifacts.

## Network and exposure

Only self-hosted web `:3000` may be exposed for a controlled demo. Never
publish `:2020`, PostgreSQL, Redis, worker ports, Docker API, the host print
gateway or internal compose addresses. A Quick Tunnel is temporary access, not
an access-control system or production deployment. The print gateway must keep
its HMAC route secret and should be restricted by the Windows firewall to the
host/trusted Docker path.

## Upgrade strategy

Keep `twenty-sdk`, `twenty-client-sdk`, CI test image and self-hosted image on
the same pinned compatible version (`v2.29.0`) until a deliberate upgrade
spike passes. Before an upgrade: backup, inspect Twenty release/migration notes,
run unit/contract tests, plan/apply on `:2020`, then repeat the same App on
`:3000`. Do not silently change to `latest`.

## Local network use

For a LAN-only demo, bind/firewall only the host web port and use the host's
private LAN address. Keep service ports bound to localhost/internal Docker
network. For external access, use a temporary HTTPS tunnel only after a
secrets review and recovery point.

## Failure scenarios

- **Server unhealthy:** check PostgreSQL readiness, encryption/runtime
  variables and server logs without copying secrets into reports.
- **Worker running but logic not applying:** check `LOGIC_FUNCTION_TYPE=LOCAL`,
  worker `SERVER_URL=http://server:3000`, Redis and the pending-request
  reconciliation path.
- **A newly applied App object is missing inside a local logic function:** the
  generated SDK archive can be current while a non-persistent LOCAL executor
  layer remains stale. After verifying the App plan is clean, recreate only
  the affected stateless server/logic executor, then run
  `yarn verify-runtime-api-parity`. Do not delete PostgreSQL data, Redis
  persistent data, workspace metadata or broad application storage.
- **Browser redirects to localhost:** check external-origin/base-URL settings;
  do not expose internal URLs.
- **Duplicate import risk:** stop the import, inspect provider/externalId or
  snapshot identity and unique-index errors, then rerun only after the identity
  contract is confirmed.
- **Loyalty retry uncertainty:** do not manually create a ledger row; inspect
  the request and unique source relation, then let the processor/reconcile
  path recover it.
- **Lost encryption key:** stop and recover from the matching private runtime
  secret/recovery point; do not replace it casually for an existing database.
- **Windows printer list is empty:** check that `Spooler` is running, `Get-Printer`
  returns queues and the host gateway is healthy. Restart the gateway through
  `mahabbat-start.ps1`; do not enumerate printers from browser JavaScript.
- **Configured printer is missing:** refresh `Печать` and compare the exact
  Windows queue name. Rebind explicitly to a replacement; there is no silent
  fallback to another queue.
- **Station has no route:** configure the station under `Печать →
  Маршрутизация`. The server records a diagnosable print failure instead of
  selecting the first available device.
- **Test print fails:** use the user-facing result and inspect the private
  gateway/server logs. `SENT` confirms transport completion only; a virtual
  queue does not prove ESC/POS paper, Cyrillic or cutter behavior.

## SDK v2.29.0 objectPermission reconciliation gap (runbook)

Twenty `twenty-sdk@2.29.0` installs and updates role/object metadata but does
**not** reconciliate persisted `objectPermission` rows for existing roles on a
live workspace: a fresh install creates them from the manifest, while `plan`
and `apply` on an already-installed workspace leave pre-existing permission rows
alone (`apply` reports "No changes"). A role manifest change is therefore not
enough to converge an existing workspace.

This was hit once on self-hosted `:3000`: stale pre-manifest rows allowed
Mahabbat Staff to `canDestroyObjectRecords` for person/order/orderItem/
reservation. A one-off corrective run was applied (documented in
`docs/QA.md`), the rows were rewritten to the manifest values, and a follow-up
`twenty apply` confirmed "No changes" for metadata. After such a manual
corrective edge, re-verify against the manifest and keep the corrective SQL
outside the application codebase:

1. Confirm the current role id and the six critical
   object rows (`canReadObjectRecords`, `canUpdateObjectRecords`,
   `canSoftDeleteObjectRecords`, `canDestroyObjectRecords`).
2. Delete the stale rows for the affected role, re-run `yarn twenty apply`
   (function/object flags re-sync), then re-insert the rows with the exact
   manifest flags.
3. Compare with `src/roles/mahabbat-staff.role.ts` and the table in
   `docs/QA.md`; a subsequent `plan` must show no metadata drift.

This is a v2.29.0 platform limitation (see `docs/TWENTY_GAPS.md`), not a
Mahabbat core change; re-evaluate on a future Twenty upgrade.

## Inventory pilot deployment invariant

After any Mahabbat App metadata/object change, use this exact bounded sequence:

1. Apply metadata and generate the SDK: `yarn twenty apply -r
   selfhost-container`.
2. Recreate only the stateless server/logic-function executor if the generated
   runtime layer is not refreshed. The supported recovery target is the
   executor process/container, not the database. A read-only function warm-up
   may be used before the guard when the executor's generated directory is
   empty after recreation.
3. Run `yarn verify-runtime-api-parity`. It must report
   `inventoryStockLocations=present` before acceptance starts.
4. Check `GET /healthz`; if the domain changed, run one minimal Inventory write
   on synthetic data.
5. Run `scripts/accept-inventory.mjs`, then
   `scripts/reconcile-inventory.mjs` and require zero mismatches.

The acceptance harness is intentionally high-volume and can meet Twenty's
application API throttler in a workspace containing many old synthetic
fixtures. `MAHABBAT_INVENTORY_COMMAND_DELAY_MS=500` is an optional harness
pacing control for a slower run. Do not raise the normal server throttle or
use a temporary compose override as a deployment fix; wait for the bounded
throttle window and rerun the harness if the platform limit is reached.

Stateful boundary: PostgreSQL volumes, Twenty local storage, Redis persistent
data when configured, customer/CRM/POS records and production metadata. Never
delete or recreate these as a runtime refresh. Stateless boundary: server,
worker and logic-function executor processes, generated SDK layers under `/tmp`,
and disposable CLI/build output. These may be restarted or recreated after the
guarded diagnosis.

For a person-facing demo, use the additive namespace seed documented in
`docs/INVENTORY_HUMAN_REVIEW.md`. It does not provide a generic reset and does
not delete acceptance or customer data. Keep the admin PIN and API key private.
