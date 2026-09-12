# Mahabbat physical printing v1

This slice adds server-authoritative delivery for operational kitchen tickets
and non-fiscal prechecks. It supports the existing Ethernet RAW TCP provider,
the software simulator, and Windows system-printer queues discovered by the
host gateway. It does not implement KKM, OFD, acquiring, bank integration,
fiscal receipts, or payment-provider work. The Windows discovery and routing
contract is documented in [SYSTEM_PRINTER_DISCOVERY.md](SYSTEM_PRINTER_DISCOVERY.md).

## Operating model

The POS command creates the immutable domain document and a durable
`posPrintJob` outbox record. The browser never opens a socket to a printer and
never receives printer credentials. A print gateway polls the authenticated
server resolver, claims jobs with a lease, renders the immutable snapshot and
dispatches through the selected provider:

- `WINDOWS_SPOOLER` — the Windows host gateway resolves the exact installed
  queue and writes through the Windows Print Spooler;
- `ETHERNET_RAW_TCP` — the gateway writes raw ESC/POS bytes to the configured
  host and port (normally TCP 9100);
- simulator — automated tests capture the bytes without hardware.

`SENT` means that the gateway completed the socket write. It is not proof that paper was cut or that the printer mechanism accepted the job. `CONFIRMED` is reserved for a future printer profile with a reliable acknowledgement. `OUTCOME_UNKNOWN` is used after a partial write or a gateway restart during dispatch; it must not be silently retried.

## Configuration

Open the **Печать** navigation page as an administrator. For a printer already
installed in Windows:

1. Press `Обновить список` to load Windows queues from the host gateway.
2. Select a queue, give it a human-readable `PrinterDevice` name, choose the
   profile/width and save it. IP/port/driver input is not required for this
   path.
3. Add or edit a production station and select the saved device. One device
   may serve multiple stations.
4. Optionally press `Тестовая печать`; `SENT` means transport completion, not
   confirmed paper.
5. Assign each menu item to a production station.

For a directly addressed Ethernet printer, the advanced/raw path still accepts
a label, hostname/IP, TCP port, paper width, encoding profile and optional
precheck flag. Start one local gateway on the same network as configured
printers.

The server validates the selected device or host/port values, persists the
selected route and records configuration changes as operational events. A
station without an active printer is a visible failed route, not a browser-side
fallback. Windows bindings use the exact system queue name and are not silently
reassigned if that queue disappears.

Supported text profiles are `CP866`, `WINDOWS1251`, and `UTF8`. The default operational profile is CP866 with an ESC/POS code-page command; verify the actual printer profile with the simulator and a controlled test print before a pilot.

## Document semantics

- New kitchen positions create `KITCHEN_NEW` jobs. A later print contains only positions not previously sent by the server-authoritative `kitchenSentQuantity` cursor.
- A second kitchen print is marked `isAdditional`; it is not a silent duplicate of the first ticket.
- Voiding a sent line creates a separate `KITCHEN_CANCEL` job with `ОТМЕНА` and `НЕ ГОТОВИТЬ` markers.
- A precheck stores guest item names, quantities, prices, totals, table, waiter, and timestamp as an immutable snapshot before enqueueing `PRECHECK`.
- Prechecks contain `НЕ ЯВЛЯЕТСЯ ФИСКАЛЬНЫМ ЧЕКОМ` and are not fiscal documents.
- Explicit retry creates a new job linked by `reprintOfJob` and marks the payload `isReprint`; it never mutates the original snapshot.

## Gateway contract

Set the same internal secret in the Twenty app and the local host gateway.
The backend discovery route calls the gateway through
`MAHABBAT_PRINT_GATEWAY_URL`; the browser never sees this endpoint or secret.
From the outer deployment repository, `mahabbat-start.ps1` starts the gateway
and waits for health. For a direct development run, copy
`deploy/print-gateway.env.example` to a local ignored environment, fill the
secret and run:

```text
yarn pos:print-gateway
```

The gateway exposes health and authenticated system-printer discovery/dispatch
endpoints. The Windows provider uses `Get-Printer` for queue discovery and the
Windows Print Spooler for writes. It reports printer `REACHABLE`,
`UNREACHABLE`, or `UNKNOWN` to the server. A connection failure before any
bytes are sent is retryable. If any bytes may have left the process, the job
becomes `OUTCOME_UNKNOWN` and the gateway stops automatic retries.

The resolver marks stale `DISPATCHING` jobs as `OUTCOME_UNKNOWN` after its lease. This protects against duplicate paper after a process crash. An administrator may explicitly request a reprint after checking the printer and kitchen.

## Simulator and checks

The simulator captures bytes without hardware and supports success, refusal, timeout, disconnect before write, and disconnect after a partial write:

```text
PRINTER_SIMULATOR_MODE=success PRINTER_SIMULATOR_PORT=19100 node pos-standalone/server/printer-simulator.mjs
yarn test:printing
```

The automated gate proves renderer bytes, Cyrillic handling, precheck/cancellation markers, retry classification, and the simulator failure modes. It does not prove paper output. A physical-printer acceptance requires a real configured device, a controlled kitchen/precheck/cancellation journey, a duplicate/retry observation, and operator sign-off.

## Security and pilot boundaries

Keep printer IPs, system queue details and local route secrets in
server/admin configuration, not in POS URLs or client-side JavaScript. Keep
the host gateway firewalled to the local/trusted host network and require the
internal HMAC route signature. Do not expose the raw printer port to the
internet. Do not call a software `SENT` result a physical `PASS` without
device evidence.
