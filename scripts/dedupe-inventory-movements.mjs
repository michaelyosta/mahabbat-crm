/**
 * Controlled migration for the unique index on
 * inventoryStockMovement.idempotencyKey.
 *
 * The append-only ledger is supposed to hold exactly one movement per
 * idempotency key. Historical bugs could leave duplicates; a unique index
 * cannot be applied until they are gone.
 *
 * Read-only by default. With --apply it deletes the duplicate rows (keeping the
 * earliest by createdAt/id) and rebuilds the affected stock balance projections
 * from the remaining ledger.
 *
 * Usage:
 *   MAHABBAT_API_URL=http://localhost:2020 MAHABBAT_API_KEY=<key> \
 *     node scripts/dedupe-inventory-movements.mjs            # report only
 *   MAHABBAT_API_URL=... MAHABBAT_API_KEY=... \
 *     node scripts/dedupe-inventory-movements.mjs --apply    # delete + rebuild
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

const remove = async (apiUrl, apiKey, plural, id) => {
  const response = await fetch(`${apiUrl}/rest/${plural}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`DELETE /rest/${plural}/${id} -> ${response.status}`);
  }
};

const updateBalance = async (apiUrl, apiKey, id, data) => {
  const response = await fetch(`${apiUrl}/rest/inventoryStockBalances/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`PATCH /rest/inventoryStockBalances/${id} -> ${response.status}`);
};

const roundHalfUp = (numerator, denominator) => {
  if (denominator === 0) return 0;
  const sign = numerator * denominator < 0 ? -1 : 1;
  const absNum = Math.abs(numerator);
  const absDen = Math.abs(denominator);
  return sign * Math.floor((absNum + absDen / 2) / absDen);
};

// Mirror of computeNewWeightedAverage over the ordered ledger.
const project = (movements) => {
  let quantityMicros = 0;
  let averageCostMicros = 0;
  for (const movement of movements) {
    const delta = movement.quantityDeltaMicros ?? 0;
    if (delta > 0 && movement.unitCostMicros != null) {
      averageCostMicros = quantityMicros > 0
        ? roundHalfUp(quantityMicros * averageCostMicros + delta * movement.unitCostMicros, quantityMicros + delta)
        : movement.unitCostMicros;
    }
    quantityMicros += delta;
    if (quantityMicros === 0) averageCostMicros = 0;
  }
  return { quantityMicros, averageCostMicros };
};

const main = async () => {
  const apply = process.argv.includes('--apply');
  const { apiUrl, apiKey } = getEnv();
  const [balances, movements] = await Promise.all([
    list(apiUrl, apiKey, 'inventoryStockBalances'),
    list(apiUrl, apiKey, 'inventoryStockMovements'),
  ]);

  const byKey = new Map();
  for (const movement of movements) {
    const key = movement.idempotencyKey;
    if (!key) continue;
    const group = byKey.get(key) ?? [];
    group.push(movement);
    byKey.set(key, group);
  }

  const duplicates = [...byKey.entries()].filter(([, group]) => group.length > 1);
  console.log(`movements=${movements.length} duplicateKeys=${duplicates.length}`);
  for (const [key, group] of duplicates.slice(0, 50)) {
    console.log(`DUPLICATE ${key} count=${group.length} ids=${group.map((row) => row.id).join(',')}`);
  }

  if (duplicates.length === 0) return;
  if (!apply) {
    console.log('Report only. Re-run with --apply to delete duplicates and rebuild balances.');
    process.exitCode = 1;
    return;
  }

  const affected = new Map();
  for (const [, group] of duplicates) {
    const sorted = [...group].sort((a, b) =>
      String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')) || String(a.id).localeCompare(String(b.id)),
    );
    for (const extra of sorted.slice(1)) {
      await remove(apiUrl, apiKey, 'inventoryStockMovements', extra.id);
      const item = extra.stockItemId;
      const location = extra.locationId;
      if (item && location) affected.set(`${item}:${location}`, { item, location });
    }
  }

  const remaining = movements.filter((movement) => {
    if (!movement.idempotencyKey) return true;
    const group = byKey.get(movement.idempotencyKey);
    if (!group || group.length === 1) return true;
    const sorted = [...group].sort((a, b) =>
      String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')) || String(a.id).localeCompare(String(b.id)),
    );
    return movement.id === sorted[0].id;
  });

  const balanceByKey = new Map(balances.map((balance) => [`${balance.stockItemId}:${balance.locationId}`, balance]));
  for (const { item, location } of affected.values()) {
    const ledger = remaining
      .filter((movement) => movement.stockItemId === item && movement.locationId === location)
      .sort((a, b) => `${a.occurredAt ?? ''}:${a.id}`.localeCompare(`${b.occurredAt ?? ''}:${b.id}`));
    const projection = project(ledger);
    const balance = balanceByKey.get(`${item}:${location}`);
    if (!balance) continue;
    await updateBalance(apiUrl, apiKey, balance.id, {
      quantityMicros: projection.quantityMicros,
      averageCostMicros: projection.averageCostMicros,
      version: (balance.version ?? 0) + 1,
    });
    console.log(`REBUILT ${item}:${location} qty=${projection.quantityMicros} avg=${projection.averageCostMicros}`);
  }
  console.log('Dedupe complete.');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
