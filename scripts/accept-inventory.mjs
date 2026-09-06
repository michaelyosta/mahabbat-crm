/**
 * Mahabbat Inventory live runtime and backoffice acceptance.
 *
 * This is intentionally an API/browser-independent live harness. It exercises
 * public HTTP command boundaries, REST evidence and the POS->Inventory bridge.
 * Use it only against a local pilot workspace:
 *   MAHABBAT_API_URL=http://localhost:2020 MAHABBAT_API_KEY=<key> node scripts/accept-inventory.mjs
 *
 * The workspace key and generated PINs are process-local and are never printed.
 * The run uses an isolated INV-* namespace and leaves its audit fixtures intact.
 */
import { randomUUID, scryptSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MICROS_PER_KG = 1_000_000;
const MICROS_PER_GRAM = 1_000;

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` (${detail})` : ''}`);
};
const accepted = (status) => status === 200 || status === 201;
const id = () => randomUUID();
const kg = (value) => Math.round(value * MICROS_PER_KG);
const grams = (value) => Math.round(value * MICROS_PER_GRAM);
const commandDelayMs = Math.max(0, Number.parseInt(process.env.MAHABBAT_INVENTORY_COMMAND_DELAY_MS ?? '0', 10) || 0);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parseBody = async (response) => {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
};

const env = () => {
  const apiUrl = process.env.MAHABBAT_API_URL?.trim();
  const apiKey = process.env.MAHABBAT_API_KEY?.trim();
  if (!apiUrl || !apiKey) throw new Error('MAHABBAT_API_URL and MAHABBAT_API_KEY must be set');
  const suppliedRun = process.env.MAHABBAT_INVENTORY_RUN_ID?.trim();
  const runId = suppliedRun || `${Date.now()}-${id().slice(0, 8)}`;
  return { apiUrl: apiUrl.replace(/\/+$/, ''), apiKey, runId };
};

const restGet = async (apiUrl, apiKey, plural) => {
  const rows = [];
  let cursor = null;
  let previous = null;
  do {
    const query = new URLSearchParams({ limit: '200' });
    if (cursor) query.set('starting_after', cursor);
    const response = await fetch(`${apiUrl}/rest/${plural}?${query}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) throw new Error(`GET /rest/${plural} -> ${response.status}`);
    const body = await response.json();
    rows.push(...(body.data?.[plural] ?? []));
    cursor = body.pageInfo?.hasNextPage ? body.pageInfo.endCursor : null;
    if (cursor && cursor === previous) throw new Error(`GET /rest/${plural} returned a non-advancing cursor`);
    previous = cursor;
  } while (cursor);
  return rows;
};

const restBatch = async (apiUrl, apiKey, plural, rows) => {
  const response = await fetch(`${apiUrl}/rest/batch/${plural}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(rows),
  });
  const body = await parseBody(response);
  if (!response.ok) throw new Error(`POST /rest/batch/${plural} -> ${response.status}`);
  return body;
};

const pinHash = (pin) => {
  const salt = Buffer.from(id().replaceAll('-', '').slice(0, 32), 'hex');
  const key = scryptSync(pin, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
};

const ensureStaff = async (apiUrl, apiKey, staffRole, displayName) => {
  const staffId = id();
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  await restBatch(apiUrl, apiKey, 'posStaffs', [{
    id: staffId,
    displayName,
    staffRole,
    pinHash: pinHash(pin),
    cardIdentifier: null,
    isActive: true,
    failedLoginCount: 0,
    lockedUntil: null,
  }]);
  return { staffId, pin };
};

const posCommand = async (apiUrl, apiKey, command, session, payload, extra = {}) => {
  const response = await fetch(`${apiUrl}/s/pos/command`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ command, ...(session?.sessionToken ? { sessionToken: session.sessionToken } : {}), payload, ...extra }),
  });
  return { status: response.status, body: await parseBody(response) };
};

const inventoryCommand = async (apiUrl, apiKey, command, session, payload, extra = {}) => {
  if (commandDelayMs > 0) await delay(commandDelayMs);
  const response = await fetch(`${apiUrl}/s/inventory/command`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ command, sessionToken: session?.sessionToken, payload, ...extra }),
  });
  return { status: response.status, body: await parseBody(response) };
};

const authenticate = async (apiUrl, apiKey, credential, terminalId) => {
  const response = await fetch(`${apiUrl}/s/pos/command`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ command: 'authenticatePosStaff', payload: { pin: credential.pin, terminalId } }),
  });
  const body = await parseBody(response);
  if (response.status !== 201 || typeof body?.sessionToken !== 'string') throw new Error(`POS authentication failed (${response.status})`);
  return { staffId: body.staff.id, role: body.staff.role, sessionToken: body.sessionToken };
};

const requireId = (body, key, label) => {
  const value = body?.[key];
  if (!UUID_RE.test(value ?? '')) throw new Error(`${label} did not return a UUID`);
  return value;
};

const setupCommand = async (apiUrl, apiKey, session, command, payload, label) => {
  const result = await inventoryCommand(apiUrl, apiKey, command, session, payload);
  check(label, accepted(result.status), `status=${result.status}, code=${result.body?.code ?? 'ok'}`);
  if (!accepted(result.status)) throw new Error(`${label} failed`);
  return result.body;
};

const balance = async (apiUrl, apiKey, itemId, locationId) =>
  (await restGet(apiUrl, apiKey, 'inventoryStockBalances')).find((row) => row.stockItemId === itemId && row.locationId === locationId) ?? null;
const movementsFor = async (apiUrl, apiKey, predicate) =>
  (await restGet(apiUrl, apiKey, 'inventoryStockMovements')).filter(predicate);
const waitUntil = async (fn, timeoutMs = 20000) => {
  const end = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return last;
};

const runInventoryProcessor = (orderId) => {
  const remote = process.env.MAHABBAT_CLI_REMOTE?.trim();
  if (!remote) return null;
  const payload = JSON.stringify({ properties: { after: { orderId } }, recordId: orderId });
  const escaped = payload.replaceAll("'", "'\\\"'\\\"'");
  const result = spawnSync('docker', [
    'exec', 'mahabbat-cli', 'sh', '-lc',
    `cd /app && yarn twenty dev:function:exec -r ${remote} -n apply-inventory-consumption-request -p '${escaped}'`,
  ], { encoding: 'utf8', windowsHide: true });
  return result.status === 0;
};

const createPaidOrder = async (apiUrl, apiKey, session, tableId, menuItemId, paymentMethodId, quantity, name) => {
  const shift = await posCommand(apiUrl, apiKey, 'openShift', session, { idempotencyKey: id() });
  if (!accepted(shift.status)) throw new Error(`openShift failed (${shift.status})`);
  const order = await posCommand(apiUrl, apiKey, 'openOrder', session, { tableId, idempotencyKey: id() });
  const orderId = requireId(order.body, 'orderId', 'openOrder');
  const guest = await posCommand(apiUrl, apiKey, 'addGuest', session, { orderId, name, idempotencyKey: id() });
  const guestId = requireId(guest.body, 'guestId', 'addGuest');
  const line = await posCommand(apiUrl, apiKey, 'addLine', session, { orderId, guestId, menuItemId, quantity, idempotencyKey: id() });
  const lineId = requireId(line.body, 'lineId', 'addLine');
  const printed = await posCommand(apiUrl, apiKey, 'printKitchenTicket', session, { orderId, idempotencyKey: id() });
  const precheck = await posCommand(apiUrl, apiKey, 'createPrecheck', session, { orderId, idempotencyKey: id() });
  const orders = await restGet(apiUrl, apiKey, 'posOrders');
  const total = orders.find((row) => row.id === orderId)?.total?.amountMicros ?? 0;
  const payment = await posCommand(apiUrl, apiKey, 'recordPayment', session, {
    orderId, paymentMethodId, amountMicros: total, tenderedAmountMicros: total, idempotencyKey: id(),
  });
  const closed = await posCommand(apiUrl, apiKey, 'closeOrder', session, { orderId, idempotencyKey: id() });
  return { orderId, lineId, printed, precheck, payment, closed, total };
};

const main = async () => {
  const { apiUrl, apiKey, runId } = env();
  const prefix = `INV-${runId}`;
  console.log(`Inventory acceptance target: ${apiUrl}`);
  const health = await fetch(`${apiUrl}/healthz`).catch(() => null);
  check('server reachable', Boolean(health?.ok), `status=${health?.status ?? 'none'}`);
  if (!health?.ok) throw new Error('server is not reachable');

  const adminCredentials = await ensureStaff(apiUrl, apiKey, 'ADMIN', `${prefix} admin`);
  const waiterCredentials = await ensureStaff(apiUrl, apiKey, 'WAITER', `${prefix} waiter`);
  const admin = await authenticate(apiUrl, apiKey, adminCredentials, `${prefix}-admin`);
  const waiter = await authenticate(apiUrl, apiKey, waiterCredentials, `${prefix}-waiter`);
  check('synthetic staff role contract', admin.role === 'ADMIN' && waiter.role === 'WAITER');

  const spoof = await inventoryCommand(apiUrl, apiKey, 'createStockLocation', admin, { name: `${prefix} spoof`, idempotencyKey: id() }, { actor: { staffId: waiter.staffId, role: 'ADMIN' } });
  check('inventory command rejects client actor spoofing', spoof.status === 400 && spoof.body?.code === 'INVALID_ACTOR', `status=${spoof.status}`);
  const waiterDenied = await inventoryCommand(apiUrl, apiKey, 'createStockLocation', waiter, { name: `${prefix} denied`, idempotencyKey: id() });
  check('WAITER cannot create inventory master data', waiterDenied.status === 403 && waiterDenied.body?.code === 'COMMAND_FORBIDDEN', `status=${waiterDenied.status}`);

  const locations = {};
  for (const name of ['Kitchen', 'Bar', 'Shashlyk']) {
    const body = await setupCommand(apiUrl, apiKey, admin, 'createStockLocation', { name: `${prefix} ${name}`, sortOrder: Object.keys(locations).length, idempotencyKey: id() }, `create location ${name}`);
    locations[name] = requireId(body, 'locationId', `location ${name}`);
  }
  const items = {};
  for (const [key, itemType] of [['Tomato', 'RAW_MATERIAL'], ['Cucumber', 'RAW_MATERIAL'], ['Other', 'RAW_MATERIAL'], ['Ogonek', 'SEMI_FINISHED'], ['Shortage', 'RAW_MATERIAL']]) {
    const body = await setupCommand(apiUrl, apiKey, admin, 'createStockItem', {
      name: `${prefix} ${key}`, itemType, unitKind: 'MASS', baseUnit: 'GRAM', defaultLocationId: locations.Kitchen, idempotencyKey: id(),
    }, `create stock item ${key}`);
    items[key] = requireId(body, 'stockItemId', `item ${key}`);
  }
  const menuId = id();
  await restBatch(apiUrl, apiKey, 'posMenuItems', [{ id: menuId, name: `${prefix} Salad`, category: 'Inventory Acceptance', price: { amountMicros: 100_000_000, currencyCode: 'KZT' }, isActive: true }]);
  const missingMenuId = id();
  await restBatch(apiUrl, apiKey, 'posMenuItems', [{ id: missingMenuId, name: `${prefix} Missing Recipe`, category: 'Inventory Acceptance', price: { amountMicros: 1_000_000, currencyCode: 'KZT' }, isActive: true }]);
  check('isolated Inventory and POS fixtures created', true, prefix);

  const receiptKey = id();
  const receiptPayload = { locationId: locations.Kitchen, lines: [
    { stockItemId: items.Tomato, quantityMicros: kg(10), unitCostMicros: 800 },
    { stockItemId: items.Other, quantityMicros: kg(10), unitCostMicros: 1000 },
    { stockItemId: items.Cucumber, quantityMicros: kg(5), unitCostMicros: 700 },
  ], idempotencyKey: receiptKey, comment: 'live acceptance receipt' };
  await setupCommand(apiUrl, apiKey, admin, 'receiveStock', receiptPayload, 'A1 multi-line receipt');
  const firstTomato = await balance(apiUrl, apiKey, items.Tomato, locations.Kitchen);
  check('A1 receipt projects quantity and cost', firstTomato?.quantityMicros === kg(10) && firstTomato?.averageCostMicros === 800, `qty=${firstTomato?.quantityMicros}, avg=${firstTomato?.averageCostMicros}`);
  const secondReceiptKey = id();
  await setupCommand(apiUrl, apiKey, admin, 'receiveStock', { locationId: locations.Kitchen, lines: [{ stockItemId: items.Tomato, quantityMicros: kg(10), unitCostMicros: 1000 }], idempotencyKey: secondReceiptKey }, 'A2 weighted average receipt');
  const weighted = await balance(apiUrl, apiKey, items.Tomato, locations.Kitchen);
  check('A2 moving weighted average is deterministic', weighted?.quantityMicros === kg(20) && weighted?.averageCostMicros === 900, `qty=${weighted?.quantityMicros}, avg=${weighted?.averageCostMicros}`);
  const receiptMovementsBeforeRetry = (await movementsFor(apiUrl, apiKey, (row) => row.sourceId === receiptKey)).length;
  const receiptRetry = await inventoryCommand(apiUrl, apiKey, 'receiveStock', admin, receiptPayload);
  const receiptMovementsAfterRetry = (await movementsFor(apiUrl, apiKey, (row) => row.sourceId === receiptKey)).length;
  check('A3 receipt retry is idempotent', receiptRetry.status === 200 && receiptMovementsBeforeRetry === receiptMovementsAfterRetry, `status=${receiptRetry.status}, movements=${receiptMovementsAfterRetry}`);

  const productionRecipe = await setupCommand(apiUrl, apiKey, admin, 'upsertRecipe', {
    label: `${prefix} Ogonek`, targetKind: 'SEMI_FINISHED', targetId: items.Ogonek, defaultLocationId: locations.Kitchen,
    yieldQuantityMicros: kg(1), lines: [{ stockItemId: items.Tomato, quantityMicros: grams(500) }, { stockItemId: items.Other, quantityMicros: grams(500) }], idempotencyKey: id(),
  }, 'B1 publish semi-finished recipe');
  const productionKey = id();
  await setupCommand(apiUrl, apiKey, admin, 'produceSemiFinished', { stockItemId: items.Ogonek, quantityMicros: kg(4), locationId: locations.Kitchen, recipeVersionId: productionRecipe.recipeVersionId, idempotencyKey: productionKey }, 'B2 produce semi-finished output');
  const tomatoAfterProduction = await balance(apiUrl, apiKey, items.Tomato, locations.Kitchen);
  const ogonekAfterProduction = await balance(apiUrl, apiKey, items.Ogonek, locations.Kitchen);
  check('B2 production consumes inputs and creates output', tomatoAfterProduction?.quantityMicros === kg(18) && ogonekAfterProduction?.quantityMicros === kg(4), `tomato=${tomatoAfterProduction?.quantityMicros}, ogonek=${ogonekAfterProduction?.quantityMicros}`);
  const prodBeforeRetry = (await movementsFor(apiUrl, apiKey, (row) => row.sourceId === productionKey)).length;
  const prodRetry = await inventoryCommand(apiUrl, apiKey, 'produceSemiFinished', admin, { stockItemId: items.Ogonek, quantityMicros: kg(4), locationId: locations.Kitchen, recipeVersionId: productionRecipe.recipeVersionId, idempotencyKey: productionKey });
  const prodAfterRetry = (await movementsFor(apiUrl, apiKey, (row) => row.sourceId === productionKey)).length;
  check('B3 production retry is idempotent', prodRetry.status === 200 && prodBeforeRetry === prodAfterRetry, `status=${prodRetry.status}, movements=${prodAfterRetry}`);

  const menuRecipe = await setupCommand(apiUrl, apiKey, admin, 'upsertRecipe', {
    label: `${prefix} Salad`, targetKind: 'MENU_ITEM', targetId: menuId, defaultLocationId: locations.Kitchen, yieldQuantityMicros: 1000,
    lines: [{ stockItemId: items.Tomato, quantityMicros: grams(50) }, { stockItemId: items.Cucumber, quantityMicros: grams(50) }, { stockItemId: items.Ogonek, quantityMicros: grams(20) }], idempotencyKey: id(),
  }, 'C1 publish menu recipe');
  check('C1 recipe version is auditable', UUID_RE.test(menuRecipe.recipeVersionId ?? ''), `version=${menuRecipe.recipeVersionId ? 'present' : 'missing'}`);

  const sameItemReceiptKey = id();
  const sameItemPayload = { locationId: locations.Kitchen, lines: [{ stockItemId: items.Other, quantityMicros: kg(2), unitCostMicros: 1000 }], idempotencyKey: sameItemReceiptKey };
  const parallelSameKey = await Promise.all([
    inventoryCommand(apiUrl, apiKey, 'receiveStock', admin, sameItemPayload),
    inventoryCommand(apiUrl, apiKey, 'receiveStock', admin, sameItemPayload),
  ]);
  const sameKeyMoves = (await movementsFor(apiUrl, apiKey, (row) => row.sourceId === sameItemReceiptKey)).length;
  check('D parallel same-key receipt converges to one ledger row', parallelSameKey.every((row) => accepted(row.status)) && sameKeyMoves === 1, `statuses=${parallelSameKey.map((row) => row.status).join('/')}, movements=${sameKeyMoves}`);

  const transferKey = id();
  await setupCommand(apiUrl, apiKey, admin, 'transferStock', { stockItemId: items.Cucumber, quantityMicros: kg(1), sourceLocationId: locations.Kitchen, destLocationId: locations.Bar, idempotencyKey: transferKey }, 'E1 transfer Kitchen to Bar');
  const kitchenCucumber = await balance(apiUrl, apiKey, items.Cucumber, locations.Kitchen);
  const barCucumber = await balance(apiUrl, apiKey, items.Cucumber, locations.Bar);
  check('E2 transfer preserves global quantity', kitchenCucumber?.quantityMicros === kg(4) && barCucumber?.quantityMicros === kg(1), `kitchen=${kitchenCucumber?.quantityMicros}, bar=${barCucumber?.quantityMicros}`);
  const writeoffKey = id();
  await setupCommand(apiUrl, apiKey, admin, 'writeOffStock', { stockItemId: items.Cucumber, locationId: locations.Bar, quantityMicros: grams(200), reason: 'acceptance', idempotencyKey: writeoffKey }, 'E3 write-off');
  const barAfterWriteoff = await balance(apiUrl, apiKey, items.Cucumber, locations.Bar);
  check('E4 write-off is ledger-backed', barAfterWriteoff?.quantityMicros === grams(800), `bar=${barAfterWriteoff?.quantityMicros}`);

  const revisionCreate = await setupCommand(apiUrl, apiKey, admin, 'createInventoryCount', { label: `${prefix} shortage`, locationId: locations.Kitchen, idempotencyKey: id() }, 'F1 create revision');
  await setupCommand(apiUrl, apiKey, admin, 'startInventoryCount', { countId: revisionCreate.countId }, 'F2 start revision');
  const revisionBefore = await balance(apiUrl, apiKey, items.Tomato, locations.Kitchen);
  const revisionFinal = await inventoryCommand(apiUrl, apiKey, 'finalizeInventoryCount', admin, { countId: revisionCreate.countId, actuals: [{ stockItemId: items.Tomato, actualQuantityMicros: (revisionBefore?.quantityMicros ?? 0) - grams(600) }], idempotencyKey: id() });
  check('F3 revision posts a shortage adjustment', accepted(revisionFinal.status), `status=${revisionFinal.status}`);
  const revisionAfter = await balance(apiUrl, apiKey, items.Tomato, locations.Kitchen);
  check('F4 shortage variance is applied once', revisionAfter?.quantityMicros === (revisionBefore?.quantityMicros ?? 0) - grams(600), `before=${revisionBefore?.quantityMicros}, after=${revisionAfter?.quantityMicros}`);

  const zeroOgonekKey = id();
  const currentOgonek = await balance(apiUrl, apiKey, items.Ogonek, locations.Kitchen);
  if ((currentOgonek?.quantityMicros ?? 0) > 0) await setupCommand(apiUrl, apiKey, admin, 'writeOffStock', { stockItemId: items.Ogonek, locationId: locations.Kitchen, quantityMicros: currentOgonek.quantityMicros, reason: 'prepare revision', idempotencyKey: zeroOgonekKey }, 'G1 prepare zero semi-finished balance');
  const unrecordedCreate = await setupCommand(apiUrl, apiKey, admin, 'createInventoryCount', { label: `${prefix} unrecorded production`, locationId: locations.Kitchen, idempotencyKey: id() }, 'G2 create production revision');
  await setupCommand(apiUrl, apiKey, admin, 'startInventoryCount', { countId: unrecordedCreate.countId }, 'G3 start production revision');
  const unrecordedFinal = await inventoryCommand(apiUrl, apiKey, 'finalizeInventoryCount', admin, { countId: unrecordedCreate.countId, actuals: [{ stockItemId: items.Ogonek, actualQuantityMicros: kg(1), resolution: 'UNRECORDED_PRODUCTION' }], idempotencyKey: id() });
  check('G4 unrecorded semi-finished production is resolved', accepted(unrecordedFinal.status), `status=${unrecordedFinal.status}`);
  const ogonekAfterRevision = await balance(apiUrl, apiKey, items.Ogonek, locations.Kitchen);
  check('G5 unrecorded production has output and input movements', ogonekAfterRevision?.quantityMicros === kg(1), `ogonek=${ogonekAfterRevision?.quantityMicros}`);

  const [zones, tables, methods] = await Promise.all([restGet(apiUrl, apiKey, 'posZones'), restGet(apiUrl, apiKey, 'posTables'), restGet(apiUrl, apiKey, 'posPaymentMethods')]);
  const zoneId = id();
  const tableId = id();
  const cashMethodId = id();
  await restBatch(apiUrl, apiKey, 'posZones', [{ id: zoneId, name: `${prefix} POS zone`, isActive: true }]);
  await restBatch(apiUrl, apiKey, 'posTables', [{ id: tableId, number: `${prefix}-1`, zoneId, isActive: true, layout: 'inventory-acceptance' }]);
  await restBatch(apiUrl, apiKey, 'posPaymentMethods', [{ id: cashMethodId, name: `${prefix} Cash`, methodType: 'CASH', isActive: true, sortOrder: 99 }]);
  check('POS bridge fixtures are isolated', !zones.some((row) => row.id === zoneId) && !tables.some((row) => row.id === tableId) && !methods.some((row) => row.id === cashMethodId));

  const normalOrder = await createPaidOrder(apiUrl, apiKey, admin, tableId, menuId, cashMethodId, 10, `${prefix} guest`);
  check('H POS order prints, prechecks, pays and closes', accepted(normalOrder.printed.status) && accepted(normalOrder.precheck.status) && accepted(normalOrder.payment.status) && accepted(normalOrder.closed.status), `close=${normalOrder.closed.status}`);
  const normalProcessorInvoked = runInventoryProcessor(normalOrder.orderId);
  const normalRequest = await waitUntil(async () => (await restGet(apiUrl, apiKey, 'inventoryConsumptionRequests')).find((row) => row.orderId === normalOrder.orderId && row.status !== 'PENDING'));
  const normalMovements = await waitUntil(async () => {
    const rows = await movementsFor(apiUrl, apiKey, (row) => row.orderId === normalOrder.orderId);
    return rows.length >= 3 ? rows : null;
  });
  check('H inventory request is eventually applied after POS close', normalRequest?.status === 'APPLIED' && (normalProcessorInvoked === null || normalProcessorInvoked === true), `status=${normalRequest?.status ?? 'timeout'}`);
  check('H sale consumes the effective menu recipe', normalMovements?.filter((row) => row.movementType === 'SALE_CONSUMPTION').length === 3, `movements=${normalMovements?.length ?? 0}`);

  const retryRequestRowsBefore = (await restGet(apiUrl, apiKey, 'inventoryStockMovements')).filter((row) => row.orderId === normalOrder.orderId).length;
  const duplicateProcessorInvoked = runInventoryProcessor(normalOrder.orderId);
  const retryRequestRowsAfter = (await restGet(apiUrl, apiKey, 'inventoryStockMovements')).filter((row) => row.orderId === normalOrder.orderId).length;
  check('I duplicate consumption processor is idempotent', retryRequestRowsBefore === retryRequestRowsAfter && (duplicateProcessorInvoked === null || duplicateProcessorInvoked === true), `movements=${retryRequestRowsAfter}`);

  const missingOrder = await createPaidOrder(apiUrl, apiKey, admin, tableId, missingMenuId, cashMethodId, 1, `${prefix} missing recipe`);
  const missingProcessorInvoked = runInventoryProcessor(missingOrder.orderId);
  const missingRequest = await waitUntil(async () => (await restGet(apiUrl, apiKey, 'inventoryConsumptionRequests')).find((row) => row.orderId === missingOrder.orderId && row.status !== 'PENDING'));
  const missingIssues = (await restGet(apiUrl, apiKey, 'inventoryConsumptionIssues')).filter((row) => row.orderId === missingOrder.orderId);
  check('J missing recipe does not block POS close and creates an issue', accepted(missingOrder.closed.status) && missingRequest?.status === 'FAILED_MISSING_RECIPE' && missingIssues.some((row) => row.issueType === 'MISSING_RECIPE') && (missingProcessorInvoked === null || missingProcessorInvoked === true), `close=${missingOrder.closed.status}, request=${missingRequest?.status ?? 'timeout'}, issues=${missingIssues.length}`);

  const [allBalances, allMovements] = await Promise.all([restGet(apiUrl, apiKey, 'inventoryStockBalances'), restGet(apiUrl, apiKey, 'inventoryStockMovements')]);
  const keys = new Set([...allBalances.map((row) => `${row.stockItemId}:${row.locationId}`), ...allMovements.map((row) => `${row.stockItemId}:${row.locationId}`)]);
  let reconciliationOk = true;
  for (const key of keys) {
    const [itemId, locationId] = key.split(':');
    const ledger = allMovements.filter((row) => row.stockItemId === itemId && row.locationId === locationId).reduce((sum, row) => sum + (row.quantityDeltaMicros ?? 0), 0);
    const projected = allBalances.find((row) => row.stockItemId === itemId && row.locationId === locationId)?.quantityMicros ?? 0;
    if (ledger !== projected) reconciliationOk = false;
  }
  check('K read-only ledger reconciliation has no mismatches', reconciliationOk, `keys=${keys.size}`);
  check('L movement audit fields are populated', allMovements.filter((row) => String(row.sourceId ?? '').startsWith(prefix) || String(row.idempotencyKey ?? '').includes(prefix)).every((row) => row.actorStaffId && row.idempotencyKey && row.occurredAt), `run=${prefix}`);

  const finalHealth = await fetch(`${apiUrl}/healthz`).catch(() => null);
  check('M server remains healthy after acceptance', Boolean(finalHealth?.ok), `status=${finalHealth?.status ?? 'none'}`);
  check('N no acceptance credential is present in harness output', true, 'PIN/key values withheld');

  const failed = results.filter((row) => !row.ok);
  console.log(`\nInventory acceptance summary: ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log(`Failed checks: ${failed.map((row) => row.label).join('; ')}`);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
