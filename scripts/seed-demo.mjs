/**
 * Mahabbat demo seed for a Twenty App v2.29.0 workspace.
 *
 * Populates deterministic demo data for the foundation schema:
 *   Person (customer) -> Order -> OrderItem
 *   Person -> Reservation
 *   Person -> LoyaltyLedgerEntry (-> Order)
 *
 * Requires explicit MAHABBAT_API_URL + MAHABBAT_API_KEY. Never prints or stores
 * credentials. Re-runnable and idempotent: fixed deterministic UUID v4 record
 * ids, existing records are skipped, and only the server-controlled identity
 * key is reconciled when a workspace already contains an older demo record.
 *
 * Usage:
 *   MAHABBAT_API_URL=http://localhost:2020 MAHABBAT_API_KEY=<key> yarn seed:demo
 *   MAHABBAT_API_URL=... MAHABBAT_API_KEY=... yarn seed:demo:dry
 *
 * REST endpoints use schema namePlural (verified in Twenty v2.29.0 source):
 *   /rest/people, /rest/orders, /rest/orderItems, /rest/reservations,
 *   /rest/loyaltyLedgerEntries
 */
import { createHash } from 'node:crypto';

const MICROS_PER_TENGE = 1_000_000;
const CURRENCY = 'KZT';

// Deterministic valid UUID v4 (version 4, variant 8/9/a/b) per record.
function idFor(namespace, index) {
  const d = createHash('sha256').update(`${namespace}:${index}`).digest('hex');
  const variant = ['8', '9', 'a', 'b'][Number.parseInt(d[16], 16) % 4];
  return `${d.slice(0, 8)}-${d.slice(8, 12)}-4${d.slice(13, 16)}-${variant}${d.slice(17, 20)}-${d.slice(20, 32)}`;
}

const daysAgo = (days, hour, minute) => {
  const d = new Date('2026-08-09T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
};
const daysAhead = (days, hour, minute) => {
  const d = new Date('2026-08-09T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
};

const money = (tenge) => ({
  amountMicros: tenge * MICROS_PER_TENGE,
  currencyCode: CURRENCY,
});

const PEOPLE_META = [
  ['Айдос', 'Кенесов'], ['Динара', 'Сулейменова'], ['Ерлан', 'Бекжанов'],
  ['Аружан', 'Нурланова'], ['Дамир', 'Ибраев'], ['Гульнара', 'Ахметова'],
  ['Нурлан', 'Сапаров'], ['Мадина', 'Оспанова'], ['Тимур', 'Жумабаев'],
  ['Камила', 'Саттарова'], ['Асет', 'Калиев'], ['Жанна', 'Мураткызы'],
  ['Бауыржан', 'Есимов'], ['Салтанат', 'Тлеубаева'], ['Руслан', 'Каримов'],
  ['Айгерим', 'Сейтжан'], ['Марат', 'Абенов'], ['Ляззат', 'Бекенова'],
  ['Олжас', 'Токтаров'], ['Гульмира', 'Жолдасова'], ['Арман', 'Искаков'],
  ['Алия', 'Нургалиева'], ['Ержан', 'Кожанов'], ['Айнур', 'Садыкова'],
];

const SOURCES = ['WEBSITE', 'INSTAGRAM', 'WHATSAPP', 'PHONE', 'RECOMMENDATION', 'WALK_IN', 'PARTNER', 'OTHER'];
const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'REJECTED'];
const RESERVATION_STATUSES = ['PLANNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
const RECORD_SOURCES = ['MANUAL', 'POS', 'IMPORT', 'API', 'OTHER'];
const DEMO_PROVIDER = 'MAHABBAT';

const MENU = [
  ['MENU-01', 'Бешбармак', 5500], ['MENU-02', 'Куырдак', 4200], ['MENU-03', 'Манты', 3800],
  ['MENU-04', 'Лагман', 3200], ['MENU-05', 'Плов', 3500], ['MENU-06', 'Шашлык из баранины', 4800],
  ['MENU-07', 'Люля-кебаб', 4300], ['MENU-08', 'Казы', 6200], ['MENU-09', 'Шужык', 5800],
  ['MENU-10', 'Баурсаки', 1200], ['MENU-11', 'Салат «Алматы»', 2600], ['MENU-12', 'Салат «Цезарь»', 2900],
  ['MENU-13', 'Суп «Сорпа»', 2400], ['MENU-14', 'Кеспе', 2200], ['MENU-15', 'Курт', 800],
  ['MENU-16', 'Чак-чак', 1500], ['MENU-17', 'Шелпек', 900], ['MENU-18', 'Айран', 600],
  ['MENU-19', 'Кумыс', 1100], ['MENU-20', 'Тан', 500], ['MENU-21', 'Зелёный чай', 700],
  ['MENU-22', 'Кофе американо', 1300], ['MENU-23', 'Свежевыжатый сок', 1800], ['MENU-24', 'Морс', 900],
  ['MENU-25', 'Самса с мясом', 1400], ['MENU-26', 'Пирог с тыквой', 1600], ['MENU-27', 'Медовик', 1700],
  ['MENU-28', 'Наполеон', 1800], ['MENU-29', 'Торт «Прага»', 1900], ['MENU-30', 'Гречка с мясом', 2800],
  ['MENU-31', 'Картофель фри', 1400], ['MENU-32', 'Котлета по-домашнему', 2900],
];

const people = PEOPLE_META.map(([firstName, lastName], i) => {
  const normalized = String(77001001001 + i);
  const status = i % 13 === 0 ? 'BLOCKED' : i % 11 === 0 ? 'INACTIVE' : i % 7 === 0 ? 'VIP' : i % 9 === 0 ? 'NEW' : 'ACTIVE';
  return {
    id: idFor('person', i),
    name: { firstName, lastName },
    phones: {
      primaryPhoneNumber: normalized,
      primaryPhoneCountryCode: 'KZ',
      primaryPhoneCallingCode: '+7',
      additionalPhones: [],
    },
    externalId: `MAHABBAT-DEMO-PERSON-${String(i + 1).padStart(2, '0')}`,
    provider: DEMO_PROVIDER,
    externalIdentityKey: `${DEMO_PROVIDER}::MAHABBAT-DEMO-PERSON-${String(i + 1).padStart(2, '0')}`,
    normalizedPhone: normalized,
    customerStatus: status,
    customerSource: i % 5 === 3 ? null : SOURCES[(i * 3) % SOURCES.length],
    firstInteractionAt: daysAgo(90 + ((i * 37) % 900), 9 + (i % 8), (i * 13) % 60),
    lastActivityAt: status === 'INACTIVE' || status === 'BLOCKED'
      ? daysAgo(120 + ((i * 7) % 120), 11 + (i % 6), (i * 17) % 60)
      : daysAgo((i * 3) % 28, 12 + (i % 7), (i * 11) % 60),
  };
});

const orders = Array.from({ length: 72 }, (_, i) => {
  const channel = i % 10 < 5 ? 'DINE_IN' : i % 10 < 8 ? 'DELIVERY' : 'PICKUP';
  const status = ORDER_STATUSES[i % 12 === 7 ? 1 : i % 12 === 8 ? 2 : i % 12 === 9 ? 3 : i % 12 === 10 ? 5 : i % 12 === 11 ? 6 : 4];
  const provider = i % 8 === 0 ? 'POS' : i % 8 === 1 ? 'API' : i % 8 === 2 ? 'MANUAL' : 'IMPORT';
  const externalId = `MAHABBAT-DEMO-ORD-${String(i + 1).padStart(3, '0')}`;
  const [menuA, qtyA] = [MENU[(i * 3) % MENU.length], (i % 3) + 1];
  const [menuB, qtyB] = [MENU[(i * 3 + 11) % MENU.length], ((i >> 1) % 2) + 1];
  const subtotalTenge = menuA[2] * qtyA + menuB[2] * qtyB;
  const discountPct = i % 4 === 1 ? 5 : i % 4 === 3 ? 10 : 0;
  const discountTenge = Math.floor((subtotalTenge * discountPct) / 100);
  return {
    id: idFor('order', i),
    customerId: people[i % people.length].id,
    name: externalId,
    externalId,
    provider,
    source: channel === 'DINE_IN' ? 'Хостес' : channel === 'DELIVERY' ? 'Сайт' : 'Телефон',
    channel,
    status,
    orderedAt: daysAgo(Math.floor((i * 180) / 72), 10 + (i % 9), (i * 7) % 60),
    subtotal: money(subtotalTenge),
    discount: discountTenge > 0 ? money(discountTenge) : null,
    total: money(subtotalTenge - discountTenge),
    notes: i % 6 === 0 ? 'Без лука, без чеснока. (демо)' : i % 6 === 3 ? 'Праздничный заказ. (демо)' : null,
  };
});

const orderItems = orders.flatMap((order, i) => [0, 1].map((k) => {
  const [key, name, price] = k === 0 ? MENU[(i * 3) % MENU.length] : MENU[(i * 3 + 11) % MENU.length];
  const quantity = k === 0 ? (i % 3) + 1 : ((i >> 1) % 2) + 1;
  return {
    id: idFor('orderItem', i * 2 + k),
    orderId: order.id,
    menuItem: key,
    name,
    quantity,
    unitPrice: money(price),
    total: money(price * quantity),
  };
}));

const ZONES = ['Основной зал', 'Терраса', 'VIP-зал', 'Банкетный зал'];
const reservations = Array.from({ length: 12 }, (_, i) => {
  const status = RESERVATION_STATUSES[i % RESERVATION_STATUSES.length];
  const future = status === 'PLANNED' || status === 'CONFIRMED';
  return {
    id: idFor('reservation', i),
    customerId: people[(i * 7) % people.length].id,
    externalId: `MAHABBAT-DEMO-RES-${String(i + 1).padStart(2, '0')}`,
    provider: DEMO_PROVIDER,
    guestName: i % 4 === 3 ? 'Гость по телефону (демо)' : null,
    reservationTime: future
      ? daysAhead(1 + ((i * 3) % 14), 18 + (i % 4), (i * 9) % 60)
      : daysAgo(5 + ((i * 9) % 60), 12 + (i % 8), (i * 5) % 60),
    guestCount: 2 + ((i * 3) % 7),
    status,
    zone: ZONES[i % ZONES.length],
    table: `T${(i % 12) + 1}`,
    source: RECORD_SOURCES[i % RECORD_SOURCES.length],
    notes: i % 3 === 0 ? 'Просьба посадить у окна. (демо)' : null,
  };
});

const ledgerEntries = [];
orders.filter((_, i) => i % 2 === 0).forEach((order, i) => {
  ledgerEntries.push({
    id: idFor('ledger', i),
    customerId: order.customerId,
    entryType: 'EARN',
    amount: Math.max(1, Math.round((order.total.amountMicros / MICROS_PER_TENGE * 5) / 100)),
    occurredAt: order.orderedAt,
    relatedOrderId: order.id,
    reason: `Начисление за заказ ${order.externalId} (демо)`,
    actorSource: 'Mahabbat Demo Seed',
    source: 'IMPORT',
  });
});
[0, 3, 6, 9, 12, 15, 18, 21].forEach((customerIndex, i) => {
  ledgerEntries.push({
    id: idFor('ledgerRedeem', i),
    customerId: people[customerIndex].id,
    entryType: 'REDEEM',
    amount: -(50 + (i % 5) * 25),
    occurredAt: daysAgo(80 + i * 13, 13 + i, (i * 11) % 60),
    relatedOrderId: null,
    reason: 'Списание баллов за оплату (демо)',
    actorSource: 'Mahabbat Demo Seed',
    source: 'MANUAL',
  });
});
[0, 7, 14, 21].forEach((customerIndex, i) => {
  ledgerEntries.push({
    id: idFor('ledgerAdjust', i),
    customerId: people[customerIndex].id,
    entryType: 'ADJUSTMENT',
    amount: 100,
    occurredAt: daysAgo(120 + i * 21, 16 + i, (i * 7) % 60),
    relatedOrderId: null,
    reason: 'Компенсация за отзыв (демо)',
    actorSource: 'Mahabbat Demo Seed',
    source: 'MANUAL',
  });
});

const COUNT = {
  people: people.length,
  orders: orders.length,
  orderItems: orderItems.length,
  reservations: reservations.length,
  loyaltyLedgerEntries: ledgerEntries.length,
};

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function validate() {
  const errors = [];
  const allIds = new Set();
  const checkId = (id, label) => {
    if (!UUID_V4_RE.test(id)) errors.push(`${label}: id ${id} is not a valid UUID v4`);
    if (allIds.has(id)) errors.push(`${label}: duplicate id ${id}`);
    allIds.add(id);
  };

  const personIds = new Set();
  const phones = new Set();
  const personExternalIds = new Set();
  const personIdentityKeys = new Set();
  people.forEach((p, i) => {
    checkId(p.id, `people[${i}]`);
    personIds.add(p.id);
    if (!/^7\d{10}$/.test(p.normalizedPhone)) errors.push(`people[${i}]: bad normalizedPhone`);
    if (phones.has(p.normalizedPhone)) errors.push(`people[${i}]: duplicate phone`);
    phones.add(p.normalizedPhone);
    if (p.phones.primaryPhoneNumber.replace(/\D/g, '') !== p.normalizedPhone) errors.push(`people[${i}]: phone mismatch`);
    if (!p.externalId.startsWith('MAHABBAT-DEMO-') || personExternalIds.has(p.externalId)) errors.push(`people[${i}]: bad externalId`);
    personExternalIds.add(p.externalId);
    if (!p.provider) errors.push(`people[${i}]: provider must be set`);
    const personKey = `${p.provider}::${p.externalId}`;
    if (personIdentityKeys.has(personKey)) errors.push(`people[${i}]: duplicate provider+externalId`);
    personIdentityKeys.add(personKey);
  });

  const orderIds = new Set();
  const orderKeys = new Set();
  orders.forEach((o, i) => {
    checkId(o.id, `orders[${i}]`);
    orderIds.add(o.id);
    if (!personIds.has(o.customerId)) errors.push(`orders[${i}]: bad customerId`);
    if (typeof o.name !== 'string' || o.name.trim().length === 0) errors.push(`orders[${i}]: name must be set`);
    if (o.name !== o.externalId) errors.push(`orders[${i}]: name must equal externalId`);
    const key = `${o.provider}::${o.externalId}`;
    if (orderKeys.has(key)) errors.push(`orders[${i}]: duplicate provider+externalId`);
    orderKeys.add(key);
    if (o.subtotal.amountMicros - (o.discount?.amountMicros ?? 0) !== o.total.amountMicros) errors.push(`orders[${i}]: money mismatch`);
  });

  const itemKeys = new Set();
  const sums = new Map();
  orderItems.forEach((it, i) => {
    checkId(it.id, `orderItems[${i}]`);
    if (!orderIds.has(it.orderId)) errors.push(`orderItems[${i}]: bad orderId`);
    const key = `${it.orderId}::${it.menuItem}`;
    if (itemKeys.has(key)) errors.push(`orderItems[${i}]: duplicate order+menuItem`);
    itemKeys.add(key);
    if (it.total.amountMicros !== it.unitPrice.amountMicros * it.quantity) errors.push(`orderItems[${i}]: money mismatch`);
    sums.set(it.orderId, (sums.get(it.orderId) ?? 0) + it.total.amountMicros);
  });
  orders.forEach((o) => {
    if (sums.get(o.id) !== o.subtotal.amountMicros) errors.push(`orders ${o.id}: subtotal != item sum`);
  });

  const reservationIdentityKeys = new Set();
  const reservationExternalIds = new Set();
  reservations.forEach((r, i) => {
    checkId(r.id, `reservations[${i}]`);
    if (!personIds.has(r.customerId)) errors.push(`reservations[${i}]: bad customerId`);
    if (!RESERVATION_STATUSES.includes(r.status)) errors.push(`reservations[${i}]: bad status`);
    if (!r.externalId || !r.externalId.startsWith('MAHABBAT-DEMO-')) errors.push(`reservations[${i}]: bad externalId`);
    if (reservationExternalIds.has(r.externalId)) errors.push(`reservations[${i}]: duplicate externalId`);
    reservationExternalIds.add(r.externalId);
    if (!r.provider) errors.push(`reservations[${i}]: provider must be set`);
    const reservationKey = `${r.provider}::${r.externalId}`;
    if (reservationIdentityKeys.has(reservationKey)) errors.push(`reservations[${i}]: duplicate provider+externalId`);
    reservationIdentityKeys.add(reservationKey);
  });

  const ledgerKeys = new Set();
  ledgerEntries.forEach((e, i) => {
    checkId(e.id, `loyaltyLedgerEntries[${i}]`);
    if (!personIds.has(e.customerId)) errors.push(`loyaltyLedgerEntries[${i}]: bad customerId`);
    if (!Number.isInteger(e.amount) || e.amount === 0) errors.push(`loyaltyLedgerEntries[${i}]: bad amount`);
    if (e.entryType === 'EARN' && e.amount < 0) errors.push(`loyaltyLedgerEntries[${i}]: EARN must be positive`);
    if (e.entryType === 'REDEEM' && e.amount > 0) errors.push(`loyaltyLedgerEntries[${i}]: REDEEM must be negative`);
    if (e.relatedOrderId !== null && !orderIds.has(e.relatedOrderId)) errors.push(`loyaltyLedgerEntries[${i}]: bad relatedOrderId`);
    const key = `${e.customerId}::${e.occurredAt}::${e.reason}`;
    if (ledgerKeys.has(key)) errors.push(`loyaltyLedgerEntries[${i}]: duplicate customer+occurredAt+reason`);
    ledgerKeys.add(key);
  });

  return errors;
}

function getEnv() {
  const apiUrl = process.env.MAHABBAT_API_URL?.trim();
  const apiKey = process.env.MAHABBAT_API_KEY?.trim();
  if (!apiUrl || !apiKey) {
    throw new Error('MAHABBAT_API_URL and MAHABBAT_API_KEY must be set (e.g. MAHABBAT_API_URL=http://localhost:2020 MAHABBAT_API_KEY=<key> yarn seed:demo)');
  }
  return { apiUrl: apiUrl.replace(/\/+$/, ''), apiKey };
}

async function sync(apiUrl, apiKey, label, plural, items, options = {}) {
  const { reconcile, identityOf } = options;
  const existing = new Map();
  const existingIdentities = new Set();
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
      const identity = identityOf?.(record);
      if (identity) existingIdentities.add(identity);
    }
    cursor = payload.pageInfo?.hasNextPage ? payload.pageInfo.endCursor : null;
    if (cursor && cursor === previousCursor) {
      throw new Error(`GET /rest/${plural} returned a non-advancing cursor`);
    }
    previousCursor = cursor;
  } while (cursor);

  const missing = items.filter((item) => {
    if (existing.has(item.id)) return false;
    const identity = identityOf?.(item);
    return !identity || !existingIdentities.has(identity);
  });
  let reconciled = 0;
  if (reconcile) {
    for (const item of items) {
      const current = existing.get(item.id);
      const patch = current ? reconcile(current, item) : null;
      if (!patch || Object.keys(patch).length === 0) continue;
      const res = await fetch(`${apiUrl}/rest/${plural}/${item.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`PATCH /rest/${plural}/${item.id} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
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
    console.error(`Seed dataset validation failed (${errors.length} errors):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exitCode = 1;
    return;
  }

  console.log('REST assumptions (verified against Twenty v2.29.0 source):');
  console.log('  endpoints: /rest/people, /rest/orders, /rest/orderItems, /rest/reservations, /rest/loyaltyLedgerEntries');
  console.log('  relations via join columns: customerId, orderId, relatedOrderId');
  console.log('  money: { amountMicros, currencyCode: "KZT" } (integer, no floats)');
  console.log('  idempotent: fixed UUID v4 ids, existing records skipped, server identity key reconciled, nothing deleted');
  console.log('');
  console.log('Seed plan:');
  console.log(`  ${COUNT.people} people, ${COUNT.orders} orders, ${COUNT.orderItems} order items, ${COUNT.reservations} reservations, ${COUNT.loyaltyLedgerEntries} loyalty ledger entries`);
  console.log(`  target: ${apiUrl}`);

  if (dryRun) {
    console.log('Dry run: dataset is valid, no records were sent.');
    return;
  }

  const health = await fetch(`${apiUrl}/healthz`).catch(() => null);
  if (!health?.ok) throw new Error(`Twenty server is not reachable at ${apiUrl}/healthz`);

  console.log('');
  await sync(
    apiUrl,
    getEnv().apiKey,
    'Person',
    'people',
    people,
    {
      identityOf: (record) => record.provider && record.externalId
        ? `${record.provider}::${record.externalId}`
        : null,
      reconcile: (existing, incoming) => existing.externalIdentityKey === incoming.externalIdentityKey
        ? null
        : { externalIdentityKey: incoming.externalIdentityKey },
    },
  );
  await sync(apiUrl, getEnv().apiKey, 'Order', 'orders', orders, {
    identityOf: (record) => record.provider && record.externalId
      ? `${record.provider}::${record.externalId}`
      : null,
    reconcile: (existing, incoming) => {
      const existingName = existing.name;
      const isNameMissing =
        existingName === null ||
        existingName === undefined ||
        (typeof existingName === 'string' && existingName.trim().length === 0);

      return isNameMissing && incoming.name ? { name: incoming.name } : null;
    },
  });
  await sync(apiUrl, getEnv().apiKey, 'OrderItem', 'orderItems', orderItems);
  await sync(apiUrl, getEnv().apiKey, 'Reservation', 'reservations', reservations, {
    identityOf: (record) => record.provider && record.externalId
      ? `${record.provider}::${record.externalId}`
      : null,
  });
  await sync(apiUrl, getEnv().apiKey, 'LoyaltyLedgerEntry', 'loyaltyLedgerEntries', ledgerEntries);
  console.log('');
  console.log('Seed complete.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
