# Mahabbat physical printing v1

This slice adds real Ethernet ESC/POS delivery for operational kitchen tickets and non-fiscal prechecks. It does not implement KKM, OFD, acquiring, bank integration, fiscal receipts, or payment-provider work.

## Operating model

The POS command creates the immutable domain document and a durable `posPrintJob` outbox record. The browser never opens a socket to a printer and never receives printer credentials. A local `print-gateway` polls the authenticated server resolver, claims jobs with a lease, renders the immutable snapshot, and writes raw ESC/POS bytes to TCP port 9100 (or the configured port).

`SENT` means that the gateway completed the socket write. It is not proof that paper was cut or that the printer mechanism accepted the job. `CONFIRMED` is reserved for a future printer profile with a reliable acknowledgement. `OUTCOME_UNKNOWN` is used after a partial write or a gateway restart during dispatch; it must not be silently retried.

## Configuration

Open the **Печать** navigation page as an administrator:

1. Add an Ethernet printer with a label, hostname/IP, TCP port, paper width, encoding profile, and optional precheck flag.
2. Add a production station and select its printer.
3. Assign each menu item to a production station.
4. Start one local gateway on the same network as the configured printers.

The server validates host/port values, persists the selected route, and records configuration changes as operational events. A station without an active printer is a visible failed route, not a browser-side fallback.

Supported text profiles are `CP866`, `WINDOWS1251`, and `UTF8`. The default operational profile is CP866 with an ESC/POS code-page command; verify the actual printer profile with the simulator and a controlled test print before a pilot.

## Document semantics

- New kitchen positions create `KITCHEN_NEW` jobs. A later print contains only positions not previously sent by the server-authoritative `kitchenSentQuantity` cursor.
- A second kitchen print is marked `isAdditional`; it is not a silent duplicate of the first ticket.
- Voiding a sent line creates a separate `KITCHEN_CANCEL` job with `ОТМЕНА` and `НЕ ГОТОВИТЬ` markers.
- A precheck stores guest item names, quantities, prices, totals, table, waiter, and timestamp as an immutable snapshot before enqueueing `PRECHECK`.
- Prechecks contain `НЕ ЯВЛЯЕТСЯ ФИСКАЛЬНЫМ ЧЕКОМ` and are not fiscal documents.
- Explicit retry creates a new job linked by `reprintOfJob` and marks the payload `isReprint`; it never mutates the original snapshot.

## Gateway contract

Set the same internal secret in the Twenty app and the local process. Copy `deploy/print-gateway.env.example` to a local ignored `.env` file, fill the secret, and run:

```text
yarn pos:print-gateway
```

The gateway exposes only a local `GET /health` endpoint. It reports printer `REACHABLE`, `UNREACHABLE`, or `UNKNOWN` to the server. A connection failure before any bytes are sent is retryable. If any bytes may have left the process, the job becomes `OUTCOME_UNKNOWN` and the gateway stops automatic retries.

The resolver marks stale `DISPATCHING` jobs as `OUTCOME_UNKNOWN` after its lease. This protects against duplicate paper after a process crash. An administrator may explicitly request a reprint after checking the printer and kitchen.

## Simulator and checks

The simulator captures bytes without hardware and supports success, refusal, timeout, disconnect before write, and disconnect after a partial write:

```text
PRINTER_SIMULATOR_MODE=success PRINTER_SIMULATOR_PORT=19100 node pos-standalone/server/printer-simulator.mjs
yarn test:printing
```

The automated gate proves renderer bytes, Cyrillic handling, precheck/cancellation markers, retry classification, and the simulator failure modes. It does not prove paper output. A physical-printer acceptance requires a real configured device, a controlled kitchen/precheck/cancellation journey, a duplicate/retry observation, and operator sign-off.

## Security and pilot boundaries

Keep printer IPs and local route secrets in server/admin configuration, not in POS URLs or client-side JavaScript. Restrict gateway health to localhost or a trusted management network. Do not expose the raw printer port to the internet. Do not call a software `SENT` result a physical `PASS` without device evidence.
