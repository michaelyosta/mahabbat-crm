import { describe, expect, it } from 'vitest';

import { executeCloseShift } from 'src/pos/pos-command.dispatch';

type Row = Record<string, unknown> & { id: string };

const STAFF = '10000000-0000-4000-8000-000000000001';
const OTHER_STAFF = '10000000-0000-4000-8000-000000000002';
const waiter = { staffId: STAFF, role: 'WAITER' as const };

// Minimal fake of CoreApiClientLike: only the shapes executeCloseShift uses
// (posShifts/posOrders connection queries with eq filters + updatePosShift
// mutation by id). Deliberately small so the guard cannot pass by accident.
class CloseShiftFakeDb {
  readonly shifts: Row[] = [];
  readonly orders: Row[] = [];

  seedShift(row: Row): Row {
    this.shifts.push(row);
    return row;
  }

  seedOrder(row: Row): Row {
    this.orders.push(row);
    return row;
  }

  private applyEqFilter(rows: Row[], filter: Record<string, unknown>): Row[] {
    let result = rows;
    for (const [field, condition] of Object.entries(filter)) {
      const predicate = condition as Record<string, unknown>;
      if (predicate !== null && typeof predicate === 'object' && 'eq' in predicate) {
        result = result.filter((row) => row[field] === predicate.eq);
      }
    }
    return result;
  }

  query(query: unknown): Promise<unknown> {
    const document = query as Record<string, unknown>;
    const root = Object.keys(document)[0];
    const op = document[root] as Record<string, unknown>;
    const args = (op.__args ?? {}) as Record<string, unknown>;
    const filter = (args.filter ?? {}) as Record<string, unknown>;
    const limit = typeof args.first === 'number' ? args.first : 100;
    const source = root === 'posShifts' ? this.shifts : this.orders;
    const filtered = this.applyEqFilter(source, filter);
    // Cursor pagination: `after` is the endCursor (index) of the previous
    // page. Unknown/absent cursor starts at 0. This mirrors the Twenty
    // connection contract the server paginates with.
    let start = 0;
    if (typeof args.after === 'string' && args.after.length > 0) {
      const parsed = Number.parseInt(args.after, 10);
      start = Number.isNaN(parsed) ? 0 : parsed + 1;
    }
    const page = filtered.slice(start, start + limit);
    const end = start + page.length;
    return Promise.resolve({
      [root]: {
        edges: page.map((row) => ({ node: { ...row } })),
        pageInfo: {
          hasNextPage: end < filtered.length,
          endCursor: page.length > 0 ? String(end - 1) : null,
        },
      },
    });
  }

  mutation(mutation: unknown): Promise<unknown> {
    const document = mutation as Record<string, unknown>;
    const root = Object.keys(document)[0];
    if (root !== 'updatePosShift') {
      throw new Error(`Unsupported mutation root: ${root}`);
    }
    const op = document[root] as Record<string, unknown>;
    const args = op.__args as Record<string, unknown>;
    const id = args.id as string;
    const data = args.data as Row;
    const index = this.shifts.findIndex((row) => row.id === id);
    if (index === -1) return Promise.resolve({ [root]: null });
    this.shifts[index] = { ...this.shifts[index], ...data };
    return Promise.resolve({ [root]: { ...this.shifts[index] } });
  }
}

const SHIFT_ID = 'shift-closeguard-1';

const dbWithOpenShift = (shiftId = SHIFT_ID, staffId = STAFF) => {
  const db = new CloseShiftFakeDb();
  db.seedShift({
    id: shiftId,
    staffId,
    status: 'OPEN',
    isOpen: true,
    openToken: 'token-1',
    closedAt: null,
  });
  return db;
};

describe('closeShift guard against open orders (UI-SPEC IN#1)', () => {
  it.each(['OPEN', 'IN_PROGRESS', 'PRECHECK_PRINTED'] as const)(
    'refuses to close a shift with a %s order and keeps shift and order intact',
    async (orderStatus) => {
      const db = dbWithOpenShift();
      const orderId = `order-${orderStatus}`;
      db.seedOrder({ id: orderId, shiftId: SHIFT_ID, status: orderStatus });

      const result = await executeCloseShift(db, { shiftId: SHIFT_ID }, waiter);

      // Honest refusal: conflict, named code, offending orders listed.
      expect(result.status).toBe(409);
      const body = result.body as {
        code: string;
        detail: Array<{ orderId: string; status: string | null }>;
        orderIds: string[];
      };
      expect(body.code).toBe('SHIFT_HAS_OPEN_ORDERS');
      expect(body.orderIds).toContain(orderId);
      expect(body.detail).toEqual([{ orderId, status: orderStatus }]);

      // Nothing was closed or touched: shift still OPEN, order untouched.
      expect(db.shifts[0].status).toBe('OPEN');
      expect(db.shifts[0].isOpen).toBe(true);
      expect(db.shifts[0].closedAt).toBeNull();
      expect(db.orders).toHaveLength(1);
      expect(db.orders[0].status).toBe(orderStatus);
    },
  );

  it('lists every open order when several block the close', async () => {
    const db = dbWithOpenShift();
    db.seedOrder({ id: 'order-a', shiftId: SHIFT_ID, status: 'OPEN' });
    db.seedOrder({ id: 'order-b', shiftId: SHIFT_ID, status: 'IN_PROGRESS' });
    db.seedOrder({ id: 'order-done', shiftId: SHIFT_ID, status: 'CLOSED' });

    const result = await executeCloseShift(db, { shiftId: SHIFT_ID }, waiter);

    expect(result.status).toBe(409);
    const body = result.body as { code: string; orderIds: string[] };
    expect(body.code).toBe('SHIFT_HAS_OPEN_ORDERS');
    expect([...body.orderIds].sort()).toEqual(['order-a', 'order-b']);
    expect(db.shifts[0].status).toBe('OPEN');
  });

  it('closes the shift once every order is CLOSED or CANCELLED', async () => {
    const db = dbWithOpenShift();
    db.seedOrder({ id: 'order-closed', shiftId: SHIFT_ID, status: 'CLOSED' });
    db.seedOrder({ id: 'order-cancelled', shiftId: SHIFT_ID, status: 'CANCELLED' });

    const result = await executeCloseShift(db, { shiftId: SHIFT_ID }, waiter);

    expect(result.status).toBe(200);
    expect(db.shifts[0].status).toBe('CLOSED');
    expect(db.shifts[0].isOpen).toBeNull();
  });

  it('closes a shift with no orders at all', async () => {
    const db = dbWithOpenShift();

    const result = await executeCloseShift(db, { shiftId: SHIFT_ID }, waiter);

    expect(result.status).toBe(200);
    expect(db.shifts[0].status).toBe('CLOSED');
  });

  it('ignores open orders that belong to another shift', async () => {
    const db = dbWithOpenShift();
    db.seedShift({
      id: 'other-shift',
      staffId: OTHER_STAFF,
      status: 'OPEN',
      isOpen: true,
      openToken: 'token-2',
      closedAt: null,
    });
    db.seedOrder({ id: 'foreign-order', shiftId: 'other-shift', status: 'OPEN' });

    const result = await executeCloseShift(db, { shiftId: SHIFT_ID }, waiter);

    expect(result.status).toBe(200);
    expect(db.shifts.find((row) => row.id === SHIFT_ID)?.status).toBe('CLOSED');
    expect(db.orders).toHaveLength(1);
  });

  it('refuses when the only active order sits past the first page (100 closed + 1 open)', async () => {
    const db = dbWithOpenShift();
    for (let i = 0; i < 100; i += 1) {
      db.seedOrder({ id: `closed-${i}`, shiftId: SHIFT_ID, status: 'CLOSED' });
    }
    db.seedOrder({ id: 'hidden-active', shiftId: SHIFT_ID, status: 'OPEN' });

    const result = await executeCloseShift(db, { shiftId: SHIFT_ID }, waiter);

    expect(result.status).toBe(409);
    expect(db.shifts.find((row) => row.id === SHIFT_ID)?.status).toBe('OPEN');
    expect((result.body as { orderIds: string[] }).orderIds).toContain('hidden-active');
  });

  it('closes when 150 orders are all closed (multi-page, none active)', async () => {
    const db = dbWithOpenShift();
    for (let i = 0; i < 150; i += 1) {
      db.seedOrder({ id: `closed-${i}`, shiftId: SHIFT_ID, status: 'CLOSED' });
    }

    const result = await executeCloseShift(db, { shiftId: SHIFT_ID }, waiter);

    expect(result.status).toBe(200);
    expect(db.shifts.find((row) => row.id === SHIFT_ID)?.status).toBe('CLOSED');
  });
});
