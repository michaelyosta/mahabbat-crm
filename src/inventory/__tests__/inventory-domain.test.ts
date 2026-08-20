import { describe, expect, it } from 'vitest';

import {
  executeCreateStockLocation,
  executeCreateStockItem,
  executeReceiveStock,
  executeWriteOffStock,
  executeTransferStock,
  executeUpsertRecipe,
  executeProduceSemi,
  processConsumptionRequest,
  executeCreateCount,
  executeStartCount,
  executeFinalizeCount,
} from 'src/inventory/inventory-dispatch';
import { divideRoundHalfUp, gramsToMicros, kgToMicros, scaledQuantityMicros } from 'src/inventory/inventory-units';

// simplified fake client mirroring FakePosDb logic for inventory
type Row = Record<string, unknown> & { id: string };
type Kind =
  | 'inventoryStockLocations'
  | 'inventoryStockItems'
  | 'inventoryStockBalances'
  | 'inventoryStockMovements'
  | 'inventoryRecipes'
  | 'inventoryRecipeVersions'
  | 'inventoryRecipeLines'
  | 'inventoryConsumptionRequests'
  | 'inventoryConsumptionIssues'
  | 'inventoryCounts'
  | 'inventoryCountLines'
  | 'posOrders';

class FakeDb {
  rows: Record<Kind, Row[]> = {
    inventoryStockLocations: [],
    inventoryStockItems: [],
    inventoryStockBalances: [],
    inventoryStockMovements: [],
    inventoryRecipes: [],
    inventoryRecipeVersions: [],
    inventoryRecipeLines: [],
    inventoryConsumptionRequests: [],
    inventoryConsumptionIssues: [],
    inventoryCounts: [],
    inventoryCountLines: [],
    posOrders: [],
  };
  seed(k: Kind, row: Row) { this.rows[k].push(row); return row; }
  private find(kind: Kind, filter: Record<string, unknown>) {
    let res = this.rows[kind];
    for (const [field, cond] of Object.entries(filter)) {
      const p = cond as Record<string, unknown>;
      if (typeof p === 'object' && p !== null && 'eq' in p) res = res.filter(r => r[field] === p.eq);
    }
    return res;
  }
  async query(q: unknown): Promise<unknown> {
    const doc = q as Record<string, unknown>;
    const root = Object.keys(doc)[0];
    const op = doc[root] as Record<string, unknown>;
    const args = op.__args as Record<string, unknown>;
    const filter = (args?.filter ?? {}) as Record<string, unknown>;
    const first = typeof args?.first === 'number' ? args.first : 100;
    const kind = root as Kind;
    if (!(kind in this.rows)) return { [root]: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } } };
    const filtered = this.find(kind, filter).slice(0, first);
    return { [root]: { edges: filtered.map(r => ({ node: { ...r } })), pageInfo: { hasNextPage: false, endCursor: null } } };
  }
  async mutation(m: unknown): Promise<unknown> {
    const doc = m as Record<string, unknown>;
    const root = Object.keys(doc)[0];
    const op = doc[root] as Record<string, unknown>;
    const args = op.__args as Record<string, unknown>;
    const data = args?.data as Row;
    const id = args?.id as string | undefined;
    const filter = (args?.filter ?? {}) as Record<string, unknown>;
    // map root to kind
    const createMap: Record<string, Kind> = {
      createInventoryStockLocation: 'inventoryStockLocations',
      createInventoryStockItem: 'inventoryStockItems',
      createInventoryStockBalance: 'inventoryStockBalances',
      createInventoryStockMovement: 'inventoryStockMovements',
      createInventoryRecipe: 'inventoryRecipes',
      createInventoryRecipeVersion: 'inventoryRecipeVersions',
      createInventoryRecipeLine: 'inventoryRecipeLines',
      createInventoryConsumptionRequest: 'inventoryConsumptionRequests',
      createInventoryConsumptionIssue: 'inventoryConsumptionIssues',
      createInventoryCount: 'inventoryCounts',
      createInventoryCountLine: 'inventoryCountLines',
    };
    const updateMap: Record<string, Kind> = {
      updateInventoryStockBalance: 'inventoryStockBalances',
      updateInventoryStockBalances: 'inventoryStockBalances',
      updateInventoryRecipeVersion: 'inventoryRecipeVersions',
      updateInventoryConsumptionRequest: 'inventoryConsumptionRequests',
      updateInventoryCount: 'inventoryCounts',
      updateInventoryCountLine: 'inventoryCountLines',
    };
    if (createMap[root]) {
      const kind = createMap[root];
      // unique checks: idempotencyKey duplicate
      if (data?.idempotencyKey && typeof data.idempotencyKey === 'string') {
        if (this.rows[kind].some(r => r.idempotencyKey === data.idempotencyKey)) throw new Error('duplicate idempotency');
      }
      if (kind === 'inventoryStockMovements' && data?.idempotencyKey) {
        if (this.rows[kind].some(r => r.idempotencyKey === data.idempotencyKey)) throw new Error('duplicate movement');
      }
      const rec = { ...data, id: `${kind}:${++FakeDb.counter}` } as Row;
      this.rows[kind].push(rec);
      return { [root]: { ...rec } };
    }
    if (updateMap[root]) {
      const kind = updateMap[root];
      const matches = id
        ? this.rows[kind].filter(r => r.id === id)
        : this.find(kind, filter);
      if (matches.length === 0) return { [root]: root.endsWith('Balances') ? [] : null };
      const updated = matches.map(match => {
        const idx = this.rows[kind].findIndex(r => r.id === match.id);
        this.rows[kind][idx] = { ...this.rows[kind][idx], ...data };
        return { ...this.rows[kind][idx] };
      });
      return { [root]: root.endsWith('Balances') ? updated : updated[0] };
    }
    // generic id-based mutation fallback
    if (root.startsWith('update')) throw new Error(`Unsupported update ${root}`);
    throw new Error(`Unsupported mutation ${root}`);
  }
  static counter = 0;
}

const admin = { staffId: 'admin-1', role: 'ADMIN' };
const locId = async (db: FakeDb, name: string) => {
  const r = await executeCreateStockLocation(db as any, { name, idempotencyKey: `loc-${name}` }, admin);
  return (r.body as { locationId: string }).locationId;
};
const itemId = async (db: FakeDb, name: string, type: string = 'RAW_MATERIAL') => {
  const kind = type === 'SEMI_FINISHED' ? 'MASS' : 'MASS';
  const base = 'GRAM';
  const r = await executeCreateStockItem(db as any, { name, itemType: type, unitKind: kind, baseUnit: base, idempotencyKey: `item-${name}` }, admin);
  return (r.body as { stockItemId: string }).stockItemId;
};

describe('inventory units', () => {
  it('kg↔g conversion exact micros', () => {
    expect(kgToMicros(1)).toBe(1_000_000);
    expect(gramsToMicros(50)).toBe(50_000);
    expect(gramsToMicros(0.5)).toBe(500);
  });
  it('fixed-point divide half up', () => {
    expect(divideRoundHalfUp(100, 3)).toBe(33);
    expect(divideRoundHalfUp(1500, 1000)).toBe(2);
  });
  it('scaled quantity', () => {
    expect(scaledQuantityMicros(500_000, 5_000_000, 1_000_000)).toBe(2_500_000);
  });
});

describe('receipt + cost MWA', () => {
  it('simple receipt and weighted average', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const tomato = await itemId(db, 'Томаты');
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: tomato, quantityMicros: kgToMicros(10), unitCostMicros: 800 }], idempotencyKey: 'r1' }, admin);
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: tomato, quantityMicros: kgToMicros(10), unitCostMicros: 1000 }], idempotencyKey: 'r2' }, admin);
    const bal = db.rows.inventoryStockBalances.find(b => b.stockItemId === tomato) as Row;
    expect(bal.quantityMicros).toBe(kgToMicros(20));
    expect(bal.averageCostMicros).toBe(900); // (10*800+10*1000)/20=900
  });
  it('retry receipt no duplication', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const item = await itemId(db, 'Огурцы');
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: item, quantityMicros: kgToMicros(5), unitCostMicros: 1000 }], idempotencyKey: 'r-dup' }, admin);
    const second = await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: item, quantityMicros: kgToMicros(5), unitCostMicros: 1000 }], idempotencyKey: 'r-dup' }, admin);
    expect(second.status).toBe(200);
    expect(db.rows.inventoryStockMovements.length).toBe(1);
    expect((second.body as { replay: boolean }).replay).toBe(true);
  });
});

describe('recipe cycle', () => {
  it('self-cycle rejected', async () => {
    const db = new FakeDb();
    const ogonek = await itemId(db, 'Огонёк', 'SEMI_FINISHED');
    const res = await executeUpsertRecipe(db as any, { label: 'Огонёк', targetKind: 'SEMI_FINISHED', targetId: ogonek, lines: [{ stockItemId: ogonek, quantityMicros: 500_000 }], yieldQuantityMicros: 1_000_000, idempotencyKey: 'rec1' }, admin);
    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('RECIPE_CYCLE');
  });
  it('indirect cycle A→B→A rejected', async () => {
    const db = new FakeDb();
    const a = await itemId(db, 'Соус A', 'SEMI_FINISHED');
    const b = await itemId(db, 'Заготовка B', 'SEMI_FINISHED');
    await executeUpsertRecipe(db as any, { label: 'B', targetKind: 'SEMI_FINISHED', targetId: b, lines: [{ stockItemId: a, quantityMicros: 100_000 }], yieldQuantityMicros: 1_000_000, idempotencyKey: 'r-b' }, admin);
    const res = await executeUpsertRecipe(db as any, { label: 'A', targetKind: 'SEMI_FINISHED', targetId: a, lines: [{ stockItemId: b, quantityMicros: 100_000 }], yieldQuantityMicros: 1_000_000, idempotencyKey: 'r-a' }, admin);
    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('RECIPE_CYCLE');
  });
});

describe('production', () => {
  it('scale x5 production', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const tomato = await itemId(db, 'Помидоры');
    const other = await itemId(db, 'Перец');
    const ogonek = await itemId(db, 'Огонёк2', 'SEMI_FINISHED');
    // receipt raw
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: tomato, quantityMicros: kgToMicros(10), unitCostMicros: 800 }, { stockItemId: other, quantityMicros: kgToMicros(10), unitCostMicros: 1000 }], idempotencyKey: 'rcpt1' }, admin);
    // recipe 1kg ogonek: 500g tomato + 500g other
    await executeUpsertRecipe(db as any, { label: 'Огонёк2', targetKind: 'SEMI_FINISHED', targetId: ogonek, lines: [{ stockItemId: tomato, quantityMicros: 500_000 }, { stockItemId: other, quantityMicros: 500_000 }], yieldQuantityMicros: 1_000_000, idempotencyKey: 'rec-og2' }, admin);
    await executeProduceSemi(db as any, { stockItemId: ogonek, quantityMicros: kgToMicros(5), locationId: k, idempotencyKey: 'prod1' }, admin);
    const balTom = db.rows.inventoryStockBalances.find(b => b.stockItemId === tomato) as Row;
    const balOther = db.rows.inventoryStockBalances.find(b => b.stockItemId === other) as Row;
    const balOg = db.rows.inventoryStockBalances.find(b => b.stockItemId === ogonek) as Row;
    expect(balTom.quantityMicros).toBe(kgToMicros(10) - kgToMicros(2.5));
    expect(balOther.quantityMicros).toBe(kgToMicros(10) - kgToMicros(2.5));
    expect(balOg.quantityMicros).toBe(kgToMicros(5));
  });
  it('retry production no duplicate', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const t = await itemId(db, 'M1');
    const s = await itemId(db, 'S1', 'SEMI_FINISHED');
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: t, quantityMicros: kgToMicros(10), unitCostMicros: 1000 }], idempotencyKey: 'rc' }, admin);
    await executeUpsertRecipe(db as any, { label: 's', targetKind: 'SEMI_FINISHED', targetId: s, lines: [{ stockItemId: t, quantityMicros: 1_000_000 }], yieldQuantityMicros: 1_000_000, idempotencyKey: 'rr' }, admin);
    await executeProduceSemi(db as any, { stockItemId: s, quantityMicros: kgToMicros(1), locationId: k, idempotencyKey: 'pdup' }, admin);
    const second = await executeProduceSemi(db as any, { stockItemId: s, quantityMicros: kgToMicros(1), locationId: k, idempotencyKey: 'pdup' }, admin);
    expect(second.status).toBe(200);
    expect(db.rows.inventoryStockMovements.filter(m => m.sourceId === 'pdup').length).toBe(2); // IN+OUT
  });
});

describe('sale consumption no recursive explosion', () => {
  it('sale consumes semi, not its ingredients', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const tomato = await itemId(db, 'Tom');
    const other = await itemId(db, 'Oth');
    const ogonek = await itemId(db, 'Og', 'SEMI_FINISHED');
    const saladMenu = 'menu-salad-1';
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: tomato, quantityMicros: kgToMicros(10), unitCostMicros: 800 }, { stockItemId: other, quantityMicros: kgToMicros(10), unitCostMicros: 1000 }], idempotencyKey: 'rc2' }, admin);
    await executeUpsertRecipe(db as any, { label: 'og', targetKind: 'SEMI_FINISHED', targetId: ogonek, lines: [{ stockItemId: tomato, quantityMicros: 500_000 }, { stockItemId: other, quantityMicros: 500_000 }], yieldQuantityMicros: 1_000_000, idempotencyKey: 'rec-og' }, admin);
    await executeProduceSemi(db as any, { stockItemId: ogonek, quantityMicros: kgToMicros(4), locationId: k, idempotencyKey: 'prod-og' }, admin);
    // salad recipe: 50g tomato +50 cucumber +20g ogonek
    const cucumber = await itemId(db, 'Cuc');
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: cucumber, quantityMicros: kgToMicros(5), unitCostMicros: 700 }], idempotencyKey: 'rc3' }, admin);
    await executeUpsertRecipe(db as any, { label: 'Салат', targetKind: 'MENU_ITEM', targetId: saladMenu, defaultLocationId: k, lines: [{ stockItemId: tomato, quantityMicros: 50_000 }, { stockItemId: cucumber, quantityMicros: 50_000 }, { stockItemId: ogonek, quantityMicros: 20_000 }], yieldQuantityMicros: 1000, idempotencyKey: 'rec-salad' }, admin);
    // close order with 10 salads
    const orderId = 'order-100';
    const lines = [{ id: 'line-1', menuItemId: saladMenu, quantity: 10, status: 'ACTIVE', createdAt: new Date().toISOString() }];
    await processConsumptionRequest(db as any, orderId, lines);
    const balTom = db.rows.inventoryStockBalances.find(b => b.stockItemId === tomato) as Row;
    const balOg = db.rows.inventoryStockBalances.find(b => b.stockItemId === ogonek) as Row;
    const balCuc = db.rows.inventoryStockBalances.find(b => b.stockItemId === cucumber) as Row;
    expect(balCuc).toBeDefined();
    // tomato: start 10kg -2kg prod =8kg -0.5kg sale (50g*10)=500g => 7500g
    expect(balTom.quantityMicros).toBe(kgToMicros(10) - kgToMicros(2) - 500_000);
    expect(balOg.quantityMicros).toBe(kgToMicros(4) - 200_000);
    // Not exploding ogonek ingredients: tomato should NOT additionally lose 100g (20g ogonek *0.5)
    // If exploded, tomato would be -100g more; we assert not.
    expect(balTom.quantityMicros).not.toBe(kgToMicros(10) - kgToMicros(2) - 600_000);
  });
});

describe('transfer', () => {
  it('preserves global qty', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const b = await locId(db, 'Бар');
    const it = await itemId(db, 'Cola');
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: it, quantityMicros: kgToMicros(10), unitCostMicros: 1000 }], idempotencyKey: 'rc-t' }, admin);
    await executeTransferStock(db as any, { stockItemId: it, quantityMicros: kgToMicros(2), sourceLocationId: k, destLocationId: b, idempotencyKey: 'tr1' }, admin);
    const bk = db.rows.inventoryStockBalances.find(x => x.locationId === k) as Row;
    const bb = db.rows.inventoryStockBalances.find(x => x.locationId === b) as Row;
    expect(bk.quantityMicros).toBe(kgToMicros(8));
    expect(bb.quantityMicros).toBe(kgToMicros(2));
  });
  it('retry transfer unchanged', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const s = await locId(db, 'Шашлыки');
    const it = await itemId(db, 'X');
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: it, quantityMicros: kgToMicros(5), unitCostMicros: 500 }], idempotencyKey: 'rcx' }, admin);
    await executeTransferStock(db as any, { stockItemId: it, quantityMicros: kgToMicros(1), sourceLocationId: k, destLocationId: s, idempotencyKey: 'trdup' }, admin);
    const second = await executeTransferStock(db as any, { stockItemId: it, quantityMicros: kgToMicros(1), sourceLocationId: k, destLocationId: s, idempotencyKey: 'trdup' }, admin);
    expect(second.status).toBe(200);
    expect(db.rows.inventoryStockMovements.length).toBe(3); // receipt + out+in
  });
});

describe('revision', () => {
  it('shortage and stale detection', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const it = await itemId(db, 'TomRev');
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: it, quantityMicros: kgToMicros(10), unitCostMicros: 1000 }], idempotencyKey: 'r-rev' }, admin);
    const c = await executeCreateCount(db as any, { label: 'Rev1', locationId: k, idempotencyKey: 'cnt1' }, admin);
    const cid = (c.body as { countId: string }).countId;
    await executeStartCount(db as any, { countId: cid }, admin);
    // shortage: expected 10, actual 9 => variance -1
    await executeFinalizeCount(db as any, { countId: cid, actuals: [{ stockItemId: it, actualQuantityMicros: kgToMicros(9) }], idempotencyKey: 'fin1' }, admin);
    const bal = db.rows.inventoryStockBalances.find(b => b.stockItemId === it) as Row;
    expect(bal.quantityMicros).toBe(kgToMicros(9));
    // double finalize no duplicate
    const second = await executeFinalizeCount(db as any, { countId: cid, actuals: [{ stockItemId: it, actualQuantityMicros: kgToMicros(9) }], idempotencyKey: 'fin1' }, admin);
    expect(second.status).toBe(200);
    expect(db.rows.inventoryStockMovements.filter(m=>m.sourceId==='fin1').length).toBe(1);
  });
  it('positive semi unrecorded production', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const tomato = await itemId(db, 'Tom2');
    const other = await itemId(db, 'Other2');
    const og = await itemId(db, 'Og2', 'SEMI_FINISHED');
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: tomato, quantityMicros: kgToMicros(10), unitCostMicros: 800 }, { stockItemId: other, quantityMicros: kgToMicros(10), unitCostMicros: 1000 }], idempotencyKey: 'rr1' }, admin);
    await executeUpsertRecipe(db as any, { label: 'og', targetKind: 'SEMI_FINISHED', targetId: og, lines: [{ stockItemId: tomato, quantityMicros: 500_000 }, { stockItemId: other, quantityMicros: 500_000 }], yieldQuantityMicros: 1_000_000, idempotencyKey: 'rec-og2' }, admin);
    const cnt = await executeCreateCount(db as any, { label: 'Rev', locationId: k, idempotencyKey: 'cnt2' }, admin);
    const cid = (cnt.body as { countId: string }).countId;
    await executeStartCount(db as any, { countId: cid }, admin);
    // expected 0, actual 1kg with resolution UNRECORDED_PRODUCTION
    await executeFinalizeCount(db as any, { countId: cid, actuals: [{ stockItemId: og, actualQuantityMicros: kgToMicros(1), resolution: 'UNRECORDED_PRODUCTION' }], idempotencyKey: 'fin2' }, admin);
    const balOg = db.rows.inventoryStockBalances.find(b=>b.stockItemId===og) as Row;
    const balTom = db.rows.inventoryStockBalances.find(b=>b.stockItemId===tomato) as Row;
    expect(balOg.quantityMicros).toBe(kgToMicros(1));
    expect(balTom.quantityMicros).toBe(kgToMicros(10) - 500_000);
    // second revision no double consumption
    const cnt2 = await executeCreateCount(db as any, { label: 'Rev2', locationId: k, idempotencyKey: 'cnt3' }, admin);
    const cid2 = (cnt2.body as { countId: string }).countId;
    await executeStartCount(db as any, { countId: cid2 }, admin);
    await executeFinalizeCount(db as any, { countId: cid2, actuals: [{ stockItemId: og, actualQuantityMicros: kgToMicros(1) }], idempotencyKey: 'fin3' }, admin);
    const balTomAfter = db.rows.inventoryStockBalances.find(b=>b.stockItemId===tomato) as Row;
    expect(balTomAfter.quantityMicros).toBe(balTom.quantityMicros); // no extra
  });
  it('stale detected', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const it = await itemId(db, 'Stale');
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: it, quantityMicros: kgToMicros(5), unitCostMicros: 100 }], idempotencyKey: 's1' }, admin);
    const cnt = await executeCreateCount(db as any, { label: 'S', locationId: k, idempotencyKey: 'cntS' }, admin);
    const cid = (cnt.body as { countId: string }).countId;
    await executeStartCount(db as any, { countId: cid }, admin);
    // concurrent movement after start
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: it, quantityMicros: kgToMicros(1), unitCostMicros: 100 }], idempotencyKey: 's2' }, admin);
    const res = await executeFinalizeCount(db as any, { countId: cid, actuals: [{ stockItemId: it, actualQuantityMicros: kgToMicros(5) }], idempotencyKey: 'fins' }, admin);
    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('REVISION_STALE');
  });
});

describe('projection ledger equality', () => {
  it('ledger sum equals balance', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const it = await itemId(db, 'Proj');
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: it, quantityMicros: kgToMicros(3), unitCostMicros: 100 }], idempotencyKey: 'p1' }, admin);
    await executeWriteOffStock(db as any, { stockItemId: it, locationId: k, quantityMicros: kgToMicros(1), idempotencyKey: 'w1' }, admin);
    const sum = db.rows.inventoryStockMovements.filter(m=>m.stockItemId===it).reduce((s,m)=>s+(m.quantityDeltaMicros as number),0);
    const bal = db.rows.inventoryStockBalances.find(b=>b.stockItemId===it) as Row;
    expect(sum).toBe(bal.quantityMicros);
  });
});

describe('prepared void', () => {
  it('prepared consumes, not prepared does not', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const it = await itemId(db, 'ProdPrep');
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: it, quantityMicros: kgToMicros(5), unitCostMicros: 100 }], idempotencyKey: 'rcp' }, admin);
    const menu = 'menu-prep';
    await executeUpsertRecipe(db as any, { label: 'm', targetKind: 'MENU_ITEM', targetId: menu, defaultLocationId: k, lines: [{ stockItemId: it, quantityMicros: 100_000 }], yieldQuantityMicros: 1000, idempotencyKey: 'rec-prep' }, admin);
    const orderId = 'ord-prep';
    await processConsumptionRequest(db as any, orderId, [
      { id: 'l1', menuItemId: menu, quantity: 1, status: 'VOIDED', voidPreparedState: 'PREPARED', createdAt: new Date().toISOString() },
      { id: 'l2', menuItemId: menu, quantity: 1, status: 'VOIDED', voidPreparedState: 'NOT_PREPARED', createdAt: new Date().toISOString() },
    ]);
    const movs = db.rows.inventoryStockMovements.filter(m=>m.sourceId===orderId);
    expect(movs.length).toBe(1); // only PREPARED
    expect(movs[0].movementType).toBe('PREPARED_VOID_CONSUMPTION');
  });
});

describe('negative stock', () => {
  it('allows negative and warns', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const it = await itemId(db, 'Neg');
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: it, quantityMicros: gramsToMicros(100), unitCostMicros: 900 }], idempotencyKey: 'neg1' }, admin);
    const menu = 'menu-neg';
    await executeUpsertRecipe(db as any, { label: 'neg', targetKind: 'MENU_ITEM', targetId: menu, defaultLocationId: k, lines: [{ stockItemId: it, quantityMicros: 200_000 }], yieldQuantityMicros: 1000, idempotencyKey: 'rec-neg' }, admin);
    await processConsumptionRequest(db as any, 'ord-neg', [{ id: 'l1', menuItemId: menu, quantity: 1, status: 'ACTIVE', createdAt: new Date().toISOString() }]);
    const bal = db.rows.inventoryStockBalances.find(b=>b.stockItemId===it) as Row;
    expect(bal.quantityMicros).toBe(gramsToMicros(100) - 200_000); // -100g
    expect(bal.quantityMicros).toBeLessThan(0);
  });
});

describe('cost deterministic', () => {
  it('production cost snapshot', async () => {
    const db = new FakeDb();
    const k = await locId(db, 'Кухня');
    const a = await itemId(db, 'A');
    const b = await itemId(db, 'B');
    const s = await itemId(db, 'S', 'SEMI_FINISHED');
    await executeReceiveStock(db as any, { locationId: k, lines: [{ stockItemId: a, quantityMicros: kgToMicros(10), unitCostMicros: 800 }, { stockItemId: b, quantityMicros: kgToMicros(10), unitCostMicros: 1000 }], idempotencyKey: 'costrc' }, admin);
    await executeUpsertRecipe(db as any, { label: 's', targetKind: 'SEMI_FINISHED', targetId: s, lines: [{ stockItemId: a, quantityMicros: 500_000 }, { stockItemId: b, quantityMicros: 500_000 }], yieldQuantityMicros: 1_000_000, idempotencyKey: 'costrec' }, admin);
    const res = await executeProduceSemi(db as any, { stockItemId: s, quantityMicros: kgToMicros(1), locationId: k, idempotencyKey: 'costprod' }, admin);
    expect((res.body as { unitCostMicros: number }).unitCostMicros).toBe(900); // (0.5*800+0.5*1000)/1 =900
  });
});
