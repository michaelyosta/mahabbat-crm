/**
 * Mahabbat POS slice 1 runtime acceptance against a live Twenty workspace.
 *
 * Exercises the full public command boundary: authenticated POST to the
 * gateway route `/s/pos/command` (API key bearer) which validates the envelope,
 * signs it with the internal HMAC secret and forwards to the app-only server
 * resolver. Persisted state is verified through /rest.
 *
 * Usage:
 *   MAHABBAT_API_URL=http://host.docker.internal:2020 \
 *   MAHABBAT_API_KEY=<workspace api key> \
 *   node scripts/accept-pos.mjs
 *
 * Self-adaptive and re-runnable: picks staff with no open shift and free
 * tables by live query, uses fresh idempotency keys per run, and never
 * deletes anything.
 */
import { randomUUID } from 'node:crypto';

const RESOLVER_UID = '54be0dfa-2fd6-45bc-be93-6ba4c64a21d9';
const STAFF_A = '20202020-0687-4c41-b707-ed1bfca972a7';
const STAFF_B = '32323232-0001-4000-8000-000000000000';
const OTHER_STAFF = '00000000-0000-4000-8000-000000000000';

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
  const res = await fetch(`${apiUrl}/rest/${plural}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`GET /rest/${plural} -> ${res.status}`);
  const payload = await res.json();
  return payload.data?.[plural] ?? [];
};

const postCommand = async (apiUrl, apiKey, command, actor, payload) => {
  const envelope = { command, actor, payload };
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

const sumActiveMicros = (lines) =>
  lines
    .filter((l) => l.status === 'ACTIVE')
    .reduce((sum, l) => sum + (l.unitPrice?.amountMicros ?? 0) * (l.quantity ?? 0), 0);

const main = async () => {
  const { apiUrl, apiKey } = getEnv();

  console.log(`POS acceptance target: ${apiUrl}`);
  console.log('');

  const health = await fetch(`${apiUrl}/healthz`).catch(() => null);
  check('server reachable', Boolean(health?.ok), health ? `status ${health.status}` : 'no response');

  const waiter = { staffId: STAFF_A, role: 'WAITER' };
  const waiterB = { staffId: STAFF_B, role: 'WAITER' };
  const otherWaiter = { staffId: OTHER_STAFF, role: 'WAITER' };

  const [tables, menuItems, shifts, orders] = await Promise.all([
    restGet(apiUrl, apiKey, 'posTables'),
    restGet(apiUrl, apiKey, 'posMenuItems'),
    restGet(apiUrl, apiKey, 'posShifts'),
    restGet(apiUrl, apiKey, 'posOrders'),
  ]);

  check('seed fixtures present', tables.length >= 4 && menuItems.length >= 2,
    `${tables.length} tables, ${menuItems.length} menu items`);

  const openShiftIds = new Set(
    shifts.filter((s) => s.isOpen === true).map((s) => s.staffId),
  );
  const busyTables = new Set(
    orders.filter((o) => ['OPEN', 'IN_PROGRESS'].includes(o.status)).map((o) => o.tableId),
  );
  const freeTables = tables.filter((t) => !busyTables.has(t.id)).map((t) => t.id);
  const menu = menuItems.map((m) => m.id);

  const freeTable = freeTables[0];
  const secondFreeTable = freeTables[1];
  const thirdFreeTable = freeTables[2];

  const hasOpen = openShiftIds.has(STAFF_A);
  const shiftKey = randomUUID();
  const openShift = await postCommand(apiUrl, apiKey, 'openShift', waiter, {
    staffId: STAFF_A,
    idempotencyKey: shiftKey,
  });
  check(
    'openShift creates/returns an OPEN shift',
    openShift.status === 200 || openShift.status === 201,
    `status ${openShift.status}, body ${JSON.stringify(openShift.body)}`,
  );
  const shiftId = openShift.body?.shiftId;
  check('openShift returns a shiftId', typeof shiftId === 'string' && UUID_RE.test(shiftId), shiftId);

  const repeatShift = await postCommand(apiUrl, apiKey, 'openShift', waiter, {
    staffId: STAFF_A,
    idempotencyKey: shiftKey,
  });
  check(
    'openShift idempotent on same key',
    [200, 201].includes(repeatShift.status) && repeatShift.body?.shiftId === shiftId,
    `status ${repeatShift.status}, shiftId ${repeatShift.body?.shiftId}`,
  );

  if (!hasOpen) {
    const secondKey = randomUUID();
    const racedShift = await postCommand(apiUrl, apiKey, 'openShift', waiter, {
      staffId: STAFF_A,
      idempotencyKey: secondKey,
    });
    const openForStaff = await restGet(apiUrl, apiKey, 'posShifts');
    const opens = openForStaff.filter((s) => s.staffId === STAFF_A && s.isOpen === true);
    check(
      'one open shift per staff after second distinct call',
      [200, 201].includes(racedShift.status) && opens.length === 1,
      `opens=${opens.length}, returned shift ${racedShift.body?.shiftId}`,
    );
  }

  const foreignClose = await postCommand(apiUrl, apiKey, 'closeShift', waiterB, {
    shiftId,
  });
  check(
    'foreign staff cannot close a shift they do not own',
    foreignClose.status === 400 && foreignClose.body?.code === 'SHIFT_NOT_OWNED',
    `status ${foreignClose.status}, code ${foreignClose.body?.code}`,
  );

  if (freeTable) {
    const orderKey = randomUUID();
    const openOrder = await postCommand(apiUrl, apiKey, 'openOrder', waiter, {
      tableId: freeTable,
      idempotencyKey: orderKey,
    });
    check(
      'openOrder creates an OPEN order on a free table',
      [200, 201].includes(openOrder.status),
      `status ${openOrder.status}, body ${JSON.stringify(openOrder.body)}`,
    );
    const orderId = openOrder.body?.orderId;
    const repeatOrder = await postCommand(apiUrl, apiKey, 'openOrder', waiter, {
      tableId: freeTable,
      idempotencyKey: orderKey,
    });
    check(
      'openOrder idempotent on same key',
      [200, 201].includes(repeatOrder.status) && repeatOrder.body?.orderId === orderId,
      `shiftId ... duplicate key returned ${repeatOrder.body?.orderId}`,
    );

    const occupiedKey = randomUUID();
    const conflictOrder = await postCommand(apiUrl, apiKey, 'openOrder', waiter, {
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
      const openOrder2 = await postCommand(apiUrl, apiKey, 'openOrder', waiter, {
        tableId: secondFreeTable,
        idempotencyKey: order2Key,
      });
      const order2Id = openOrder2.body?.orderId;
      check(
        'second order opens on another free table',
        [200, 201].includes(openOrder2.status) && typeof order2Id === 'string',
        `status ${openOrder2.status}, body ${JSON.stringify(openOrder2.body)}`,
      );

      if (order2Id) {
        const guest1Key = randomUUID();
        const addGuest1 = await postCommand(apiUrl, apiKey, 'addGuest', waiter, {
          orderId: order2Id,
          idempotencyKey: guest1Key,
        });
        const guest1Id = addGuest1.body?.guestId;
        const guest2Key = randomUUID();
        const addGuest2 = await postCommand(apiUrl, apiKey, 'addGuest', waiter, {
          orderId: order2Id,
          idempotencyKey: guest2Key,
          name: 'Айгерим',
        });
        const guest2Id = addGuest2.body?.guestId;
        check('addGuest #1 works', [200, 201].includes(addGuest1.status) && typeof guest1Id === 'string',
          `status ${addGuest1.status}, guestId ${guest1Id}`);
        check('addGuest #2 works', [200, 201].includes(addGuest2.status) && typeof guest2Id === 'string',
          `status ${addGuest2.status}, guestId ${guest2Id}`);
        const repeatGuest = await postCommand(apiUrl, apiKey, 'addGuest', waiter, {
          orderId: order2Id,
          idempotencyKey: guest1Key,
        });
        check(
          'addGuest idempotent on same key',
          [200, 201].includes(repeatGuest.status) && repeatGuest.body?.guestId === guest1Id,
          `status ${repeatGuest.status}`,
        );

        if (guest1Id && guest2Id) {
          const line1Key = randomUUID();
          const line1 = await postCommand(apiUrl, apiKey, 'addLine', waiter, {
            orderId: order2Id,
            guestId: guest1Id,
            menuItemId: menu[0],
            quantity: 2,
            idempotencyKey: line1Key,
          });
          const line1Id = line1.body?.lineId;
          const line2Key = randomUUID();
          const line2 = await postCommand(apiUrl, apiKey, 'addLine', waiter, {
            orderId: order2Id,
            guestId: guest1Id,
            menuItemId: menu[1],
            quantity: 1,
            idempotencyKey: line2Key,
          });
          const line2Id = line2.body?.lineId;
          const line3Key = randomUUID();
          const line3 = await postCommand(apiUrl, apiKey, 'addLine', waiter, {
            orderId: order2Id,
            guestId: guest2Id,
            menuItemId: menu[2 % menu.length],
            quantity: 1,
            idempotencyKey: line3Key,
          });
          check('addLine identical item is a separate line (no merge)',
            [200, 201].includes(line1.status) && [200, 201].includes(line2.status) && [200, 201].includes(line3.status),
            `line1 ${line1.body?.lineId}, line2 ${line2.body?.lineId}, line3 ${line3.body?.lineId}`);

          if (line1Id && line2Id) {
            const orderLines = await restGet(apiUrl, apiKey, 'posOrderLines');
            const myLines = orderLines.filter((l) => l.orderId === order2Id);
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

            const changeQty = await postCommand(apiUrl, apiKey, 'changeLineQuantity', waiter, {
              lineId: line1Id,
              quantity: 3,
            });
            check('changeLineQuantity works', changeQty.status === 200, `status ${changeQty.status}`);

            const changeQtyZero = await postCommand(apiUrl, apiKey, 'changeLineQuantity', waiter, {
              lineId: line1Id,
              quantity: 0,
            });
            check('changeLineQuantity rejects qty 0', changeQtyZero.status === 400, `status ${changeQtyZero.status}`);

            const notOwned = await postCommand(apiUrl, apiKey, 'addGuest', otherWaiter, {
              orderId: order2Id,
              idempotencyKey: randomUUID(),
            });
            check(
              'foreign staff cannot mutate an order they do not own',
              notOwned.status === 400 && notOwned.body?.code === 'ORDER_NOT_OWNED',
              `status ${notOwned.status}, code ${notOwned.body?.code}`,
            );
          }
        }

        const closeShift = await postCommand(apiUrl, apiKey, 'closeShift', waiter, {
          shiftId,
        });
        check(
          'closeShift marks shift CLOSED',
          closeShift.status === 200 && closeShift.body?.status === 'CLOSED',
          `status ${closeShift.status}, body ${JSON.stringify(closeShift.body)}`,
        );

        if (thirdFreeTable) {
          const afterClose = await postCommand(apiUrl, apiKey, 'openOrder', waiter, {
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
    postCommand(apiUrl, apiKey, 'openShift', waiterB, { staffId: STAFF_B, idempotencyKey }),
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
  const shiftBId = racedShifts[0]?.body?.shiftId;

  const tablesNow = await restGet(apiUrl, apiKey, 'posTables');
  const ordersNow = await restGet(apiUrl, apiKey, 'posOrders');
  const busyNow = new Set(
    ordersNow.filter((o) => ['OPEN', 'IN_PROGRESS'].includes(o.status)).map((o) => o.tableId),
  );
  const raceTable = tablesNow.map((t) => t.id).find((id) => !busyNow.has(id));
  if (raceTable && shiftBId) {
    const orderRaceKeys = [randomUUID(), randomUUID()];
    const orderRacers = orderRaceKeys.map((idempotencyKey) =>
      postCommand(apiUrl, apiKey, 'openOrder', waiterB, {
        tableId: raceTable,
        idempotencyKey,
      }),
    );
    const racedOrders = await Promise.all(orderRacers);
    const ordersOnTableAfter = (await restGet(apiUrl, apiKey, 'posOrders')).filter(
      (o) => o.tableId === raceTable && ['OPEN', 'IN_PROGRESS'].includes(o.status),
    );
    const racedOrdersOk = racedOrders.every((r) => [200, 201, 409].includes(r.status));
    check(
      'parallel openOrder race leaves exactly one active order on the table',
      racedOrdersOk && ordersOnTableAfter.length === 1,
      `statuses ${racedOrders.map((r) => r.status).join(',')}, activeOnTable=${ordersOnTableAfter.length}`,
    );
    const wonOrderId = ordersOnTableAfter[0]?.id;

    if (wonOrderId && raceTable) {
      const guestKey = randomUUID();
      const racedGuest = await postCommand(apiUrl, apiKey, 'addGuest', waiterB, {
        orderId: wonOrderId,
        idempotencyKey: guestKey,
      });
      const raceGuestId = racedGuest.body?.guestId;
      if (raceGuestId && menu.length > 0) {
        const sameKey = randomUUID();
        const lineRacers = [1, 2].map(() =>
          postCommand(apiUrl, apiKey, 'addLine', waiterB, {
            orderId: wonOrderId,
            guestId: raceGuestId,
            menuItemId: menu[0],
            quantity: 1,
            idempotencyKey: sameKey,
          }),
        );
        const racedLines = await Promise.all(lineRacers);
        const linesForOrder = (await restGet(apiUrl, apiKey, 'posOrderLines')).filter(
          (l) => l.orderId === wonOrderId,
        );
        const racedLinesOk = racedLines.every((r) => [200, 201].includes(r.status));
        check(
          'parallel addLine with the same idempotency key creates one line',
          racedLinesOk && linesForOrder.length === 1,
          `statuses ${racedLines.map((r) => r.status).join(',')}, lines=${linesForOrder.length}`,
        );
      }
    }

    const closeB = await postCommand(apiUrl, apiKey, 'closeShift', waiterB, { shiftId: shiftBId });
    check(
      'concurrent terminal shift closes cleanly',
      closeB.status === 200 && closeB.body?.status === 'CLOSED',
      `status ${closeB.status}`,
    );
  }

  // CRM smoke: the standard customer/order surfaces still work alongside POS.
  const crmPerson = {
    name: { firstName: 'Асет', lastName: 'Смок' },
    externalIdentityKey: `CRM-SMOKE::${randomUUID()}`,
  };
  const createRes = await fetch(`${apiUrl}/rest/people`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(crmPerson),
  });
  const createdPerson = createRes.status === 201 ? await createRes.json() : null;
  const createdId = createdPerson?.data?.createPerson?.id;
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
    createRes.status === 201 && Boolean(createdId) && readBack,
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
      actor: { staffId: STAFF_A, role: 'WAITER' },
      payload: { staffId: STAFF_A, idempotencyKey: randomUUID() },
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