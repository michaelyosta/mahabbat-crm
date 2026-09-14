# Temporary remote print bridge

This is a development-only arrangement for physical tests while the Mahabbat
server remains on the home PC and the printer is at the restaurant. It is not
the production topology. After the deployment moves to the restaurant LAN,
remove the remote gateway process and return `PRINT_GATEWAY_MODE` to `LOCAL`.

## Architecture conclusion

**B — the existing Print Gateway is reusable and needs only a small explicit
remote mode.** A second print agent is not required.

The existing gateway already:

- runs independently of Docker and the Twenty server process;
- polls `POST /webhooks/server/<print-gateway-resolver-id>` from the gateway
  host, so the restaurant PC initiates the job connection;
- authenticates every resolver request with
  `MAHABBAT_INTERNAL_ROUTE_SECRET` HMAC;
- renders the existing immutable `PrintJob` snapshot;
- writes through Windows Print Spooler for an installed USB/Ethernet queue;
- retains the existing Ethernet RAW TCP provider when a direct printer address
  is intentionally configured;
- reports `SENT`, `FAILED` and `OUTCOME_UNKNOWN` through the existing pipeline.

The small remote-mode change makes the topology explicit, prevents the home
host lifecycle from starting a competing local gateway, and optionally adds
Cloudflare Access service-token headers for the outbound request. The
server-side chain is unchanged:

```text
Home Mahabbat
  -> KitchenTicket / Precheck
  -> immutable PrintJob
  <- outbound HTTPS polling from restaurant gateway
Restaurant Windows PC
  -> Windows Print Spooler or Ethernet RAW TCP
  -> Soft Group 8256
```

The gateway never opens printer TCP `9100` to the Internet. A remote gateway
must use either an HTTPS/private-VPN home origin or a narrowly scoped
Cloudflare Access service token. The HMAC secret remains required in both
places.

## Important discovery boundary

`/system-printers` is still a local, HMAC-protected gateway endpoint. The
normal `Настройки → Печать` discovery proxy assumes that the backend can reach
the gateway. A restaurant gateway behind NAT therefore needs a private return
path (for example, an existing VPN or a temporary authenticated reverse
connection) if the home UI must enumerate Windows queues.

Do not publish port `3110` or printer port `9100` just to solve this. If a
private return path is unavailable, do not claim Windows queue discovery or
physical acceptance; use the already-supported direct Ethernet RAW TCP path
only when the restaurant-side printer address and port have been confirmed
and configured through an approved private operational procedure.

## Restaurant PC setup

1. Install Node.js compatible with the repository engine and copy/clone the
   inner repository so `pos-standalone/server/print-gateway.mjs` is present.
2. Copy `deploy/print-gateway.remote.env.example` to a private ignored file,
   for example `.private\print-gateway.remote.env`.
3. Set `TWENTY_API_URL` to the HTTPS/private-VPN origin of the home Mahabbat
   backend. Do not put a printer IP in this variable.
4. Set the same private `MAHABBAT_INTERNAL_ROUTE_SECRET` as the home app.
5. If the home origin is behind Cloudflare Access, set the paired
   `CLOUDFLARE_ACCESS_CLIENT_ID` and `CLOUDFLARE_ACCESS_CLIENT_SECRET` values
   in the private file. They are never sent to the browser or committed.
6. Set a unique `PRINT_GATEWAY_ID` for this restaurant PC.
7. Confirm the Soft Group 8256 is installed as a Windows queue, or confirm the
   private Ethernet address/RAW port for the direct Ethernet provider. Do not
   expose either address publicly.
8. Start the temporary process:

```powershell
.\scripts\mahabbat-remote-print-gateway.ps1 -Action start -EnvFile .\.private\print-gateway.remote.env
.\scripts\mahabbat-remote-print-gateway.ps1 -Action status
```

The script binds its health/discovery endpoint to `127.0.0.1` by default and
does not install a permanent Windows service. If a reboot test is required,
use a temporary, documented Task Scheduler entry and remove it after testing.

## Home PC setup

Set this in the home deployment `.env` while the restaurant gateway is the
only dispatcher:

```text
PRINT_GATEWAY_MODE=REMOTE
```

Then run the normal lifecycle scripts. In this mode `mahabbat-start.ps1` does
not start a local print gateway, `status` reports `REMOTE`, and `doctor` does
not incorrectly inspect the home PC's Spooler or printer queues. This avoids
two gateways racing to claim the same `PrintJob` records.

For the ordinary local-LAN topology, remove/replace the remote setting with:

```text
PRINT_GATEWAY_MODE=LOCAL
```

and use the existing `mahabbat-start.ps1` host gateway lifecycle.

## Physical acceptance checklist

Only run this after the restaurant gateway reports healthy and the selected
PrinterDevice route is explicit:

1. Test Print.
2. Cyrillic text.
3. One kitchen ticket.
4. Additional/delta ticket.
5. `PREPARED` cancellation ticket.
6. Non-fiscal precheck.
7. Cutter, if the physical profile supports it.
8. Ten sequential jobs with no duplicate output.
9. Gateway stopped/offline, then reconnect.
10. Gateway restart and one controlled retry review.

Photograph the real paper output and record the actual printer profile. A
software `SENT` state, Microsoft Print to PDF, or a simulator is not evidence
of Cyrillic-on-paper, 80 mm geometry, cutter behavior, or physical delivery.

## Stop and remove the bridge

```powershell
.\scripts\mahabbat-remote-print-gateway.ps1 -Action stop
```

On the home PC restore `PRINT_GATEWAY_MODE=LOCAL` (or the normal deployment
choice), then run `mahabbat-start.ps1`. Remove the private remote env file and
any temporary Task Scheduler entry. Do not run `docker compose down -v` and do
not delete PostgreSQL/Redis volumes.

## Troubleshooting

- `REMOTE PRINT GATEWAY STOPPED`: start the restaurant-side script and inspect
  `.private\remote-print-gateway.err.log` locally.
- Resolver `401`/HTML response: the home origin is likely behind Cloudflare
  Access; configure a valid service token or use an already authenticated
  private origin. Do not disable Access.
- No jobs claimed: confirm the home app has `PRINT_GATEWAY_MODE=REMOTE`, the
  gateway ID is unique, HMAC secrets match, and the resolver URL is reachable.
- Windows queue is absent: confirm the Spooler and the exact queue name on the
  restaurant PC. Mahabbat never silently rebinds a missing queue.
- `OUTCOME_UNKNOWN`: do not blindly retry; inspect the printer and paper first
  because bytes may have left the gateway.

The current machine has only `Microsoft Print to PDF` available, so it cannot
prove the Soft Group 8256 physical path. Real restaurant-PC access, the
printer's confirmed LAN/queue setup, and any required Cloudflare Access
service token remain external prerequisites for physical acceptance.
