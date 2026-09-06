# MAHABBAT POS — STANDALONE RUNTIME

## Live data acceptance checkpoint — 2026-08-21

The standalone runtime was exercised against the local self-hosted stack, not
mock data: Twenty CRM remained on `http://127.0.0.1:3000`, the standalone
gateway served `http://127.0.0.1:3100/`, and the browser entered directly on the
PIN screen with no Twenty cookie or CRM shell.

Evidence recorded for this checkpoint:

- gateway PIN authentication returned server-derived WAITER and ADMIN
  `PosSession` identities; real zones, tables and menu rows loaded;
- the waiter browser flow persisted guests, lines, kitchen tickets, precheck,
  partial card payment, cash tender/change and closed order state;
- authoritative cash result was tendered 5,000 KZT, applied 1,900 KZT, change
  3,100 KZT, remaining 0;
- a second synthetic WAITER identity was used only as a disposable local
  fixture to prove foreign-order mutation denial and shared table visibility;
  the fixture's staff, shift and session rows were removed after the check;
- stop-list rejection/recovery, overdue reservation persistence, no-session and
  malformed-session denial, actor spoof denial, and gateway idempotency were
  exercised through `/api/pos/*`;
- the direct authoritative acceptance script completed `78/78`, including
  reservation/prepayment, admin void/transfer, payment/cash, concurrent
  terminal races and CRM create/read smoke;
- an order written through the embedded `/s/pos/command` path was read back
  through standalone gateway REST, proving one order state and one domain;
- after stateless gateway restart the active order survived; a new browser
  context requested PIN again, while a same-tab reload restores the
  `sessionStorage` session when it is still valid;
- disconnecting the gateway produced the operational Russian error
  `Не удалось выполнить операцию. Обновите данные и попробуйте снова`; after
  recovery the browser returned to `Данные актуальны` with the live order
  intact;
- populated state passed at 1920×1080 and 1366×768 with no document/body
  scroll and no Twenty sidebar/header.

For this local checkpoint `TWENTY_API_URL`, `TWENTY_API_KEY`, and
`MAHABBAT_INTERNAL_ROUTE_SECRET` were provisioned only in private server-side
runtime environment. Their values are intentionally absent from this document,
the repository, and the browser bundle. The API key used for acceptance is a
disposable development credential; this is not an internet-grade threat model.

## CURRENT — Twenty embedded host

```
Browser (Twenty session)
  │
  │  cookie / JWT workspace auth
  │  (Twenty login required)
  ▼
Twenty Front (React SPA, :3000/:2020)
  │  sidebar + header + CRM chrome + mail banner
  │  page layout "Касса" → front-component
  │  RestApiClient → /rest/*  (workspace-scoped)
  ▼
Twenty Server
  ├─ /rest/pos* (Twenty REST data plane, requires workspace auth)
  └─ /s/pos/command (authenticated httpRoute, isAuthRequired=true)
       │
       │  body: { command, payload, sessionToken? }
       │  headers: workspace auth
       ▼
     pos-command.logic-function (gateway)
       │  validates envelope, signs body with MAHABBAT_INTERNAL_ROUTE_SECRET
       │  POST → /webhooks/server/<resolver-id>
       │  header x-mahabbat-signature
       ▼
     pos-command-resolver.logic-function (app-only, serverRoute)
       │  verify signature, parse payload
       │  if authenticatePosStaff → pos-auth.ts (scrypt PIN → PosSession tokenHash)
       │  else → getAuthenticatedPosContext(tokenHash) → dispatchPosCommand
       │  actor/role is server-derived from PosSession, client-supplied role rejected
       ▼
     Twenty data plane via CoreApiClient (TWENTY_APP_ACCESS_TOKEN, service identity)
       pos* custom objects, idempotent mutations, server-owned totals/locks
```

**What binds POS UI to Twenty canvas (adversarial answers):**

1. **Where is privileged credential?** `TWENTY_APP_ACCESS_TOKEN` (CoreApiClient) and `MAHABBAT_INTERNAL_ROUTE_SECRET` (hmac signer) live only in logic-function env (server/worker). They never reach browser today — browser only holds short-lived `PosSession.sessionToken` (in React memory, not localStorage).

2. **Would it leak to standalone browser?** Only if standalone leaked service env or bundled server code. Design must keep gateway server-side; browser gets only `PosSession` token via PIN.

3. **Who creates PosSession?** `authenticatePosStaff` in `src/pos/pos-auth.ts` — scrypt PIN verification against `PosStaff.pinHash`, then random 32-byte `sessionToken` → SHA256 `tokenHash` stored in `PosSession`.

4. **Can role be spoofed?** No. `parsePosCommandEnvelope` rejects any body `role/staffId/actor` field (INVALID_ACTOR). Resolver derives `staffId/role` from `PosSession` lookup by `tokenHash`; mismatch or inactive staff → 401.

5. **What without Twenty login?** Today every request fails: `/s/pos/command` has `isAuthRequired:true` and `/rest/*` requires workspace auth. Browser with only PosSession token gets 401 at outer route before POS auth runs. Standalone must not require that hop.

6. **What does canvas actually give POS?** Three things: (a) static hosting & routing for the front-component bundle, (b) workspace auth transport to reach `/s/pos/command` + `/rest/*`, (c) ambient CRM chrome (sidebar/header, notifications). (a) and (b) are replaceable; (c) is unwanted in kiosk.

7. **Which assumptions disappear standalone?** No Twenty workspace session, no `RestApiClient` workspace cookie, no automatic `/rest` auth, no front-component definition/page-layout/mounting. Also no Twenty `SERVER_URL` browser resolution.

8. **Refresh / restart?** Today token lives only in React memory → F5 loses session (re-PIN). Desired: pragmatic LAN storage (e.g. sessionStorage with purge on logout) documented as bounded threat model — not internet-grade, but isolates terminal. Server restart without DB wipe keeps `PosSession` rows → session survives until `expiresAt` (15m) or `revokedAt`.

9. **Multi-terminal?** Already safe: `PosOrder.claimToken=tableId` unique race, `idempotencyKey` per command, kitchen `kitchenSentQuantity` cursor, payment `lockKey`. Different `PosSession` tokens → different `staffId` contexts; state converges via 12s polling.

10. **Reuse command handlers?** Yes — `pos-auth.ts` + `pos-command.dispatch.ts` + `pos-command-input.ts` are pure functions over `CoreApiClientLike`. They don't depend on Twenty page layout.

11. **Will business logic duplicate?** Gateway must not copy domain rules. Standalone commands are signed and delegated to the existing app-only resolver, which already calls `pos-auth.ts` and `dispatchPosCommand` with `asClient()` (service identity). REST reads are a narrow gateway proxy that re-validates `PosSession` and uses server-only service auth; it contains no totals, locks, permissions, or state-machine implementation.

12. **CORS/CSRF?** If standalone origin differs from gateway origin, CORS must be explicit. Prefer single origin deployment `pos.mahabbat.local` (or `LAN_IP:3100`) serving both static UI and `/api/*` via same reverse proxy/gateway — avoids CORS entirely. For dev, two origins (`vite :5173` ↔ `gateway :3100`) use `Access-Control-Allow-Origin` + `Vary: Origin` with no credentials.

13. **Can embedded + standalone coexist?** Yes. Both reach same authoritative `pos*` objects and same dispatch. Existing `defineFrontComponent`/`definePageLayout` stay untouched; standalone mounts the same `<PosApp />` via shared module. Verified by concurrent acceptance (one order seen from other host after poll).

---

## TARGET — Standalone host (single origin preferred)

```
LAN terminals (192.168.x.x / pos.mahabbat.local / :3100)
  │
  │  PosSession Bearer token (PIN-derived, short-lived)
  │  no TWENTY_APP_ACCESS_TOKEN, no workspace API key
  ▼
Mahabbat POS Gateway  (Node, :3100, also serves static UI)
  ├─ GET  /              → static PosApp (no CRM chrome)
  ├─ GET  /health        → 200
  ├─ POST /api/pos/auth           (no bearer required)  → authenticatePosStaff → token
  ├─ POST /api/pos/command        (Bearer token)         → getAuthenticatedPosContext → dispatchPosCommand → same handlers
  ├─ GET  /api/pos/rest/:coll     (Bearer token)         → validate PosSession → proxy to Twenty REST via CoreApiClient/service
  └─ uses server env: TWENTY_API_URL, TWENTY_APP_ACCESS_TOKEN (or MAHABBAT_API_KEY),
                      MAHABBAT_INTERNAL_ROUTE_SECRET (if keeping signed delegation),
                      POS_GATEWAY_* secrets — never sent to browser
             │
             │ service identity (server-side only)
             ▼
       Twenty data plane (same as today: pos* objects, PosSession/PosStaff)
```

**Trust boundaries:**

- **Browser → Gateway:** trusts PIN + short-lived Bearer token. Gateway rate-limits PIN, validates token hash/expiry/revocation/inactive staff, rejects any client-supplied role/staffId.
- **Gateway → Twenty:** trusts `TWENTY_APP_ACCESS_TOKEN` / `MAHABBAT_INTERNAL_ROUTE_SECRET` + internal HMAC if delegating through resolver. These never cross to browser. Gateway logs command/status/request-id without raw PIN or raw token.
- **Twenty canvas:** continues to exist as secondary host; its `isAuthRequired:true` route stays but is not used by standalone clients.

**Session flow:**

1. `POST /api/pos/auth { pin, terminalId }` → `authenticatePosStaff` → `{ sessionToken, expiresAt, staff }`. Gateway returns raw token once; browser holds it in memory + optional `sessionStorage` (cleared on logout/expiry, key `mahabbat:pos:session`).
2. Subsequent `Authorization: Bearer <token>` → `getAuthenticatedPosContext` → `dispatchPosCommand`.
3. Refresh → restore from `sessionStorage` if present and not expired → re-fetch `PosSession` validity via cheap `/api/pos/command` ping or `GET /api/pos/rest/posSessions`; on 401 show PIN again.
4. Logout → `POST /api/pos/command { command:'logoutPosStaff' }` → `revokePosSession` (sets `revokedAt`) → clear storage.
5. Sliding idle timeout: login starts a 15-minute inactivity window. Authenticated business commands restart it server-side; real pointer/keyboard activity sends a throttled non-mutating `refreshPosSession` command, at most once per minute. Background REST polling does not extend the window. `MAHABBAT_POS_SESSION_IDLE_MINUTES` can set 1-1440 minutes at deployment; invalid values fall back to 15. Idle expiry → 401 `POS_SESSION_EXPIRED` → re-PIN. Revoked/inactive/malformed → 401. Role spoof → `INVALID_ACTOR` / context mismatch → 400/401.

**API adapter:**

```ts
interface PosApi {
  loginWithPin(pin: string, terminalId?: string): Promise<PosSession>;
  logout(): Promise<void>;
  list(collection: string): Promise<PosRow[]>;
  command(command: string, payload: Record<string, unknown>): Promise<unknown>;
}
```

- **Embedded adapter** (`TwentyPosApi`): `RestApiClient` + `{ sessionToken }` in body, as today.
- **Standalone adapter** (`StandalonePosApi`): `fetch('/api/pos/...', { headers:{ Authorization:`Bearer ${token}`}})`, token from caller, not env.

UI (`PosApp`) imports only `PosApi`; it never knows host.

**Shared UI extraction:**

```
src/pos-ui/
  PosApp.tsx         ← shared app (extracted from pos.front-component.tsx, props: { api: PosApi, onLogout? })
  PosShell.tsx       ← optional split of layout pieces (reuse if not explosion)
  pos-ui.helpers.ts  ← already isolated (money/state/error)
  pos-ui.styles.ts   ← isolated dark/touch language
src/front-components/pos.front-component.tsx  ← thin: new StandaloneOrTwenty adapter → <PosApp api={twentyApi} />
pos-standalone/
  web/               ← Vite app: import { PosApp } from '../../src/pos-ui/PosApp' + StandalonePosApi
  server/            ← gateway: Node http server already described, reuses src/pos/*, no TWENTY mods
```

Invariant: ONE implementation. No component explosion, no duplicated money/state logic.

**Deployment:**

- **Dev:** `yarn pos:dev` → gateway :3100 + Vite :5173 (proxy `/api` → :3100) OR single vite with middleware.
- **Pilot LAN:** Windows server PC runs `docker compose up` (existing `twenty` stack) + new `pos-gateway` service (build from `pos-standalone/Dockerfile`, exposes `3100:3100`, `depends_on: [server]`, health `/health`, env `TWENTY_API_URL=http://server:3000`, `POS_GATEWAY_PORT=3100`). Terminals open `http://<server-lan-ip>:3100/` or `http://pos.mahabbat.local:3100/` (hosts file). No `localhost` on terminals.
- **Self-host equivalent:** `http://localhost:3100/` for local acceptance; `http://localhost:3000/` CRM stays unchanged.
- **Ports are configurable** via `POS_GATEWAY_PORT` / `POS_WEB_PORT`; no hardcode is part of domain.

**Embedded fallback:**

`definePageLayout({ name:'Mahabbat POS', type:'STANDALONE_PAGE', ... })` and `defineFrontComponent` remain — `CRM → Касса` still renders `<PosApp api={twentyApi}/>`. No divergence: both hosts share polling semantics (12s), money, locks, payments.

**No duplicate domain:**

Gateway does not reimplement `recordPayment/closeOrder/...` rules. It forwards to existing dispatch; only auth/read proxy is added.

**Observability / hardening:**

- Log `requestId, command, status, staffId?, latency` server-side; omit raw PIN & raw token.
- PIN brute-force: keep process-local 5/60s guard (pilot) + document that production LAN/WAF should add distributed limit.
- CORS: single-origin deployment avoids it; dev CORS is allowlist-based, no credentials.

## Deployment

### Dev
```bash
# 1. set server credentials (same as seed):
export TWENTY_API_URL=http://localhost:3000  # or :2020 for disposable
export MAHABBAT_API_KEY=<service-api-key>    # or TWENTY_API_KEY / TWENTY_APP_ACCESS_TOKEN
export MAHABBAT_INTERNAL_ROUTE_SECRET=<private-secret>
export POS_GATEWAY_PORT=3100

# 2. run gateway + standalone web dev together (Vite :5174 proxies /api to gateway :3100)
yarn pos:dev
# then open http://localhost:5174  > PIN screen (no Twenty login)
# or after pos:web:build open http://localhost:3100  (gateway + static)
```

### Self-host (Windows server PC + LAN)
```bash
# Build branded Twenty + POS gateway image
docker build -f mahabbat-app/pos-standalone/Dockerfile -t mahabbat-pos-gateway:local .

# Up: Twenty stack (3000) + POS gateway (3100)
docker compose -f packages/twenty-docker/docker-compose.yml -f docker-compose.pos-standalone.yml up -d
# or with existing logic-functions override:
docker compose -f packages/twenty-docker/docker-compose.yml -f docker-compose.logic-functions.override.yml -f docker-compose.pos-standalone.yml up -d
```

- CRM stays at `http://<server>:3000` (or `http://mahabbat.local:3000`)
- POS standalone at `http://<server-lan-ip>:3100` or `http://pos.mahabbat.local:3100`
  (add hosts file on terminals or use LAN IP — never `localhost` on terminals)
- Gateway env `TWENTY_API_URL=http://server:3000` when running in Docker
- Kiosk: Windows login > Edge/Chrome auto-start `--kiosk http://pos.mahabbat.local:3100 --fullscreen` (fullscreen is aesthetic only — POS works in normal window too)
- Responsive: target viewports are 1920×1080, 1366×768 and restaurant terminals at 1024×768. After a table is selected, the table map collapses and the menu uses the full central workspace; `← Столы` returns to the map.

### Windows touch keyboard on POS terminals

The web page cannot launch `TabTip.exe` directly because Chrome/Edge isolate web
content from Windows processes. POS text controls therefore use native input
semantics (`inputMode` and `enterKeyHint`), while Windows owns the keyboard.

Run this once under the same Windows user account that operates each terminal:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/configure-pos-touch-keyboard.ps1
```

The setup is per-user, idempotent, does not require a custom POS keyboard and
does not weaken browser security. Verify it without changing the setting:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/configure-pos-touch-keyboard.ps1 -CheckOnly
```

Restart Edge/Chrome after the first setup. Tapping menu search, stop-list search,
reservation text fields or payment fields should then open the native Windows
touch keyboard automatically. Repeat the setup for every Windows terminal user.

## Browser secret audit

```bash
yarn pos:web:build
rg -n TWENTY_APP_ACCESS_TOKEN pos-standalone/dist-web/assets/ # must be 0
rg -n MAHABBAT_INTERNAL_ROUTE_SECRET pos-standalone/dist-web/assets/ # 0
rg -n TWENTY_API_KEY pos-standalone/dist-web/assets/ # 0
# allowed browser keys: mahabbat:pos:session (short-lived token), PosApp logic
```

Network tab for `/api/pos/auth` and `/api/pos/command` must show only `pin` in request
and `sessionToken` in response (once) plus `Authorization: Bearer <token>` — never service credentials.

## Threat model (LAN)

Standalone terminals are in trusted LAN (restaurant). Session token is stored in
`sessionStorage` (cleared on logout) — acceptable for LAN kiosk; not hardened for
open internet. Brute-force protection remains authoritative in `authenticatePosStaff`
with a process-local 5 failures / 60 seconds guard; replace with distributed WAF
before internet exposure. Tokens are SHA256-hashed server-side, time-bound 15m,
revocable. Role/staffId are never accepted from client JSON.
