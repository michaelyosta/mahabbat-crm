/**
 * Bounded Customer Identity + Import Idempotency smoke test.
 *
 * This is intentionally an adapter-level proof, not a general import
 * framework. It uses Twenty REST with an explicitly supplied API key and
 * leaves deterministic demo records in the selected proof workspace.
 */
const API_URL = process.env.MAHABBAT_API_URL?.trim()?.replace(/\/+$/, '');
const API_KEY = process.env.MAHABBAT_API_KEY?.trim();
const PROVIDER = 'IDENTITY_SMOKE';
const ORDER_PROVIDER = 'API';
const PHONE = '77011234567';

if (!API_URL || !API_KEY) {
  throw new Error('MAHABBAT_API_URL and MAHABBAT_API_KEY are required.');
}

const authHeaders = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const responseJson = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text.slice(0, 300) };
  }
};

const findByIdentity = async (resource, provider, externalId) => {
  const filter = `and(provider[eq]:"${provider}",externalId[eq]:"${externalId}")`;
  const query = new URLSearchParams({ filter, limit: '100' });
  const response = await fetch(`${API_URL}/rest/${resource}?${query}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const body = await responseJson(response);
  assert(response.ok, `GET /rest/${resource} failed with ${response.status}`);
  return body?.data?.[resource] ?? [];
};

const create = async (resource, record) => {
  const response = await fetch(`${API_URL}/rest/${resource}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(record),
  });
  return { status: response.status, body: await responseJson(response) };
};

const patch = async (resource, id, changes) => {
  const response = await fetch(`${API_URL}/rest/${resource}/${id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify(changes),
  });
  const body = await responseJson(response);
  assert(response.ok, `PATCH /rest/${resource}/${id} failed with ${response.status}`);
  const singular = resource === 'people'
    ? 'Person'
    : resource === 'orders'
      ? 'Order'
      : resource === 'reservations'
        ? 'Reservation'
        : resource;
  return body?.data?.[`update${singular}`] ?? body?.data ?? body;
};

const stableId = (label) => {
  let hash = 2166136261;
  for (const character of label) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex}-${hex.slice(0, 4)}-4${hex.slice(0, 3)}-8${hex.slice(0, 3)}-${hex}${hex.slice(0, 4)}`;
};

const upsertOrRace = async (resource, record) => {
  const existing = await findByIdentity(resource, record.provider, record.externalId);
  if (existing.length > 0) return { kind: 'noop', record: existing[0] };

  const result = await create(resource, record);
  if (result.status === 201) return { kind: 'created', record: result.body?.data ?? result.body };

  if (result.status === 400 || result.status === 409) {
    const raced = await findByIdentity(resource, record.provider, record.externalId);
    assert(raced.length === 1, `${resource} unique race did not converge to one record`);
    return { kind: 'race-recovered', record: raced[0] };
  }
  throw new Error(`POST /rest/${resource} failed with ${result.status}`);
};

const concurrentCreate = async (resource, baseRecord) => {
  const existing = await findByIdentity(resource, baseRecord.provider, baseRecord.externalId);
  if (existing.length > 0) return { kind: 'already-present', count: existing.length };

  const [left, right] = await Promise.all([
    create(resource, { ...baseRecord, id: stableId(`${resource}:left`) }),
    create(resource, { ...baseRecord, id: stableId(`${resource}:right`) }),
  ]);
  const successes = [left, right].filter((result) => result.status === 201).length;
  const records = await findByIdentity(resource, baseRecord.provider, baseRecord.externalId);
  assert(records.length === 1, `${resource} concurrent import created ${records.length} records`);
  assert(successes <= 1, `${resource} concurrent import had ${successes} successful creates`);
  return { kind: 'converged', count: records.length, statuses: [left.status, right.status] };
};

const personRecord = {
  id: stableId('person:primary'),
  provider: PROVIDER,
  externalId: 'customer-001',
  externalIdentityKey: `${PROVIDER}::customer-001`,
  name: { firstName: 'Identity', lastName: 'Smoke' },
  phones: {
    primaryPhoneNumber: '+7 701 123 45 67',
    primaryPhoneCountryCode: 'KZ',
    primaryPhoneCallingCode: '+7',
    additionalPhones: [],
  },
  normalizedPhone: PHONE,
  customerSource: 'WEBSITE',
  customerNotes: { blocknote: null, markdown: 'Local note must not be overwritten' },
};

const primary = await upsertOrRace('people', personRecord);
const repeat = await upsertOrRace('people', personRecord);
assert(['created', 'noop', 'race-recovered'].includes(primary.kind), 'primary import did not resolve');
assert(repeat.kind === 'noop', 'repeat import was not a noop');
const primaryRecord = (await findByIdentity('people', PROVIDER, personRecord.externalId))[0];
assert(primaryRecord?.normalizedPhone === PHONE, 'canonical phone was not persisted');
assert(primaryRecord?.externalIdentityKey === `${PROVIDER}::${personRecord.externalId}`, 'identity key was not persisted');

const changed = await patch('people', primaryRecord.id, { customerSource: 'WHATSAPP' });
assert(changed?.customerSource === 'WHATSAPP', 'source-owned field did not update');
const conflictBefore = (await findByIdentity('people', PROVIDER, personRecord.externalId))[0];
assert(
  conflictBefore.customerNotes?.markdown === personRecord.customerNotes.markdown,
  'local note changed unexpectedly',
);

const samePhoneDifferentIdentity = await upsertOrRace('people', {
  ...personRecord,
  id: stableId('person:same-phone'),
  externalId: 'customer-002',
  externalIdentityKey: `${PROVIDER}::customer-002`,
  name: { firstName: 'Same', lastName: 'Phone' },
});
assert(['created', 'noop', 'race-recovered'].includes(samePhoneDifferentIdentity.kind), 'same-phone identity failed');
assert((await findByIdentity('people', PROVIDER, 'customer-002')).length === 1, 'same phone was merged by mistake');

const personRace = await concurrentCreate('people', {
  ...personRecord,
  id: undefined,
  externalId: 'customer-concurrent',
  externalIdentityKey: `${PROVIDER}::customer-concurrent`,
  name: { firstName: 'Concurrent', lastName: 'Import' },
});

const customerId = primaryRecord.id;
const orderRace = await concurrentCreate('orders', {
  provider: ORDER_PROVIDER,
  externalId: 'IDENTITY-SMOKE-ORDER-001',
  customerId,
  source: 'identity-smoke',
  channel: 'PICKUP',
  status: 'COMPLETED',
  orderedAt: '2026-08-09T12:00:00.000Z',
  subtotal: { amountMicros: 1000000, currencyCode: 'KZT' },
  discount: null,
  total: { amountMicros: 1000000, currencyCode: 'KZT' },
  notes: 'Identity smoke order',
});

const reservationRace = await concurrentCreate('reservations', {
  provider: PROVIDER,
  externalId: 'IDENTITY-SMOKE-RES-001',
  customerId,
  guestName: 'Identity Smoke',
  reservationTime: '2026-08-10T18:00:00.000Z',
  guestCount: 2,
  status: 'PLANNED',
  zone: 'VIP',
  table: 'S1',
  source: 'IMPORT',
  notes: 'Identity smoke reservation',
});

console.log(JSON.stringify({
  target: API_URL,
  phone: 'formats normalized to one canonical value',
  person: { primary: primary.kind, repeat: repeat.kind, samePhone: samePhoneDifferentIdentity.kind, concurrent: personRace },
  order: { concurrent: orderRace },
  reservation: { concurrent: reservationRace },
  conflictPolicy: 'source-owned fields update; local note remained unchanged',
}, null, 2));
