import { describe, expect, it, vi } from 'vitest';
import { recoverInventory } from 'src/inventory/inventory-recovery';
import { FakeRuntimeState } from 'src/server/__tests__/fake-runtime-state';

class RecoveryDb {
  state = new FakeRuntimeState();
  orders = Array.from({ length: 65 }, (_, i) => ({ id: `order-${i}` }));
  requests: Array<{ id: string; orderId: string; status: string }> = [];
  query = async (doc: any) => {
    const [root, op] = Object.entries(doc)[0] as [string, any];
    if (root === 'mahabbatRuntimeStates') return this.state.query(op);
    const all = root === 'posOrders' ? this.orders : this.requests.filter(row => op.__args.filter.orderId ? row.orderId === op.__args.filter.orderId.eq : row.status === 'PENDING');
    // Cursor identifies a record, not an offset in a changing filtered array.
    const after = Number(op.__args.after ?? -1);
    const indexed = all.map(row => ({ row, position: Number(row.id.split('-').pop()) })).filter(v => v.position > after);
    const page = indexed.slice(0, op.__args.first);
    return { [root]: { edges: page.map(v => ({ node: { ...v.row }, cursor: String(v.position) })), pageInfo: { hasNextPage: indexed.length > page.length } } };
  };
  mutation = async (doc: any) => {
    const [root, op] = Object.entries(doc)[0] as [string, any];
    if (root.includes('MahabbatRuntimeState')) return this.state.mutation(root, op);
    const row = { ...op.__args.data, id: op.__args.data.orderId };
    if (this.requests.some(r => r.orderId === row.orderId)) throw new Error('duplicate');
    this.requests.push(row);
    return { [root]: row };
  };
}

describe('bounded durable inventory recovery', () => {
  it('reaches missing requests beyond fifty closed orders across fresh invocations', async () => {
    const db = new RecoveryDb();
    for (let i = 0; i < 8; i += 1) await recoverInventory(db, async orderId => { db.requests.find(r => r.orderId === orderId)!.status = 'APPLIED'; });
    expect(db.requests).toHaveLength(65);
    expect(db.requests.filter(r => r.status === 'APPLIED')).toHaveLength(65);
  });
  it('does not let a poison request starve later requests and revisits it on wrap', async () => {
    const db = new RecoveryDb(); db.orders = [];
    db.requests = Array.from({ length: 65 }, (_, i) => ({ id: `order-${i}`, orderId: `order-${i}`, status: 'PENDING' }));
    let failures = 0;
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (let i = 0; i < 8; i += 1) await recoverInventory(db, async id => {
        if (id === 'order-0') { failures += 1; throw new Error('poison'); }
        db.requests.find(r => r.orderId === id)!.status = 'APPLIED';
      });
      expect(db.requests.filter(r => r.status === 'APPLIED')).toHaveLength(64);
      expect(failures).toBeGreaterThan(1);
    } finally { log.mockRestore(); }
  });
});
