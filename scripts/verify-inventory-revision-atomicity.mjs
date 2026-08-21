/**
 * Live revision atomicity smoke for an isolated local pilot workspace.
 *
 * It deliberately tests the external-movement failure boundary rather than
 * relying only on reconciliation: a stale finalize must create no movement,
 * leave the balance unchanged, and keep the count retryable. The second
 * count proves the same runtime can still post a successful adjustment.
 *
 * Required environment:
 *   MAHABBAT_API_URL=http://localhost:2020
 *   MAHABBAT_API_KEY=<local workspace key>
 *
 * Keys and generated PINs are process-local and never printed.
 */
import { randomUUID, scryptSync } from 'node:crypto';

const apiUrl = process.env.MAHABBAT_API_URL?.trim()?.replace(/\/+$/, '');
const apiKey = process.env.MAHABBAT_API_KEY?.trim();
if (!apiUrl || !apiKey) throw new Error('MAHABBAT_API_URL and MAHABBAT_API_KEY must be set');

const id = () => randomUUID();
const kg = (value) => Math.round(value * 1_000_000);
const headers = { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
const parseBody = async (response) => {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
};
const request = async (path, options = {}) => {
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });
  return { status: response.status, body: await parseBody(response) };
};
const command = (path, name, sessionToken, payload) => request(path, {
  method: 'POST',
  body: JSON.stringify({ command: name, ...(sessionToken ? { sessionToken } : {}), payload }),
});
const restBatch = (plural, rows) => request(`/rest/batch/${plural}`, { method: 'POST', body: JSON.stringify(rows) });
const restRows = async (plural) => {
  const rows = [];
  let cursor = null;
  do {
    const query = new URLSearchParams({ limit: '200' });
    if (cursor) query.set('starting_after', cursor);
    const result = await request(`/rest/${plural}?${query.toString()}`);
    if (result.status !== 200) throw new Error(`GET ${plural} failed (${result.status})`);
    rows.push(...(result.body?.data?.[plural] ?? []));
    cursor = result.body?.pageInfo?.hasNextPage ? result.body.pageInfo.endCursor : null;
  } while (cursor);
  return rows;
};
const requireOk = (label, result, statuses = [200, 201]) => {
  if (!statuses.includes(result.status)) throw new Error(`${label} failed (${result.status}, ${result.body?.code ?? 'unknown'})`);
  return result.body;
};
const pinHash = (pin) => {
  const salt = Buffer.from(id().replaceAll('-', '').slice(0, 32), 'hex');
  const key = scryptSync(pin, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
};

const run = async () => {
  const suffix = `ATOMIC-${Date.now()}-${id().slice(0, 8)}`;
  const locationId = id();
  const itemId = id();
  const staffId = id();
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  requireOk('create staff', await restBatch('posStaffs', [{
    id: staffId, displayName: `Atomic smoke ${suffix}`, staffRole: 'ADMIN', pinHash: pinHash(pin),
    cardIdentifier: null, isActive: true, failedLoginCount: 0, lockedUntil: null,
  }]));
  requireOk('create location', await restBatch('inventoryStockLocations', [{
    id: locationId, name: `Atomic Kitchen ${suffix}`, isActive: true,
  }]));
  requireOk('create item', await restBatch('inventoryStockItems', [{
    id: itemId, name: `Atomic Cucumber ${suffix}`, itemType: 'RAW_MATERIAL', unitKind: 'MASS', baseUnit: 'GRAM', isActive: true,
  }]));

  const authenticated = requireOk('authenticate', await command('/s/pos/command', 'authenticatePosStaff', null, { pin, terminalId: `atomic-${suffix}` }), [201]);
  const sessionToken = authenticated.sessionToken;
  const receive = (key, quantity) => command('/s/inventory/command', 'receiveStock', sessionToken, {
    locationId, lines: [{ stockItemId: itemId, quantityMicros: quantity, unitCostMicros: 900 }], idempotencyKey: key,
  });
  const createCount = (key) => command('/s/inventory/command', 'createInventoryCount', sessionToken, { locationId, label: `Atomic ${suffix}`, idempotencyKey: key });
  const startCount = (countId) => command('/s/inventory/command', 'startInventoryCount', sessionToken, { countId });
  const finalize = (countId, key, actualQuantityMicros) => command('/s/inventory/command', 'finalizeInventoryCount', sessionToken, {
    countId, actuals: [{ stockItemId: itemId, actualQuantityMicros }], idempotencyKey: key,
  });
  const revisionMovements = async () => (await restRows('inventoryStockMovements')).filter((row) => row.locationId === locationId && row.stockItemId === itemId && row.sourceType === 'REVISION');
  const balance = async () => (await restRows('inventoryStockBalances')).find((row) => row.stockItemId === itemId && row.locationId === locationId);

  requireOk('initial receipt', await receive(`atomic-receipt-${suffix}`, kg(5)));
  const firstCount = requireOk('create first count', await createCount(`atomic-count-${suffix}`));
  const firstCountId = firstCount.countId;
  requireOk('start first count', await startCount(firstCountId));
  requireOk('external receipt after snapshot', await receive(`atomic-external-${suffix}`, kg(1)));
  const beforeFailedFinalize = await balance();
  const failedKey = `atomic-stale-${suffix}`;
  const failed = await finalize(firstCountId, failedKey, kg(5));
  const afterFailedFinalize = await balance();
  const staleMovements = await revisionMovements();
  const firstCountAfter = (await restRows('inventoryCounts')).find((row) => row.id === firstCountId);
  if (failed.status !== 400 || failed.body?.code !== 'REVISION_STALE') throw new Error(`stale finalize expected REVISION_STALE, got ${failed.status}/${failed.body?.code ?? 'unknown'}`);
  if (staleMovements.length !== 0) throw new Error(`stale finalize wrote ${staleMovements.length} movement(s)`);
  if (Number(afterFailedFinalize?.quantityMicros) !== Number(beforeFailedFinalize?.quantityMicros)) throw new Error('stale finalize changed the balance');
  if (firstCountAfter?.status !== 'ACTIVE') throw new Error(`stale finalize changed count state to ${firstCountAfter?.status ?? 'missing'}`);
  console.log(`PASS stale finalize: status=400 code=REVISION_STALE movements=0 balanceUnchanged=true count=${firstCountAfter.status}`);

  const secondCount = requireOk('create retry count', await createCount(`atomic-retry-count-${suffix}`));
  const secondCountId = secondCount.countId;
  requireOk('start retry count', await startCount(secondCountId));
  const successKey = `atomic-success-${suffix}`;
  const successResponse = await finalize(secondCountId, successKey, kg(7));
  requireOk('successful finalize', successResponse);
  const successMovements = await revisionMovements();
  const afterSuccess = await balance();
  const secondCountAfter = (await restRows('inventoryCounts')).find((row) => row.id === secondCountId);
  if (successMovements.length !== 1 || successResponse.status !== 201 || secondCountAfter?.status !== 'POSTED' || Number(afterSuccess?.quantityMicros) !== kg(7)) {
    const itemRows = (await restRows('inventoryStockMovements')).filter((row) => row.locationId === locationId && row.stockItemId === itemId).map((row) => ({ movementType: row.movementType, sourceType: row.sourceType, sourceId: row.sourceId, quantityDeltaMicros: row.quantityDeltaMicros }));
    throw new Error(`successful finalize invariant failed: status=${successResponse.status} movements=${successMovements.length} count=${secondCountAfter?.status ?? 'missing'} quantity=${afterSuccess?.quantityMicros ?? 'missing'} rows=${JSON.stringify(itemRows)}`);
  }
  console.log(`PASS successful finalize: status=201 movements=1 count=POSTED quantity=${afterSuccess.quantityMicros}`);
};

run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
