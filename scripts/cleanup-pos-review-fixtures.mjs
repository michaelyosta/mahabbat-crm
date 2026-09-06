/**
 * Deactivates only accumulated, explicitly identifiable POS presentation fixtures.
 *
 * Order, payment, Inventory ledger and reconciliation records are preserved.
 * The script is dry-run by default; pass --apply to perform bounded PATCHes.
 */

const apply = process.argv.includes('--apply');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const env = () => {
  const apiUrl = process.env.MAHABBAT_API_URL?.trim();
  const apiKey = process.env.MAHABBAT_API_KEY?.trim();
  if (!apiUrl || !apiKey) throw new Error('MAHABBAT_API_URL and MAHABBAT_API_KEY must be set');
  return { apiUrl: apiUrl.replace(/\/+$/, ''), apiKey };
};

const restGet = async (apiUrl, apiKey, plural) => {
  const rows = [];
  let cursor = null;
  let previousCursor = null;
  do {
    const query = new URLSearchParams({ limit: '200' });
    if (cursor) query.set('starting_after', cursor);
    const response = await fetch(`${apiUrl}/rest/${plural}?${query}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error(`GET /rest/${plural} -> ${response.status}`);
    const body = await response.json();
    rows.push(...(body.data?.[plural] ?? []));
    previousCursor = cursor;
    cursor = body.pageInfo?.hasNextPage ? body.pageInfo.endCursor : null;
    if (cursor && cursor === previousCursor) throw new Error(`GET /rest/${plural} returned a non-advancing cursor`);
  } while (cursor);
  return rows;
};

const deactivate = async (apiUrl, apiKey, plural, row) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${apiUrl}/rest/${plural}/${row.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    if (response.ok) return;
    if (response.status !== 429 || attempt === 7) throw new Error(`PATCH /rest/${plural}/${row.id} -> ${response.status}`);
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
    await delay(Number.isFinite(retryAfter) ? Math.max(1_000, retryAfter * 1_000) : 1_000 * (attempt + 1));
  }
};

const invPrefix = /^INV-[^\s]+/i;
const isInvValue = (value) => invPrefix.test(String(value ?? '').trim());
const reviewLeakMenuMarker =
  /\bMissing\s+Recipe\b|(?:^|[\s(])(?:проверка|acceptance|fixture|synthetic|smoke)(?:[\s)]|$)/i;
const isReviewLeakMenuItem = (row) =>
  isInvValue(row.name) ||
  String(row.category ?? '') === 'Inventory Acceptance' ||
  reviewLeakMenuMarker.test(String(row.name ?? '').trim());

const main = async () => {
  const { apiUrl, apiKey } = env();
  const [zones, tables, menuItems, paymentMethods, staffs] = await Promise.all([
    restGet(apiUrl, apiKey, 'posZones'),
    restGet(apiUrl, apiKey, 'posTables'),
    restGet(apiUrl, apiKey, 'posMenuItems'),
    restGet(apiUrl, apiKey, 'posPaymentMethods'),
    restGet(apiUrl, apiKey, 'posStaffs'),
  ]);

  const invZoneIds = new Set(zones.filter((row) => isInvValue(row.name)).map((row) => String(row.id)));
  const candidates = [
    ['posTables', tables.filter((row) => invZoneIds.has(String(row.zoneId)) || isInvValue(row.number))],
    ['posZones', zones.filter((row) => isInvValue(row.name))],
    ['posMenuItems', menuItems.filter(isReviewLeakMenuItem)],
    ['posPaymentMethods', paymentMethods.filter((row) => isInvValue(row.name))],
    ['posStaffs', staffs.filter((row) => isInvValue(row.displayName))],
  ].map(([plural, rows]) => [plural, rows.filter((row) => row.isActive !== false)]);

  const total = candidates.reduce((sum, [, rows]) => sum + rows.length, 0);
  for (const [plural, rows] of candidates) console.log(`${plural}: ${rows.length}`);
  console.log(`Total active synthetic presentation fixtures: ${total}`);

  if (!apply) {
    console.log('Dry run only. Pass --apply to deactivate these fixtures.');
    return;
  }

  for (const [plural, rows] of candidates) {
    for (const row of rows) {
      await deactivate(apiUrl, apiKey, plural, row);
      await delay(125);
    }
  }
  console.log(`Deactivated ${total} synthetic presentation records; audit records were preserved.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
