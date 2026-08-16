/*
 * Synthetic aggregate-sales smoke. It intentionally never reads the private
 * workbook and never writes operational Orders or OrderItems.
 */

const apiUrl = process.env.MAHABBAT_API_URL?.replace(/\/+$/, '');
const apiKey = process.env.MAHABBAT_API_KEY?.trim();
if (!apiUrl || !apiKey) {
  throw new Error('MAHABBAT_API_URL and MAHABBAT_API_KEY are required');
}

const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
const sourceReportId = 'SYNTHETIC-APRIL-2026-BAR';

const normalizeText = (value, field) => {
  const normalized = String(value).normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error(`${field} must not be empty`);
  return normalized;
};
const normalizeItemKey = (value) => normalizeText(value, 'rawItemName').toLocaleLowerCase('ru-KZ');
const identityOf = (line) => [
  'AGGREGATE',
  normalizeText(line.provider, 'provider').toUpperCase(),
  normalizeText(line.sourceReportId, 'sourceReportId'),
  normalizeText(line.periodStart, 'periodStart'),
  normalizeText(line.periodEnd, 'periodEnd'),
  normalizeText(line.warehouse, 'warehouse'),
  line.itemExternalId?.trim() || 'NO_ITEM_ID',
  normalizeItemKey(line.rawItemName),
  String(line.sourceRowNumber ?? 'NO_ROW'),
].join('::');
const money = (tenge) => {
  const normalized = String(tenge);
  const sign = normalized.startsWith('-') ? -1n : 1n;
  const unsigned = normalized.replace(/^-/, '');
  const [whole, fraction = ''] = unsigned.split('.');
  if (fraction.length > 6) throw new Error('synthetic money has too many decimals');
  const micros = sign * (
    BigInt(whole) * 1_000_000n + BigInt((fraction + '000000').slice(0, 6))
  );
  return { amountMicros: micros.toString(), currencyCode: 'KZT' };
};

const fixture = [
  { rawItemName: 'Лепешка 1 шт', sourceRowNumber: 5, quantity: '1715', revenue: '560520' },
  { rawItemName: 'Лепешка  1   шт', sourceRowNumber: 6, quantity: '24.25', revenue: '0' },
  { rawItemName: 'Лепёшка 1 шт', sourceRowNumber: 7, quantity: '11.5', revenue: '3000.50' },
].map((line) => ({
  provider: 'IMPORT',
  sourceReportId,
  periodStart: '2026-04-01',
  periodEnd: '2026-04-30',
  warehouse: 'Бар',
  sourceFileName: 'synthetic-aggregate-april.xlsx',
  itemExternalId: null,
  normalizedItemKey: normalizeItemKey(line.rawItemName),
  ...line,
}));

const toRecord = (line) => ({
  externalIdentityKey: identityOf(line),
  provider: line.provider,
  sourceReportId: line.sourceReportId,
  periodStart: line.periodStart,
  periodEnd: line.periodEnd,
  warehouse: line.warehouse,
  sourceFileName: line.sourceFileName,
  sourceRowNumber: line.sourceRowNumber,
  rawItemName: line.rawItemName,
  normalizedItemKey: line.normalizedItemKey,
  // Twenty v2.29 REST accepts NUMBER fields as JSON numbers. Quantity is
  // non-financial decimal data; the pure contract keeps its source string
  // until this transport boundary.
  quantity: Number(line.quantity),
  revenue: money(line.revenue),
  matchStatus: 'UNMATCHED',
});

async function listAll() {
  const records = [];
  let cursor = null;
  do {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('starting_after', cursor);
    const response = await fetch(`${apiUrl}/rest/salesSnapshotLines?${query}`, { headers });
    if (!response.ok) throw new Error(`GET salesSnapshotLines -> ${response.status}`);
    const payload = await response.json();
    records.push(...(payload.data?.salesSnapshotLines ?? []));
    cursor = payload.pageInfo?.hasNextPage ? payload.pageInfo.endCursor : null;
  } while (cursor);
  return records;
}

async function importFixture() {
  const existing = new Map((await listAll()).map((record) => [record.externalIdentityKey, record]));
  const missing = fixture.map(toRecord).filter((record) => !existing.has(record.externalIdentityKey));
  if (missing.length) {
    const response = await fetch(`${apiUrl}/rest/batch/salesSnapshotLines`, {
      method: 'POST', headers, body: JSON.stringify(missing),
    });
    if (!response.ok) {
      const afterRace = new Map((await listAll()).map((record) => [record.externalIdentityKey, record]));
      if (missing.some((record) => !afterRace.has(record.externalIdentityKey))) {
        throw new Error(`POST salesSnapshotLines -> ${response.status}: ${(await response.text()).slice(0, 300)}`);
      }
    }
  }
}

await importFixture();
await importFixture();
await Promise.allSettled([importFixture(), importFixture()]);

const finalRecords = (await listAll()).filter((record) => fixture.some((line) => identityOf(line) === record.externalIdentityKey));
if (finalRecords.length !== fixture.length) throw new Error(`expected ${fixture.length} aggregate lines, found ${finalRecords.length}`);
if (new Set(finalRecords.map((record) => record.externalIdentityKey)).size !== fixture.length) throw new Error('duplicate aggregate identity detected');
if (!finalRecords.some((record) => String(record.quantity) === '24.25' && String(record.revenue?.amountMicros) === '0')) throw new Error('fractional zero-revenue line was not preserved');
if (new Set(finalRecords.map((record) => record.rawItemName)).size !== fixture.length) throw new Error('raw item names were merged');
console.log(`Aggregate smoke passed: ${finalRecords.length} lines, repeat/concurrent imports converged with no duplicates.`);
