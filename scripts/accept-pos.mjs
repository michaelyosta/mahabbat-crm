/**
 * Mahabbat POS slice 1 runtime acceptance against a live Twenty workspace.
 *
 * Exercises the full public command boundary: workspace API-key access is used
 * only by this local acceptance harness; POS commands themselves use short-
 * lived Mahabbat POS sessions obtained through authenticatePosStaff.
 *
 * Usage:
 *   MAHABBAT_API_URL=http://host.docker.internal:2020 \
 *   MAHABBAT_API_KEY=<workspace api key> \
 *   MAHABBAT_POS_PIN_A=<admin PIN> MAHABBAT_POS_PIN_B=<waiter PIN> \
 *   node scripts/accept-pos.mjs
 *
 * Deterministic and re-runnable: uses the seeded POS Acceptance zone/tables
 * and the explicit ADMIN/WAITER PIN contract. Reconciliation deletes only
 * records owned by those acceptance fixtures.
 */
import { randomUUID } from 'node:crypto';

const RESOLVER_UID = '54be0dfa-2fd6-45bc-be93-6ba4c64a21d9';
const ACCEPTANCE_ZONE_NAME = 'POS Acceptance';
const ACCEPTANCE_TABLE_NUMBERS = new Set(['POS-A1', 'POS-A2', 'POS-A3']);
let STAFF_A = '';
let STAFF_B = '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getEnv = () => {
  const apiUrl = process.env.MAHABBAT_API_URL?.trim();
  const apiKey = process.env.MAHABBAT_API_KEY?.trim();
  if (!apiUrl || !apiKey) {
    throw new Error('MAHABBAT_API_URL and MAHABBAT_API_KEY must be set');
  }
  return { apiUrl: apiUrl.replace(/\/+$/, ''), apiKey };
};

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` (${detail})` : ''}`);
};

const restGet = async (apiUrl, apiKey, plural) => {
  const records = [];
  let cursor = null;
  let previousCursor = null;
  do {
    const query = new URLSearchParams({ limit: '200' });
    if (cursor) query.set('starting_after', cursor);
    const res = await fetch(`${apiUrl}/rest/${plural}?${query}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`GET /rest/${plural} -> ${res.status}`);
    const payload = await res.json();
    records.push(...(payload.data?.[plural] ?? []));
    cursor = payload.pageInfo?.hasNextPage ? payload.pageInfo.endCursor : null;
    if (cursor && cursor === previousCursor) {
      throw new Error(`GET /rest/${plural} returned a non-advancing cursor`);
    }
    previousCursor = cursor;
  } while (cursor);
  return records;
};

const deleteRecord = async (apiUrl, apiKey, plural, id) => {
  const res = await fetch(`${apiUrl}/rest/${plural}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (![200, 204].includes(res.status)) {
    throw new Error(`DELETE /rest/${plural}/${id} -> ${res.status}`);
  }
};

const postCommand = async (apiUrl, apiKey, command, session, payload) => {
  const envelope = { command, payload };
  if (session?.sessionToken) envelope.sessionToken = session.sessionToken;
  const res = await fetch(`${apiUrl}/s/pos/command`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(envelope),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
};

const authenticate = async (apiUrl, apiKey, credential, terminalId) => {
  const payload = credential.pin
    ? { pin: credential.pin, terminalId }
    : { cardIdentifier: credential.cardIdentifier, terminalId };
  const res = await fetch(`${apiUrl}/s/pos/command`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ command: 'authenticatePosStaff', payload }),
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (res.status !== 201 || typeof body?.sessionToken !== 'string' || !body.staff?.id) {
    throw new Error(`POS staff authentication failed with status ${res.status}`);
  }
  return {
    staffId: body.staff.id,
    role: body.staff.role,
    displayName: body.staff.displayName,
    sessionToken: body.sessionToken,
  };
};

const sumActiveMicros = (lines) =>
  lines
    .filter((l) => l.status === 'ACTIVE')
    .reduce((sum, l) => sum + (l.unitPrice?.amountMicros ?? 0) * (l.quantity ?? 0), 0);

const requireUuid = (label, value) => {
  const ok = typeof value === 'string' && UUID_RE.test(value);
  check(label, ok, ok ? value : 'missing');
  if (!ok) throw new Error(`${label} did not return a UUID`);
  return value;
};

const reconcileAcceptanceFixtures = async (apiUrl, apiKey, tableIds, sessions) => {
  const [orders, guests, lines, shifts, kitchenTickets, kitchenTicketLines, prechecks] = await Promise.all([
    restGet(apiUrl, apiKey, 'posOrders'),
    restGet(apiUrl, apiKey, 'posOrderGuests'),
    restGet(apiUrl, apiKey, 'posOrderLines'),
    restGet(apiUrl, apiKey, 'posShifts'),
    restGet(apiUrl, apiKey, 'posKitchenTickets'),
    restGet(apiUrl, apiKey, 'posKitchenTicketLines'),
    restGet(apiUrl, apiKey, 'posPrechecks'),
  ]);
  const acceptanceOrders = orders.filter((order) => tableIds.has(order.tableId));
  const acceptanceOrderIds = new Set(acceptanceOrders.map((order) => order.id));
  const acceptanceLines = lines.filter((line) => acceptanceOrderIds.has(line.orderId));
  const acceptanceGuests = guests.filter((guest) => acceptanceOrderIds.has(guest.orderId));
  const acceptanceTickets = kitchenTickets.filter((ticket) => acceptanceOrderIds.has(ticket.orderId));
  const acceptanceTicketIds = new Set(acceptanceTickets.map((ticket) => ticket.id));
  const acceptanceTicketLines = kitchenTicketLines.filter((line) => acceptanceTicketIds.has(line.ticketId));
  const acceptancePrechecks = prechecks.filter((precheck) => acceptanceOrderIds.has(precheck.orderId));

  for (const precheck of acceptancePrechecks) {
    await deleteRecord(apiUrl, apiKey, 'posPrechecks', precheck.id);
  }

  for (const ticketLine of acceptanceTicketLines) {
    await deleteRecord(apiUrl, apiKey, 'posKitchenTicketLines', ticketLine.id);
  }
  for (const ticket of acceptanceTickets) {
    await deleteRecord(apiUrl, apiKey, 'posKitchenTickets', ticket.id);
  }
  for (const line of acceptanceLines) {
    await deleteRecord(apiUrl, apiKey, 'posOrderLines', line.id);
  }
  for (const guest of acceptanceGuests) {
    await deleteRecord(apiUrl, apiKey, 'posOrderGuests', guest.id);
  }
  for (const order of acceptanceOrders) {
    await deleteRecord(apiUrl, apiKey, 'posOrders', order.id);
  }

  const sessionsByStaff = new Map(sessions.map((session) => [session.staffId, session]));
  const openAcceptanceShifts = shifts.filter(
    (shift) => shift.isOpen === true && sessionsByStaff.has(shift.staffId),
  );
  for (const shift of openAcceptanceShifts) {
    const session = sessionsByStaff.get(shift.staffId);
    const closed = await postCommand(apiUrl, apiKey, 'closeShift', session, {
      shiftId: shift.id,
    });
    if (closed.status !== 200) {
      throw new Error(`Could not reconcile acceptance shift ${shift.id}: ${closed.status}`);
    }
  }

  const remainingOrders = (await restGet(apiUrl, apiKey, 'posOrders')).filter((order) =>
    tableIds.has(order.tableId),
  );
  if (remainingOrders.length > 0) {
    throw new Error('Acceptance fixture reconciliation left POS orders on reserved tables.');
  }

  return {
    orders: acceptanceOrders.length,
    guests: acceptanceGuests.length,
    lines: acceptanceLines.length,
    shifts: openAcceptanceShifts.length,
    prechecks: acceptancePrechecks.length,
  };
};

const main = async () => {
  const { apiUrl, apiKey } = getEnv();

  console.log(`POS acceptance target: ${apiUrl}`);
  console.log('');

  const health = await fetch(`${apiUrl}/healthz`).catch(() => null);
  check('server reachable', Boolean(health?.ok), health ? `status ${health.status}` : 'no response');

  const pinA = process.env.MAHABBAT_POS_PIN_A?.trim();
  const pinB = process.env.MAHABBAT_POS_PIN_B?.trim();
  if (!pinA || !pinB) {
    throw new Error('MAHABBAT_POS_PIN_A and MAHABBAT_POS_PIN_B must be set for live POS acceptance');
  }
  const admin = await authenticate(apiUrl, apiKey, { pin: pinA }, 'acceptance-a');
  const waiter = await authenticate(apiUrl, apiKey, { pin: pinB }, 'acceptance-b');
  STAFF_A = admin.staffId;
  STAFF_B = waiter.staffId;
  const roleContractOk = admin.role === 'ADMIN' && waiter.role === 'WAITER';
  check(
    'PIN role contract is A=ADMIN and B=WAITER',
    roleContractOk,
    `A=${admin.role ?? 'unknown'}, B=${waiter.role ?? 'unknown'}`,
  );
  if (!roleContractOk) {
    throw new Error('Acceptance PIN role contract failed: PIN_A must be ADMIN and PIN_B must be WAITER.');
  }

  const tamperedSession = await postCommand(
    apiUrl,
    apiKey,
    'openShift',
    { sessionToken: `${admin.sessionToken}tampered` },
    { idempotencyKey: randomUUID() },
  );
  check(
    'tampered POS session is rejected before command dispatch',
    tamperedSession.status === 401 &&
      ['POS_SESSION_INVALID', 'POS_SESSION_EXPIRED', 'POS_SESSION_REQUIRED'].includes(
        tamperedSession.body?.code,
      ),
    `status ${tamperedSession.status}, code ${tamperedSession.body?.code}`,
  );

  const spoofedActor = await fetch(`${apiUrl}/s/pos/command`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      command: 'openShift',
      sessionToken: admin.sessionToken,
      actor: { staffId: STAFF_B, role: 'ADMIN' },
      payload: { idempotencyKey: randomUUID() },
    }),
  });
  const spoofedActorText = await spoofedActor.text();
  let spoofedActorBody = null;
  try {
    spoofedActorBody = JSON.parse(spoofedActorText);
  } catch {
    spoofedActorBody = { raw: spoofedActorText };
  }
  check(
    'client actor/role spoofing is rejected by the command parser',
    spoofedActor.status === 400 && spoofedActorBody?.code === 'INVALID_ACTOR',
    `status ${spoofedActor.status}, code ${spoofedActorBody?.code}`,
  );

  const [zones, tables, menuItems] = await Promise.all([
    restGet(apiUrl, apiKey, 'posZones'),
    restGet(apiUrl, apiKey, 'posTables'),
    restGet(apiUrl, apiKey, 'posMenuItems'),
  ]);

  const acceptanceZone = zones.find(
    (zone) => zone.name === ACCEPTANCE_ZONE_NAME && zone.isActive !== false,
  );
  const acceptanceTables = tables
    .filter(
      (table) =>
        table.zoneId === acceptanceZone?.id &&
        ACCEPTANCE_TABLE_NUMBERS.has(table.number) &&
        table.isActive !== false &&
        table.layout === 'acceptance-only',
    )
    .sort((a, b) => a.number.localeCompare(b.number));
  const acceptanceFixturesOk =
    Boolean(acceptanceZone) && acceptanceTables.length === ACCEPTANCE_TABLE_NUMBERS.size;
  check(
    'POS Acceptance zone and exactly three reserved tables are present',
    acceptanceFixturesOk,
    `${acceptanceZone?.name ?? 'missing zone'}: ${acceptanceTables.map((table) => table.number).join(', ')}`,
  );
  if (!acceptanceFixturesOk) {
    throw new Error('POS Acceptance fixtures are missing or incomplete; run seed:pos first.');
  }

  const acceptanceTableIds = new Set(acceptanceTables.map((table) => table.id));
  const reconciliation = await reconcileAcceptanceFixtures(apiUrl, apiKey, acceptanceTableIds, [admin, waiter]);
  check(
    'POS Acceptance fixtures reconciled without touching other tables',
    true,
    `orders=${reconciliation.orders}, guests=${reconciliation.guests}, lines=${reconciliation.lines}, shifts=${reconciliation.shifts}`,
  );

  const activeAcceptanceOrders = (await restGet(apiUrl, apiKey, 'posOrders')).filter((order) =>
    acceptanceTableIds.has(order.tableId) && ['OPEN', 'IN_PROGRESS'].includes(order.status),
  );
  check(
    'POS Acceptance tables start free',
    activeAcceptanceOrders.length === 0,
    `activeOrders=${activeAcceptanceOrders.length}`,
  );
  if (activeAcceptanceOrders.length > 0) {
    throw new Error('POS Acceptance tables are still occupied after reconciliation.');
  }
  const menu = menuItems.map((m) => m.id);

  check('POS menu fixtures present', menu.length >= 2, `${menu.length} menu items`);
  if (menu.length < 2) throw new Error('POS menu fixtures are missing.');

  const freeTable = acceptanceTables[0].id;
  const secondFreeTable = acceptanceTables[1].id;
  const thirdFreeTable = acceptanceTables[2].id;

  const shiftKey = randomUUID();
  const openShift = await postCommand(apiUrl, apiKey, 'openShift', admin, {
    idempotencyKey: shiftKey,
  });
  check(
    'openShift creates/returns an OPEN shift',
    openShift.status === 200 || openShift.status === 201,
    `status ${openShift.status}, body ${JSON.stringify(openShift.body)}`,
  );
  const shiftId = requireUuid('openShift returns a shiftId', openShift.body?.shiftId);

  const repeatShift = await postCommand(apiUrl, apiKey, 'openShift', admin, {
    idempotencyKey: shiftKey,
  });
  check(
    'openShift idempotent on same key',
    [200, 201].includes(repeatShift.status) && repeatShift.body?.shiftId === shiftId,
    `status ${repeatShift.status}, shiftId ${repeatShift.body?.shiftId}`,
  );

  const secondKey = randomUUID();
  const racedShift = await postCommand(apiUrl, apiKey, 'openShift', admin, {
    idempotencyKey: secondKey,
  });
  const openForStaff = await restGet(apiUrl, apiKey, 'posShifts');
  const opens = openForStaff.filter((s) => s.staffId === STAFF_A && s.isOpen === true);
  check(
    'one open shift per staff after second distinct call',
    [200, 201].includes(racedShift.status) && opens.length === 1,
    `opens=${opens.length}, returned shift ${racedShift.body?.shiftId}`,
  );

  const foreignClose = await postCommand(apiUrl, apiKey, 'closeShift', waiter, {
    shiftId,
  });
  check(
    'foreign staff cannot close a shift they do not own',
    foreignClose.status === 400 && foreignClose.body?.code === 'SHIFT_NOT_OWNED',
    `status ${foreignClose.status}, code ${foreignClose.body?.code}`,
  );

  if (freeTable) {
    const orderKey = randomUUID();
    const openOrder = await postCommand(apiUrl, apiKey, 'openOrder', admin, {
      tableId: freeTable,
      idempotencyKey: orderKey,
    });
    check(
      'openOrder creates an OPEN order on a free table',
      [200, 201].includes(openOrder.status),
      `status ${openOrder.status}, body ${JSON.stringify(openOrder.body)}`,
    );
    const orderId = requireUuid('openOrder returns an orderId', openOrder.body?.orderId);
    const repeatOrder = await postCommand(apiUrl, apiKey, 'openOrder', admin, {
      tableId: freeTable,
      idempotencyKey: orderKey,
    });
    check(
      'openOrder idempotent on same key',
      [200, 201].includes(repeatOrder.status) && repeatOrder.body?.orderId === orderId,
      `shiftId ... duplicate key returned ${repeatOrder.body?.orderId}`,
    );

    const occupiedKey = randomUUID();
    const conflictOrder = await postCommand(apiUrl, apiKey, 'openOrder', admin, {
      tableId: freeTable,
      idempotencyKey: occupiedKey,
    });
    check(
      'second openOrder on occupied table is honest conflict (not 500)',
      conflictOrder.status === 409 || conflictOrder.status === 400,
      `status ${conflictOrder.status}, body ${JSON.stringify(conflictOrder.body)}`,
    );

    if (secondFreeTable && orderId) {
      const order2Key = randomUUID();
      const openOrder2 = await postCommand(apiUrl, apiKey, 'openOrder', admin, {
        tableId: secondFreeTable,
        idempotencyKey: order2Key,
      });
      const order2Id = requireUuid('second openOrder returns an orderId', openOrder2.body?.orderId);
      check(
        'second order opens on another free table',
        [200, 201].includes(openOrder2.status) && typeof order2Id === 'string',
        `status ${openOrder2.status}, body ${JSON.stringify(openOrder2.body)}`,
      );

      if (order2Id) {
        const guest1Key = randomUUID();
        const addGuest1 = await postCommand(apiUrl, apiKey, 'addGuest', admin, {
          orderId: order2Id,
          idempotencyKey: guest1Key,
        });
        const guest1Id = requireUuid('addGuest #1 returns a guestId', addGuest1.body?.guestId);
        const guest2Key = randomUUID();
        const addGuest2 = await postCommand(apiUrl, apiKey, 'addGuest', admin, {
          orderId: order2Id,
          idempotencyKey: guest2Key,
          name: 'Айгерим',
        });
        const guest2Id = requireUuid('addGuest #2 returns a guestId', addGuest2.body?.guestId);
        check('addGuest #1 works', [200, 201].includes(addGuest1.status) && typeof guest1Id === 'string',
          `status ${addGuest1.status}, guestId ${guest1Id}`);
        check('addGuest #2 works', [200, 201].includes(addGuest2.status) && typeof guest2Id === 'string',
          `status ${addGuest2.status}, guestId ${guest2Id}`);
        const repeatGuest = await postCommand(apiUrl, apiKey, 'addGuest', admin, {
          orderId: order2Id,
          idempotencyKey: guest1Key,
        });
        check(
          'addGuest idempotent on same key',
          [200, 201].includes(repeatGuest.status) && repeatGuest.body?.guestId === guest1Id,
          `status ${repeatGuest.status}`,
        );

        if (guest1Id && guest2Id) {
          // Stop-list is server-authoritative: a client that loaded the menu
          // before the change must still be rejected by addLine.
          const stopKey = randomUUID();
          const stopAdded = await postCommand(apiUrl, apiKey, 'addStopListEntry', waiter, {
            menuItemId: menu[0],
            idempotencyKey: stopKey,
          });
          const stopReplay = await postCommand(apiUrl, apiKey, 'addStopListEntry', waiter, {
            menuItemId: menu[0],
            idempotencyKey: stopKey,
          });
          check(
            'addStopListEntry is idempotent and available to WAITER',
            [200, 201].includes(stopAdded.status) &&
              [200, 201].includes(stopReplay.status) &&
              stopReplay.body?.stopListEntryId === stopAdded.body?.stopListEntryId,
            `statuses ${stopAdded.status}/${stopReplay.status}`,
          );
          const staleAdd = await postCommand(apiUrl, apiKey, 'addLine', admin, {
            orderId: order2Id,
            guestId: guest1Id,
            menuItemId: menu[0],
            quantity: 1,
            idempotencyKey: randomUUID(),
          });
          check(
            'stale client is blocked by server stop-list validation',
            staleAdd.status === 400 && staleAdd.body?.code === 'STOP_LISTED',
            `status ${staleAdd.status}, code ${staleAdd.body?.code}`,
          );
          const stopCleared = await postCommand(apiUrl, apiKey, 'clearStopListEntry', waiter, {
            menuItemId: menu[0],
            idempotencyKey: randomUUID(),
          });
          check(
            'clearStopListEntry re-enables the menu item',
            stopCleared.status === 200 && stopCleared.body?.isActive === false,
            `status ${stopCleared.status}`,
          );

          const line1Key = randomUUID();
          const line1 = await postCommand(apiUrl, apiKey, 'addLine', admin, {
            orderId: order2Id,
            guestId: guest1Id,
            menuItemId: menu[0],
            quantity: 2,
            idempotencyKey: line1Key,
          });
          const line1Id = requireUuid('addLine #1 returns a lineId', line1.body?.lineId);
          const line2Key = randomUUID();
          const line2 = await postCommand(apiUrl, apiKey, 'addLine', admin, {
            orderId: order2Id,
            guestId: guest1Id,
            menuItemId: menu[0],
            quantity: 1,
            idempotencyKey: line2Key,
          });
          const line2Id = requireUuid('addLine #2 returns a lineId', line2.body?.lineId);
          const line3Key = randomUUID();
          const line3 = await postCommand(apiUrl, apiKey, 'addLine', admin, {
            orderId: order2Id,
            guestId: guest2Id,
            menuItemId: menu[2 % menu.length],
            quantity: 1,
            idempotencyKey: line3Key,
          });
          const line3Id = requireUuid('addLine #3 returns a lineId', line3.body?.lineId);
          check('addLine identical item is a separate line (no merge)',
            [200, 201].includes(line1.status) && [200, 201].includes(line2.status) && [200, 201].includes(line3.status) &&
              new Set([line1Id, line2Id, line3Id]).size === 3,
            `line1 ${line1.body?.lineId}, line2 ${line2.body?.lineId}, line3 ${line3.body?.lineId}`);

          if (line1Id && line2Id) {
            const orderLines = await restGet(apiUrl, apiKey, 'posOrderLines');
            const myLines = orderLines.filter((l) => l.orderId === order2Id);
            check(
              'two independent lines preserve the same menu item identity',
              myLines.filter((line) => line.menuItemId === menu[0]).length === 2,
              `sameMenuLines=${myLines.filter((line) => line.menuItemId === menu[0]).length}`,
            );
            const expectedSubtotal = sumActiveMicros(myLines);
            const orderFromRest = (await restGet(apiUrl, apiKey, 'posOrders')).find((o) => o.id === order2Id);
            check(
              'totals recomputed after addLine',
              orderFromRest?.subtotal?.amountMicros === expectedSubtotal &&
                orderFromRest?.total?.amountMicros === expectedSubtotal &&
                orderFromRest?.total?.currencyCode === 'KZT' &&
                typeof orderFromRest?.subtotal === 'object',
              `subtotal ${orderFromRest?.subtotal?.amountMicros}, expected ${expectedSubtotal}`,
            );
            const guests = await restGet(apiUrl, apiKey, 'posOrderGuests');
            const guest1 = guests.find((g) => g.id === guest1Id);
            const guest2 = guests.find((g) => g.id === guest2Id);
            const guest1Expected = sumActiveMicros(myLines.filter((l) => l.guestId === guest1Id));
            const guest2Expected = sumActiveMicros(myLines.filter((l) => l.guestId === guest2Id));
            check(
              'per-guest subtotal recomputed',
              guest1?.subtotal?.amountMicros === guest1Expected &&
                guest2?.subtotal?.amountMicros === guest2Expected,
              `guest1 ${guest1?.subtotal?.amountMicros}/${guest1Expected}, guest2 ${guest2?.subtotal?.amountMicros}/${guest2Expected}`,
            );
            const reloadedOrder = (await restGet(apiUrl, apiKey, 'posOrders')).find(
              (order) => order.id === order2Id,
            );
            const reloadedGuests = (await restGet(apiUrl, apiKey, 'posOrderGuests')).filter(
              (guest) => guest.orderId === order2Id,
            );
            const reloadedLines = (await restGet(apiUrl, apiKey, 'posOrderLines')).filter(
              (line) => line.orderId === order2Id,
            );
            check(
              'reload/second client sees persisted order state',
              reloadedOrder?.id === order2Id &&
                reloadedGuests.length === 2 &&
                reloadedLines.length === 3 &&
                reloadedOrder.total?.amountMicros === expectedSubtotal,
              `guests=${reloadedGuests.length}, lines=${reloadedLines.length}, total=${reloadedOrder?.total?.amountMicros}`,
            );

            const firstPrintKey = randomUUID();
            const firstPrint = await postCommand(apiUrl, apiKey, 'printKitchenTicket', admin, {
              orderId: order2Id,
              idempotencyKey: firstPrintKey,
            });
            const ticketsAfterFirstPrint = (await restGet(apiUrl, apiKey, 'posKitchenTickets'))
              .filter((ticket) => ticket.orderId === order2Id);
            const ticketIdsAfterFirstPrint = new Set(ticketsAfterFirstPrint.map((ticket) => ticket.id));
            const ticketLinesAfterFirstPrint = (await restGet(apiUrl, apiKey, 'posKitchenTicketLines'))
              .filter((line) => ticketIdsAfterFirstPrint.has(line.ticketId));
            check(
              'first PRINT creates one immutable ticket with all unsent lines',
              [200, 201].includes(firstPrint.status) &&
                ticketsAfterFirstPrint.length === 1 &&
                ticketLinesAfterFirstPrint.length === 3 &&
                ticketLinesAfterFirstPrint.every((line) => line.action === 'ADD' && line.quantity > 0),
              `status ${firstPrint.status}, tickets=${ticketsAfterFirstPrint.length}, lines=${ticketLinesAfterFirstPrint.length}`,
            );
            const printRetry = await postCommand(apiUrl, apiKey, 'printKitchenTicket', admin, {
              orderId: order2Id,
              idempotencyKey: firstPrintKey,
            });
            const ticketsAfterRetry = (await restGet(apiUrl, apiKey, 'posKitchenTickets'))
              .filter((ticket) => ticket.orderId === order2Id);
            check(
              'PRINT retry returns the same semantic ticket without duplication',
              [200, 201].includes(printRetry.status) &&
                printRetry.body?.ticketId === firstPrint.body?.ticketId &&
                ticketsAfterRetry.length === 1,
              `status ${printRetry.status}, tickets=${ticketsAfterRetry.length}`,
            );
            const printNoop = await postCommand(apiUrl, apiKey, 'printKitchenTicket', admin, {
              orderId: order2Id,
              idempotencyKey: randomUUID(),
            });
            check(
              'PRINT with no new lines is an explicit no-op',
              printNoop.status === 200 && printNoop.body?.printStatus === 'NO_UNSENT_LINES',
              `status ${printNoop.status}, printStatus ${printNoop.body?.printStatus}`,
            );

            const changeQty = await postCommand(apiUrl, apiKey, 'changeLineQuantity', admin, {
              lineId: line1Id,
              quantity: 3,
            });
            check('changeLineQuantity works', changeQty.status === 200, `status ${changeQty.status}`);

            const deltaPrint = await postCommand(apiUrl, apiKey, 'printKitchenTicket', admin, {
              orderId: order2Id,
              idempotencyKey: randomUUID(),
            });
            const ticketsAfterDelta = (await restGet(apiUrl, apiKey, 'posKitchenTickets'))
              .filter((ticket) => ticket.orderId === order2Id);
            const deltaTicket = ticketsAfterDelta.find((ticket) => ticket.id !== firstPrint.body?.ticketId);
            const deltaTicketLines = deltaTicket
              ? (await restGet(apiUrl, apiKey, 'posKitchenTicketLines')).filter((line) => line.ticketId === deltaTicket.id)
              : [];
            check(
              'second PRINT contains only the unsent quantity delta',
              [200, 201].includes(deltaPrint.status) &&
                ticketsAfterDelta.length === 2 &&
                deltaTicketLines.length === 1 &&
                deltaTicketLines[0].quantity === 1,
              `status ${deltaPrint.status}, tickets=${ticketsAfterDelta.length}, deltaLines=${deltaTicketLines.length}`,
            );

            const extraLine = await postCommand(apiUrl, apiKey, 'addLine', admin, {
              orderId: order2Id,
              guestId: guest2Id,
              menuItemId: menu[1 % menu.length],
              quantity: 1,
              idempotencyKey: randomUUID(),
            });
            const parallelPrints = await Promise.all([
              postCommand(apiUrl, apiKey, 'printKitchenTicket', admin, { orderId: order2Id, idempotencyKey: randomUUID() }),
              postCommand(apiUrl, apiKey, 'printKitchenTicket', admin, { orderId: order2Id, idempotencyKey: randomUUID() }),
            ]);
            const ticketsAfterParallelPrint = (await restGet(apiUrl, apiKey, 'posKitchenTickets'))
              .filter((ticket) => ticket.orderId === order2Id);
            check(
              'parallel PRINT converges to one additional semantic ticket',
              [200, 201].includes(extraLine.status) &&
                parallelPrints.every((result) => [200, 201].includes(result.status)) &&
                ticketsAfterParallelPrint.length === 3,
              `addLine=${extraLine.status}, printStatuses=${parallelPrints.map((result) => result.status).join('/')}, tickets=${ticketsAfterParallelPrint.length}`,
            );

            const changeQtyZero = await postCommand(apiUrl, apiKey, 'changeLineQuantity', admin, {
              lineId: line1Id,
              quantity: 0,
            });
            check('changeLineQuantity rejects qty 0', changeQtyZero.status === 400, `status ${changeQtyZero.status}`);

            const notOwned = await postCommand(apiUrl, apiKey, 'addGuest', waiter, {
              orderId: order2Id,
              idempotencyKey: randomUUID(),
            });
            check(
              'foreign staff cannot mutate an order they do not own',
              notOwned.status === 400 && notOwned.body?.code === 'ORDER_NOT_OWNED',
              `status ${notOwned.status}, code ${notOwned.body?.code}`,
            );

            const precheckKey = randomUUID();
            const createPrecheck = await postCommand(apiUrl, apiKey, 'createPrecheck', admin, {
              orderId: order2Id,
              idempotencyKey: precheckKey,
            });
            const prechecksAfterCreate = (await restGet(apiUrl, apiKey, 'posPrechecks'))
              .filter((precheck) => precheck.orderId === order2Id);
            const activePrecheck = prechecksAfterCreate.find((precheck) => precheck.status === 'ACTIVE');
            const lockedOrder = (await restGet(apiUrl, apiKey, 'posOrders')).find((order) => order.id === order2Id);
            check(
              'createPrecheck snapshots totals and locks the order',
              [200, 201].includes(createPrecheck.status) &&
                createPrecheck.body?.precheckId === activePrecheck?.id &&
                activePrecheck?.printStatus === 'PRINTED' &&
                activePrecheck?.totalSnapshot?.amountMicros === lockedOrder?.total?.amountMicros &&
                lockedOrder?.status === 'PRECHECK_PRINTED',
              `status ${createPrecheck.status}, prechecks=${prechecksAfterCreate.length}, orderStatus=${lockedOrder?.status}`,
            );

            const precheckRetry = await postCommand(apiUrl, apiKey, 'createPrecheck', admin, {
              orderId: order2Id,
              idempotencyKey: precheckKey,
            });
            const prechecksAfterRetry = (await restGet(apiUrl, apiKey, 'posPrechecks'))
              .filter((precheck) => precheck.orderId === order2Id && precheck.status === 'ACTIVE');
            check(
              'createPrecheck retry is idempotent',
              precheckRetry.status === 200 &&
                precheckRetry.body?.precheckId === createPrecheck.body?.precheckId &&
                prechecksAfterRetry.length === 1,
              `status ${precheckRetry.status}, activePrechecks=${prechecksAfterRetry.length}`,
            );

            const lockedMutation = await postCommand(apiUrl, apiKey, 'addLine', admin, {
              orderId: order2Id,
              guestId: guest2Id,
              menuItemId: menu[1 % menu.length],
              quantity: 1,
              idempotencyKey: randomUUID(),
            });
            check(
              'PRECHECK_PRINTED rejects server-side order mutations',
              lockedMutation.status === 400 && lockedMutation.body?.code === 'ORDER_NOT_EDITABLE',
              `status ${lockedMutation.status}, code ${lockedMutation.body?.code}`,
            );

            const waiterCancelPrecheck = await postCommand(apiUrl, apiKey, 'cancelPrecheck', waiter, {
              orderId: order2Id,
              idempotencyKey: randomUUID(),
            });
            check(
              'WAITER cannot cancel a precheck',
              waiterCancelPrecheck.status === 403 && waiterCancelPrecheck.body?.code === 'COMMAND_FORBIDDEN',
              `status ${waiterCancelPrecheck.status}, code ${waiterCancelPrecheck.body?.code}`,
            );

            const cancelPrecheckKey = randomUUID();
            const cancelPrecheck = await postCommand(apiUrl, apiKey, 'cancelPrecheck', admin, {
              orderId: order2Id,
              idempotencyKey: cancelPrecheckKey,
            });
            const cancelledPrecheck = (await restGet(apiUrl, apiKey, 'posPrechecks'))
              .find((precheck) => precheck.id === createPrecheck.body?.precheckId);
            const unlockedOrder = (await restGet(apiUrl, apiKey, 'posOrders')).find((order) => order.id === order2Id);
            check(
              'ADMIN cancelPrecheck restores editability with audit state',
              cancelPrecheck.status === 200 &&
                cancelledPrecheck?.status === 'CANCELLED' &&
                cancelledPrecheck?.cancelIdempotencyKey === cancelPrecheckKey &&
                unlockedOrder?.status === 'IN_PROGRESS',
              `status ${cancelPrecheck.status}, precheckStatus=${cancelledPrecheck?.status}, orderStatus=${unlockedOrder?.status}`,
            );

            const cancelRetry = await postCommand(apiUrl, apiKey, 'cancelPrecheck', admin, {
              orderId: order2Id,
              idempotencyKey: cancelPrecheckKey,
            });
            check(
              'cancelPrecheck retry is idempotent',
              cancelRetry.status === 200 &&
                cancelRetry.body?.precheckId === cancelPrecheck.body?.precheckId,
              `status ${cancelRetry.status}`,
            );

            const postCancelLine = await postCommand(apiUrl, apiKey, 'addLine', admin, {
              orderId: order2Id,
              guestId: guest2Id,
              menuItemId: menu[1 % menu.length],
              quantity: 1,
              idempotencyKey: randomUUID(),
            });
            check(
              'order is editable again after ADMIN cancelPrecheck',
              [200, 201].includes(postCancelLine.status),
              `status ${postCancelLine.status}`,
            );
          }
        }

        const closeShift = await postCommand(apiUrl, apiKey, 'closeShift', admin, {
          shiftId,
        });
        check(
          'closeShift marks shift CLOSED',
          closeShift.status === 200 && closeShift.body?.status === 'CLOSED',
          `status ${closeShift.status}, body ${JSON.stringify(closeShift.body)}`,
        );

        if (thirdFreeTable) {
          const afterClose = await postCommand(apiUrl, apiKey, 'openOrder', admin, {
            tableId: thirdFreeTable,
            idempotencyKey: randomUUID(),
          });
          check(
            'openOrder on closed shift requires an open shift',
            afterClose.status === 400 && afterClose.body?.code === 'SHIFT_REQUIRED',
            `status ${afterClose.status}, code ${afterClose.body?.code}`,
          );
        }
      }
    }
  }

  // Concurrency: parallel terminals racing the same resource must converge to
  // exactly one record and honest errors, never a duplicate or a 500.
  const crmStart = await restGet(apiUrl, apiKey, 'people');
  const crmStartOrders = await restGet(apiUrl, apiKey, 'orders');

  const openShiftKeys = [randomUUID(), randomUUID()];
  const racers = openShiftKeys.map((idempotencyKey) =>
    postCommand(apiUrl, apiKey, 'openShift', waiter, { idempotencyKey }),
  );
  const racedShifts = await Promise.all(racers);
  const racedShiftsOk = racedShifts.every((r) => [200, 201].includes(r.status));
  const sameShift = new Set(racedShifts.map((r) => r.body?.shiftId).filter(Boolean)).size === 1;
  const openForB = (await restGet(apiUrl, apiKey, 'posShifts')).filter(
    (s) => s.staffId === STAFF_B && s.isOpen === true,
  );
  check(
    'parallel openShift race converges to one open shift per staff',
    racedShiftsOk && sameShift && openForB.length === 1,
    `statuses ${racedShifts.map((r) => r.status).join(',')}, shiftsForB=${openForB.length}`,
  );
  const shiftBId = requireUuid('parallel openShift race returns a shiftId', racedShifts[0]?.body?.shiftId);

  const raceTable = thirdFreeTable;
  const activeRaceOrders = (await restGet(apiUrl, apiKey, 'posOrders')).filter(
    (order) => order.tableId === raceTable && ['OPEN', 'IN_PROGRESS'].includes(order.status),
  );
  check('reserved race table is free before concurrency test', activeRaceOrders.length === 0,
    `activeOnTable=${activeRaceOrders.length}`);
  if (activeRaceOrders.length > 0) throw new Error('Reserved race table is unexpectedly occupied.');

  const orderRaceKeys = [randomUUID(), randomUUID()];
  const orderRacers = orderRaceKeys.map((idempotencyKey) =>
    postCommand(apiUrl, apiKey, 'openOrder', waiter, {
      tableId: raceTable,
      idempotencyKey,
    }),
  );
  const racedOrders = await Promise.all(orderRacers);
  const ordersOnTableAfter = (await restGet(apiUrl, apiKey, 'posOrders')).filter(
    (order) => order.tableId === raceTable && ['OPEN', 'IN_PROGRESS'].includes(order.status),
  );
  const racedOrdersOk = racedOrders.every((r) => [200, 201, 409].includes(r.status));
  check(
    'parallel openOrder race leaves exactly one active order on the table',
    racedOrdersOk && ordersOnTableAfter.length === 1,
    `statuses ${racedOrders.map((r) => r.status).join(',')}, activeOnTable=${ordersOnTableAfter.length}`,
  );
  if (ordersOnTableAfter.length !== 1) throw new Error('Parallel openOrder did not produce exactly one winner.');
  const wonOrderId = requireUuid('parallel openOrder returns a winning orderId', ordersOnTableAfter[0]?.id);

  const guestKey = randomUUID();
  const racedGuest = await postCommand(apiUrl, apiKey, 'addGuest', waiter, {
    orderId: wonOrderId,
    idempotencyKey: guestKey,
  });
  const raceGuestId = requireUuid('parallel order receives a guestId', racedGuest.body?.guestId);
  const sameKey = randomUUID();
  const lineRacers = [1, 2].map(() =>
    postCommand(apiUrl, apiKey, 'addLine', waiter, {
      orderId: wonOrderId,
      guestId: raceGuestId,
      menuItemId: menu[0],
      quantity: 1,
      idempotencyKey: sameKey,
    }),
  );
  const racedLines = await Promise.all(lineRacers);
  const linesForOrder = (await restGet(apiUrl, apiKey, 'posOrderLines')).filter(
    (line) => line.orderId === wonOrderId,
  );
  const racedLinesOk = racedLines.every((r) => [200, 201].includes(r.status));
  check(
    'parallel addLine with the same idempotency key creates one line',
    racedLinesOk && linesForOrder.length === 1,
    `statuses ${racedLines.map((r) => r.status).join(',')}, lines=${linesForOrder.length}`,
  );

  const closeB = await postCommand(apiUrl, apiKey, 'closeShift', waiter, { shiftId: shiftBId });
  check(
    'concurrent terminal shift closes cleanly',
    closeB.status === 200 && closeB.body?.status === 'CLOSED',
    `status ${closeB.status}`,
  );

  // CRM smoke: the standard customer/order surfaces still work alongside POS.
  const crmSmokeIdentity = 'CRM-SMOKE::POS-SLICE-1';
  const existingCrmSmoke = crmStart.find(
    (person) => person.externalIdentityKey === crmSmokeIdentity,
  );
  const crmPerson = {
    name: { firstName: 'Асет', lastName: 'Смок' },
    externalIdentityKey: crmSmokeIdentity,
  };
  const createRes = existingCrmSmoke
    ? { status: 200 }
    : await fetch(`${apiUrl}/rest/people`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(crmPerson),
      });
  const createdPerson = existingCrmSmoke
    ? null
    : createRes.status === 201
      ? await createRes.json()
      : null;
  const createdId = existingCrmSmoke?.id ?? createdPerson?.data?.createPerson?.id;
  let readBack = false;
  if (createdId) {
    const getRes = await fetch(`${apiUrl}/rest/people/${createdId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const getBody = getRes.ok ? await getRes.json() : null;
    readBack = getBody?.data?.person?.id === createdId;
  }
  check(
    'CRM smoke: standard customer create/read still works',
    [200, 201].includes(createRes.status) && Boolean(createdId) && readBack,
    `status ${createRes.status}, id ${createdId ?? 'none'}, peopleBefore=${crmStart.length}, orders=${crmStartOrders.length}`,
  );

  const bogusSig = await fetch(`${apiUrl}/webhooks/server/${RESOLVER_UID}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-mahabbat-signature': '0000000000000000000000000000000000000000000000000000000000000000',
    },
    body: JSON.stringify({
      command: 'openShift',
      payload: { idempotencyKey: randomUUID() },
    }),
  });
  const bogusText = await bogusSig.text();
  let bogusBody = null;
  try {
    bogusBody = JSON.parse(bogusText);
  } catch {
    bogusBody = { raw: bogusText };
  }
  check(
    'external unsigned/bad-signature webhook call is rejected',
    bogusSig.status === 403 && bogusBody?.code === 'INVALID_SIGNATURE',
    `status ${bogusSig.status}, body ${JSON.stringify(bogusBody)}`,
  );

  console.log('');
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`ACCEPTANCE FAILED: ${failed.length} failed of ${results.length}`);
    process.exitCode = 1;
  } else {
    console.log(`ACCEPTANCE PASSED: ${results.length} checks`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
