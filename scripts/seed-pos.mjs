/**
 * Mahabbat POS seed for a Twenty App v2.29.0 workspace.
 *
 * Populates deterministic POS master data for the foundation slice 1:
 *   PosZone -> PosTable
 *   PosMenuItem
 *
 * Requires explicit MAHABBAT_API_URL + MAHABBAT_API_KEY. Never prints or stores
 * credentials. Re-runnable and idempotent: fixed deterministic UUID v4 record
 * ids, existing records are skipped, nothing is deleted.
 *
 * Usage:
 *   MAHABBAT_API_URL=http://localhost:2020 MAHABBAT_API_KEY=<key> node scripts/seed-pos.mjs
 *   MAHABBAT_API_URL=... MAHABBAT_API_KEY=... node scripts/seed-pos.mjs --dry-run
 */
import { createHash, randomBytes, scryptSync } from 'node:crypto';

const MICROS_PER_TENGE = 1_000_000;
const CURRENCY = 'KZT';

function idFor(namespace, index) {
  const d = createHash('sha256').update(`${namespace}:${index}`).digest('hex');
  const variant = ['8', '9', 'a', 'b'][Number.parseInt(d[16], 16) % 4];
  return `${d.slice(0, 8)}-${d.slice(8, 12)}-4${d.slice(13, 16)}-${variant}${d.slice(17, 20)}-${d.slice(20, 32)}`;
}

const money = (tenge) => ({
  amountMicros: tenge * MICROS_PER_TENGE,
  currencyCode: CURRENCY,
});

const ZONES = ['Основной зал', 'Зал у окна', 'Терраса', 'VIP', 'POS Acceptance'];


const zones = ZONES.map((name, i) => ({
  id: idFor('posZone', i),
  name,
  isActive: true,
}));

const TABLES = [
  ['T1', 0], ['T2', 0], ['T3', 0], ['T4', 0],
  ['T5', 1], ['T6', 1], ['T7', 1],
  ['T8', 2], ['T9', 2], ['T10', 2],
  ['T11', 3], ['T12', 3],
  ['POS-A1', 4], ['POS-A2', 4], ['POS-A3', 4],
];

const tables = TABLES.map(([number, zoneIndex], i) => ({
  id: idFor('posTable', i),
  number,
  zoneId: zones[zoneIndex].id,
  isActive: true,
  ...(zoneIndex === 4 ? { layout: 'acceptance-only' } : {}),
}));

const MENU = [
  ['Манты', 'Горячее', 3800],
  ['Плов', 'Горячее', 3500],
  ['Бешбармак', 'Горячее', 5500],
  ['Лагман', 'Горячее', 3200],
  ['Шашлык из баранины', 'Гриль', 4800],
  ['Люля-кебаб', 'Гриль', 4300],
  ['Салат «Цезарь»', 'Салаты', 2900],
  ['Салат «Алматы»', 'Салаты', 2600],
  ['Суп «Сорпа»', 'Супы', 2400],
  ['Кеспе', 'Супы', 2200],
  ['Баурсаки', 'Выпечка', 1200],
  ['Самса с мясом', 'Выпечка', 1400],
  ['Медовик', 'Десерты', 1700],
  ['Айран', 'Напитки', 600],
  ['Зелёный чай', 'Напитки', 700],
  ['Кофе американо', 'Напитки', 1300],
  ['Морс', 'Напитки', 900],
];

const menuItems = MENU.map(([name, category, price], i) => ({
  id: idFor('posMenuItem', i),
  name,
  category,
  price: money(price),
  isActive: true,
}));

const paymentMethods = [
  {
    id: idFor('posPaymentMethod', 0),
    name: 'Наличные',
    methodType: 'CASH',
    isActive: true,
    sortOrder: 0,
  },
  {
    id: idFor('posPaymentMethod', 1),
    name: 'Карта',
    methodType: 'CARD',
    isActive: true,
    sortOrder: 1,
  },
];

const normalizeSeedPin = (value) => {
  const pin = value?.trim();
  if (!pin) return null;
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('MAHABBAT_POS_SEED_*_PIN must contain 4 to 8 digits');
  }
  return pin;
};

const pinHash = (pin) => {
  const salt = randomBytes(16);
  const key = scryptSync(pin, salt, 32, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
};

const waiterPin = normalizeSeedPin(process.env.MAHABBAT_POS_SEED_WAITER_PIN);
const adminPin = normalizeSeedPin(process.env.MAHABBAT_POS_SEED_ADMIN_PIN);
const posStaffs = [
  waiterPin
    ? {
        id: idFor('posStaff', 0),
        displayName: 'Демо официант',
        staffRole: 'WAITER',
        pinHash: pinHash(waiterPin),
        cardIdentifier: null,
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null,
      }
    : null,
  adminPin
    ? {
        id: idFor('posStaff', 1),
        displayName: 'Демо администратор',
        staffRole: 'ADMIN',
        pinHash: pinHash(adminPin),
        cardIdentifier: null,
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null,
      }
    : null,
].filter(Boolean);

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function validate() {
  const errors = [];
  const allIds = new Set();
  const zoneIds = new Set();
  const tableNumbers = new Set();

  const checkId = (id, label) => {
    if (!UUID_V4_RE.test(id)) errors.push(`${label}: id ${id} is not a valid UUID v4`);
    if (allIds.has(id)) errors.push(`${label}: duplicate id ${id}`);
    allIds.add(id);
  };

  zones.forEach((zone, i) => {
    checkId(zone.id, `zones[${i}]`);
    if (!zone.name || zone.name.trim().length === 0) errors.push(`zones[${i}]: name must be set`);
    zoneIds.add(zone.id);
  });

  tables.forEach((table, i) => {
    checkId(table.id, `tables[${i}]`);
    if (!table.number || tableNumbers.has(table.number)) errors.push(`tables[${i}]: duplicate or empty number`);
    tableNumbers.add(table.number);
    if (!zoneIds.has(table.zoneId)) errors.push(`tables[${i}]: bad zoneId`);
    if (table.isActive !== true) errors.push(`tables[${i}]: isActive must be true`);
  });

  menuItems.forEach((item, i) => {
    checkId(item.id, `menuItems[${i}]`);
    if (!item.name || item.name.trim().length === 0) errors.push(`menuItems[${i}]: name must be set`);
    if (!Number.isSafeInteger(item.price.amountMicros) || item.price.amountMicros <= 0) {
      errors.push(`menuItems[${i}]: price must be positive integer micros`);
    }
    if (item.price.currencyCode !== CURRENCY) errors.push(`menuItems[${i}]: bad currencyCode`);
    if (item.isActive !== true) errors.push(`menuItems[${i}]: isActive must be true`);
  });

  paymentMethods.forEach((method, i) => {
    checkId(method.id, `paymentMethods[${i}]`);
    if (!method.name || !['CASH', 'CARD', 'OTHER'].includes(method.methodType)) {
      errors.push(`paymentMethods[${i}]: name and methodType must be valid`);
    }
    if (method.isActive !== true || !Number.isSafeInteger(method.sortOrder)) {
      errors.push(`paymentMethods[${i}]: active integer sortOrder required`);
    }
  });

  posStaffs.forEach((staff, i) => {
    checkId(staff.id, `posStaffs[${i}]`);
    if (!staff.displayName || !staff.pinHash) {
      errors.push(`posStaffs[${i}]: displayName and pinHash must be set`);
    }
    if (!['WAITER', 'ADMIN'].includes(staff.staffRole)) {
      errors.push(`posStaffs[${i}]: role must be WAITER or ADMIN`);
    }
  });

  return errors;
}

function getEnv() {
  const apiUrl = process.env.MAHABBAT_API_URL?.trim();
  const apiKey = process.env.MAHABBAT_API_KEY?.trim();
  if (!apiUrl || !apiKey) {
    throw new Error('MAHABBAT_API_URL and MAHABBAT_API_KEY must be set (e.g. MAHABBAT_API_URL=http://localhost:2020 MAHABBAT_API_KEY=<key> node scripts/seed-pos.mjs)');
  }
  return { apiUrl: apiUrl.replace(/\/+$/, ''), apiKey };
}

async function sync(apiUrl, apiKey, label, plural, items, options = {}) {
  const { reconcile = false } = options;
  const existing = new Map();
  let cursor = null;
  let previousCursor = null;
  do {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('starting_after', cursor);
    const res = await fetch(`${apiUrl}/rest/${plural}?${query}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`GET /rest/${plural} -> ${res.status}`);
    const payload = await res.json();
    for (const record of payload.data?.[plural] ?? []) {
      existing.set(record.id, record);
    }
    cursor = payload.pageInfo?.hasNextPage ? payload.pageInfo.endCursor : null;
    if (cursor && cursor === previousCursor) {
      throw new Error(`GET /rest/${plural} returned a non-advancing cursor`);
    }
    previousCursor = cursor;
  } while (cursor);

  const missing = items.filter((item) => !existing.has(item.id));
  let reconciled = 0;
  if (reconcile) {
    for (const item of items) {
      const current = existing.get(item.id);
      if (!current) continue;
      const patch = Object.fromEntries(
        Object.entries(item).filter(
          ([field, value]) => field !== 'id' && JSON.stringify(current[field]) !== JSON.stringify(value),
        ),
      );
      if (Object.keys(patch).length === 0) continue;
      const res = await fetch(`${apiUrl}/rest/${plural}/${item.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        throw new Error(`PATCH /rest/${plural}/${item.id} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      reconciled += 1;
    }
  }
  let created = 0;
  for (let offset = 0; offset < missing.length; offset += 60) {
    const batch = missing.slice(offset, offset + 60);
    const res = await fetch(`${apiUrl}/rest/batch/${plural}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`POST /rest/${plural} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
    created += batch.length;
  }
  const reconciliation = reconciled > 0 ? `, ${reconciled} reconciled` : '';
  console.log(`  ${label}: ${existing.size} existing (skipped)${reconciliation}, ${created} created`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { apiUrl } = dryRun ? { apiUrl: '(dry run)' } : getEnv();
  const errors = validate();
  if (errors.length) {
    console.error(`POS seed dataset validation failed (${errors.length} errors):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exitCode = 1;
    return;
  }

  console.log('REST assumptions (verified against Twenty v2.29.0 source):');
  console.log('  endpoints: /rest/posZones, /rest/posTables, /rest/posMenuItems, /rest/posPaymentMethods, /rest/posStaffs');
  console.log('  relations via join columns: zoneId');
  console.log('  money: { amountMicros, currencyCode: "KZT" } (integer, no floats)');
  console.log('  idempotent: fixed UUID v4 ids, existing records skipped, nothing deleted');
  console.log('');
  console.log('POS seed plan:');
  console.log(`  ${zones.length} zones, ${tables.length} tables, ${menuItems.length} menu items, ${paymentMethods.length} payment methods, ${posStaffs.length} POS staff records`);
  if (posStaffs.length === 0) {
    console.log('  POS staff skipped: set MAHABBAT_POS_SEED_WAITER_PIN and/or MAHABBAT_POS_SEED_ADMIN_PIN privately to provision login identities');
  }
  console.log(`  target: ${apiUrl}`);

  if (dryRun) {
    console.log('Dry run: dataset is valid, no records were sent.');
    return;
  }

  const health = await fetch(`${apiUrl}/healthz`).catch(() => null);
  if (!health?.ok) throw new Error(`Twenty server is not reachable at ${apiUrl}/healthz`);

  console.log('');
  await sync(apiUrl, getEnv().apiKey, 'PosZone', 'posZones', zones);
  await sync(apiUrl, getEnv().apiKey, 'PosTable', 'posTables', tables);
  await sync(apiUrl, getEnv().apiKey, 'PosMenuItem', 'posMenuItems', menuItems);
  await sync(apiUrl, getEnv().apiKey, 'PaymentMethod', 'posPaymentMethods', paymentMethods);
  if (posStaffs.length > 0) {
    await sync(apiUrl, getEnv().apiKey, 'PosStaff', 'posStaffs', posStaffs, { reconcile: true });
  }
  console.log('');
  console.log('POS seed complete.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
