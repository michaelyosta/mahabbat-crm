# System printer discovery and routing

This document describes the Windows printer path for the Mahabbat App. It is
an application/deployment boundary, not a new printing business workflow.
Physical paper acceptance remains a separate step.

## Architecture

The normal Windows flow is:

```text
Mahabbat Printing UI
        |
        v
Twenty authenticated App route
        |
        v
Windows host print gateway :3110
        |
        +--> Windows Print Spooler / installed queues
        |
        +--> PrintJob renderer and transport
```

The browser does not enumerate or control printers. It does not use
`window.print`, WebUSB, WebSerial, browser extensions, or a direct socket.
The backend resolves the destination and the host gateway is the only
component that reads Windows queues or writes to the spooler.

The implementation is split across:

- `src/logic-functions/printing-discovery.logic-function.ts` — authenticated
  backend proxy for discovery;
- `pos-standalone/server/windows-printer-provider.mjs` — Windows queue
  discovery and spooler transport;
- `pos-standalone/server/print-gateway.mjs` — host-side gateway and HMAC
  boundary;
- `src/printing/system-printer.ts` — normalized discovery model and exact
  binding lookup;
- `src/front-components/printing-admin.front-component.tsx` — `Печать`
  settings UI;
- `src/pos/pos-command.dispatch.ts` — server-authoritative device and route
  commands;
- `src/printing/print-queue.ts` and
  `src/printing/print-gateway.resolver.logic-function.ts` — PrintJob
  resolution, immutable destination snapshots and dispatch.

The existing simulator and Ethernet RAW TCP provider remain supported. The
Windows provider is an additional transport, not a replacement for either.

## Discovery versus configuration

`SystemPrinter`/`DiscoveredSystemPrinter` is runtime state: what Windows sees
now. It is not automatically a business record. The provider returns the
queue name, display name, driver, port, availability/status, capability
classification and last-seen information where Windows exposes it.

`PrinterDevice` is Mahabbat configuration: a named device selected by an
administrator. For a Windows device it stores the exact `systemQueueName` and
uses `connectionType=WINDOWS_SPOOLER`. The queue name is the stable binding;
process IDs and a list position are never used.

If a queue is renamed or removed, the exact binding becomes unavailable. The
UI shows `Не найден`/`Недоступен` and requires an explicit rebind. Mahabbat
does not silently choose another queue.

Windows status is deliberately conservative:

- `Подключён` — the queue is available to the provider;
- `Недоступен` — Windows reports or the provider observes unavailability;
- `Не найден` — the configured queue is absent from discovery;
- `Состояние неизвестно` — the driver does not provide a reliable state.

Compatibility is independent from availability. An office queue or
`Microsoft Print to PDF` may be discoverable while ESC/POS compatibility is
`UNKNOWN`. A queue name alone is not proof of an ESC/POS profile.

## Administrator workflow

Open `Настройки → Печать` (the App navigation item is `Печать`):

1. Press `Обновить список` after installing or changing a Windows printer.
2. Select a discovered queue under `Устройства`.
3. Give the Mahabbat device a human name, for example `Принтер кухни`.
4. Choose the printer profile and paper width. IP, RAW port and driver
   identifiers are not required for a Windows queue.
5. Press `Сохранить`, then optionally `Тестовая печать`.
6. Under `Маршрутизация`, assign the device to `Кухня`, `Бар`, `Мангал`,
   `Пречек` or another `ProductionStation` and save the route.

One `PrinterDevice` may serve several stations. A station may be explicitly
reassigned to another device without changing application code. A station
without a route is an error; there is no first-printer or default-printer
fallback.

The normal UI uses Russian operational terms and hides transport details.
Queue name, driver, port and last error are available only under
`Подробнее`/diagnostics.

## Server-authoritative printing

The browser may request a business action such as `PRINT KITCHEN`, but it
does not choose an arbitrary physical destination. The server resolves:

```text
KitchenTicket
  -> ProductionStation
  -> PrinterDevice
  -> exact systemQueueName
  -> PrintJob
```

When the job is created, its payload contains the resolved station/device and
system binding snapshot. Later route changes affect new jobs only. Historical
jobs retain their destination evidence for retry and audit purposes.

`Test Print` uses the same server command and PrintJob/outbox path as other
software printing. It is not a hidden browser shortcut. The result
`Отправлено на принтер` means that the gateway accepted/completed the
configured transport step; it does not mean that paper, cutter or physical
device acknowledgement was confirmed.

## Host gateway and secrets

The host gateway runs beside the Windows Print Spooler. Docker containers call
it through `MAHABBAT_PRINT_GATEWAY_URL` (normally
`http://host.docker.internal:3110`). The internal route is authenticated with
`MAHABBAT_INTERNAL_ROUTE_SECRET`; the secret is kept in the local private
environment and is never returned to the browser.

The gateway may need a host-reachable bind address for Docker Desktop. Keep
port `3110` firewalled from untrusted networks and retain the HMAC check. Do
not expose the gateway or the printer's RAW port to the internet.

From the outer deployment repository, the reproducible lifecycle is:

```powershell
.\scripts\mahabbat-start.ps1
.\scripts\mahabbat-status.ps1
.\scripts\mahabbat-doctor.ps1
.\scripts\mahabbat-stop.ps1
```

`mahabbat-start.ps1` starts the host gateway before declaring `READY`.
`status` reports the gateway, discovered Windows queue count, configured
`PrinterDevice` count and broken bindings. `doctor` checks Docker, the
Spooler, gateway health, discovery and exact configured bindings.

For a direct gateway development run, use the inner repository's
`yarn pos:print-gateway` with a private environment containing the same
internal secret. Do not put that secret in Git or in frontend configuration.

## Profiles and existing transports

Profiles are device configuration, not restaurant-specific renderer logic.
The current UI exposes `CP866`, `WINDOWS1251` and `UTF8` choices with 58 mm or
80 mm paper width. Windows discovery does not infer a profile from a
manufacturer name. If compatibility is unknown, use a controlled test print
and keep the status unverified until a real device is tested.

`ETHERNET_RAW_TCP` remains available for a directly configured printer and
continues to use its explicit host/port contract. `SIMULATOR` remains the
automated test transport. `WINDOWS_SPOOLER` is the queue-backed host transport.

## Failure handling

- Empty discovery: check the Windows `Spooler` service, `Get-Printer` and the
  host gateway health before changing application configuration.
- Missing queue: refresh the list and explicitly select a replacement. Never
  rename a `PrinterDevice` to a different queue without an operator action.
- Missing station route: the server records a diagnosable failed print state;
  it does not use the first configured printer.
- Test print failure: show a short operational message such as
  `Принтер недоступен` or `Ошибка очереди печати`; keep raw diagnostics in
  server/gateway logs only.
- `SENT` is not physical confirmation. A virtual queue proves discovery and
  transport integration, not Cyrillic output, 80 mm geometry, cutter action or
  paper handling.

## Verification boundary

Automated coverage includes discovery normalization, exact stable bindings,
unknown status, unavailable queues, refresh, multi-station assignment,
reassignment, missing routes/devices, immutable PrintJob destinations,
server-side destination authority, normal Test Print enqueueing, secret
exclusion and simulator compatibility.

The Windows virtual queue was used for software discovery/routing evidence.
The following remain explicitly untested until a real 80 mm ESC/POS printer is
connected:

- physical paper output;
- Cyrillic glyphs on paper;
- 80 mm layout and feed;
- cutter;
- hardware/network failure behavior;
- fiscal receipts, KKM, OFD, acquiring and refunds.
