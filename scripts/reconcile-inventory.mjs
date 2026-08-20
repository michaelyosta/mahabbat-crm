/**
 * Read-only inventory projection reconciliation.
 *
 * Usage:
 *   MAHABBAT_API_URL=http://localhost:2020 MAHABBAT_API_KEY=<key> node scripts/reconcile-inventory.mjs
 *
 * The API key is used only by this local harness and is never printed.
 */
const getEnv = () => {
  const apiUrl = process.env.MAHABBAT_API_URL?.trim();
  const apiKey = process.env.MAHABBAT_API_KEY?.trim();
  if (!apiUrl || !apiKey) throw new Error('MAHABBAT_API_URL and MAHABBAT_API_KEY must be set');
  return { apiUrl: apiUrl.replace(/\/+$/, ''), apiKey };
};

const list = async (apiUrl, apiKey, plural) => {
  const rows = [];
  let cursor = null;
  let previous = null;
  do {
    const query = new URLSearchParams({ limit: '200' });
    if (cursor) query.set('starting_after', cursor);
    const response = await fetch(`${apiUrl}/rest/${plural}?${query}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) throw new Error(`GET /rest/${plural} -> ${response.status}`);
    const body = await response.json();
    rows.push(...(body.data?.[plural] ?? []));
    cursor = body.pageInfo?.hasNextPage ? body.pageInfo.endCursor : null;
    if (cursor && cursor === previous) throw new Error(`GET /rest/${plural} returned a non-advancing cursor`);
    previous = cursor;
  } while (cursor);
  return rows;
};

const main = async () => {
  const { apiUrl, apiKey } = getEnv();
  const [balances, movements] = await Promise.all([
    list(apiUrl, apiKey, 'inventoryStockBalances'),
    list(apiUrl, apiKey, 'inventoryStockMovements'),
  ]);
  const sums = new Map();
  for (const movement of movements) {
    const key = `${movement.stockItemId}:${movement.locationId}`;
    sums.set(key, (sums.get(key) ?? 0) + (movement.quantityDeltaMicros ?? 0));
  }
  const balanceByKey = new Map(balances.map((balance) => [`${balance.stockItemId}:${balance.locationId}`, balance]));
  const keys = new Set([...sums.keys(), ...balanceByKey.keys()]);
  const mismatches = [];
  for (const key of keys) {
    const ledger = sums.get(key) ?? 0;
    const projected = balanceByKey.get(key)?.quantityMicros ?? 0;
    if (ledger !== projected) mismatches.push({ key, ledger, projected });
  }
  console.log(`reconciliation balances=${balances.length} movements=${movements.length} mismatches=${mismatches.length}`);
  for (const mismatch of mismatches.slice(0, 20)) {
    console.log(`MISMATCH ${mismatch.key} ledger=${mismatch.ledger} projected=${mismatch.projected}`);
  }
  if (mismatches.length > 0) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
