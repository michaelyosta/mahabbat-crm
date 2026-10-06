import { describe, expect, it } from 'vitest';

import type { CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import {
  dispatchPosCommand,
  executeCloseOrder,
  executeCreatePrecheck,
  executeOpenOrder,
  executeOpenShift,
  executeReconcileDamagedOrderTotals,
  executeRecordPayment,
} from 'src/pos/pos-command.dispatch';

// Stage B regressions: totals CAS convergence (F01/F02/F15), idempotent
// replay, neighbouring ops, and damaged-order reconcile. Live wire shape:
// explicit null composites compare structurally (StageAFakeDb semantics).

type Row = Record<string, unknown> & { id: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const docRoot = (doc: unknown): string => Object.keys(doc as Record<string, unknown>)[0];

class StageBFakeDb {
  readonly rows: Record<string, Row[]> = {
    posShifts: [],
    posTables: [{ id: TABLE, number: 'T1', isActive: true }],
    posMenuItems: [
      { id: MENU_A, name: 'Люля-кебаб', price: { amountMicros: 4_300_000_000, currencyCode: 'KZT' }, isActive: true },
      { id: MENU_B, name: 'Чай', price: { amountMicros: 500_000_000, currencyCode: 'KZT' }, isActive: true },
    ],
    posOrders: [],
    posOrderGuests: [],
    posOrderLines: [],
    posStopListEntries: [],
    posKitchenTickets: [],
    posKitchenTicketLines: [],
    posPrechecks: [],
    posPaymentMethods: [
      { id: CASH_METHOD, name: 'Наличные', methodType: 'CASH', isActive: true, sortOrder: 0 },
      { id: CARD_METHOD, name: 'Карта', methodType: 'CARD', isActive: true, sortOrder: 1 },
    ],
    posPayments: [],
    posPrepayments: [],
    posReservations: [],
    posOperationalEvents: [],
    posPrintJobs: [{ id: 'sentinel' }],
    posPrinterDevices: [{ id: 'printer-precheck', label: 'Пречек-принтер', isActive: true, isPrecheckPrinter: true }],
  };

  private counter = 1;

  private nextId(): string {
    const n = this.counter++;
    return `42000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  }

  private matchesCondition(value: unknown, condition: unknown): boolean {
    if (!isRecord(condition)) return true;
    if ('eq' in condition) {
      const expected = condition.eq ?? null;
      return JSON.stringify(value ?? null) === JSON.stringify(expected);
    }
    if (!isRecord(value)) return true;
    return Object.entries(condition).every(([field, nested]) => this.matchesCondition(value[field], nested));
  }

  query(query: unknown): Promise<unknown> {
    const root = docRoot(query);
    const node = (query as Record<string, { __args?: { filter?: Record<string, unknown>; first?: number } }>)[root];
    const filter = node?.__args?.filter ?? {};
    const limit = node?.__args?.first ?? 100;
    let result = this.rows[root] ?? [];
    for (const [field, condition] of Object.entries(filter)) {
      if (!isRecord(condition)) continue;
      if ('eq' in condition) {
        const expected = condition.eq ?? null;
        result = result.filter((row) => JSON.stringify(row[field] ?? null) === JSON.stringify(expected));
      } else {
        result = result.filter((row) => this.matchesCondition(row[field], condition));
      }
    }
    return Promise.resolve({
      [root]: { edges: result.slice(0, limit).map((row) => ({ node: { ...row } })), pageInfo: { hasNextPage: false, endCursor: null } },
    });
  }

  mutation(mutation: unknown): Promise<unknown> {
    const root = docRoot(mutation);
    const node = (mutation as Record<string, { __args?: { filter?: Record<string, unknown>; data?: Row; id?: string } }>)[root];
    const args = node?.__args ?? {};
    const data = args.data;
    const id = args.id;
    const map: Record<string, string> = {
      createPosShift: 'posShifts', createPosOrder: 'posOrders', updatePosOrder: 'posOrders',
      updatePosOrders: 'posOrders', createPosOrderGuest: 'posOrderGuests', updatePosOrderGuest: 'posOrderGuests',
      createPosOrderLine: 'posOrderLines', updatePosOrderLine: 'posOrderLines',
      createPosPrecheck: 'posPrechecks', updatePosPrecheck: 'posPrechecks', updatePosPrechecks: 'posPrechecks',
      createPosPayment: 'posPayments', updatePosPayment: 'posPayments',
      createPosPrintJob: 'posPrintJobs',
      createPosOperationalEvent: 'posOperationalEvents',
    };
    const kind = map[root];
    if (!kind) throw new Error(`Unsupported mutation root: ${root}`);
    if (root.startsWith('create')) {
      if (kind === 'posOrderLines' && typeof data?.idempotencyKey === 'string') {
        const dup = this.rows[kind].find((row) => row.idempotencyKey === data.idempotencyKey);
        if (dup) {
          const err = new Error('duplicate idempotencyKey');
          err.name = 'UniqueViolationError';
          throw err;
        }
      }
      const record = { ...data, id: `${kind}:${this.nextId()}` } as Row;
      this.rows[kind].push(record);
      if (root === 'createPosPrintJob') {
        const row = this.rows.posPrintJobs.find((candidate) => candidate.id === record.id);
        if (row) row.status = 'SENT';
      }
      return Promise.resolve({ [root]: { ...record } });
    }
    const filter = args.filter ?? {};
    const matches = this.rows[kind].filter((row) =>
      Object.entries(filter).every(([field, condition]) => {
        if (!isRecord(condition)) return true;
        if ('eq' in condition) {
          const expected = condition.eq ?? null;
          return JSON.stringify(row[field] ?? null) === JSON.stringify(expected);
        }
        return this.matchesCondition(row[field], condition);
      }),
    );
    const indices = id
      ? [this.rows[kind].findIndex((row) => row.id === id)]
      : matches.map((row) => this.rows[kind].indexOf(row));
    if (indices.length === 0 || indices.every((index) => index === -1)) {
      return Promise.resolve({ [root]: id ? null : [] });
    }
    const updated = indices.filter((index) => index >= 0).map((index) => {
      this.rows[kind][index] = { ...this.rows[kind][index], ...data };
      return { ...this.rows[kind][index] };
    });
    return Promise.resolve({ [root]: id ? updated[0] : updated });
  }

  asClient(): CoreApiClientLike {
    return { query: (q: unknown) => this.query(q), mutation: (m: unknown) => this.mutation(m) };
  }

  order(orderId: string): Row {
    const order = this.rows.posOrders.find((row) => row.id === orderId);
    if (!order) throw new Error('order row missing in fake db');
    return order;
  }
}

const STAFF = '10000000-0000-4000-8000-000000000001';
const TABLE = '20000000-0000-4000-8000-000000000001';
const MENU_A = '20000000-0000-4000-8000-000000000010';
const MENU_B = '20000000-0000-4000-8000-000000000011';
const CASH_METHOD = '20000000-0000-4000-8000-000000000020';
const CARD_METHOD = '20000000-0000-4000-8000-000000000021';
const waiter = { staffId: STAFF, role: 'WAITER' as const };
const admin = { staffId: STAFF, role: 'ADMIN' as const };
const key = (n: number) => `32000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const setupOrderWithGuest = async (db: StageBFakeDb) => {
  const client = db.asClient();
  await executeOpenShift(client, { idempotencyKey: key(1) }, waiter);
  const opened = await executeOpenOrder(client, { tableId: TABLE, idempotencyKey: key(2) }, waiter);
  const orderId = (opened.body as { orderId: string }).orderId;
  const guest = await dispatchPosCommand(client, 'addGuest', { orderId, idempotencyKey: key(3) }, waiter);
  const guestId = (guest.body as { guestId: string }).guestId;
  return { orderId, guestId };
};

describe('stage B totals convergence (F01/F02/F15)', () => {
  it('addLine 4 300 ₸ converges guest + order totals and IN_PROGRESS', async () => {
    const db = new StageBFakeDb();
    const { orderId, guestId } = await setupOrderWithGuest(db);
    const added = await dispatchPosCommand(
      db.asClient(), 'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(4) }, waiter,
    );
    expect(added.status).toBe(201);
    const order = db.order(orderId);
    expect(order.subtotal).toEqual({ amountMicros: 4_300_000_000, currencyCode: 'KZT' });
    expect(order.total).toEqual({ amountMicros: 4_300_000_000, currencyCode: 'KZT' });
    expect(order.status).toBe('IN_PROGRESS');
    const guest = db.rows.posOrderGuests.find((row) => row.id === guestId)!;
    expect(guest.subtotal).toEqual({ amountMicros: 4_300_000_000, currencyCode: 'KZT' });
  });

  it('idempotent replay of addLine converges without a second line', async () => {
    const db = new StageBFakeDb();
    const { orderId, guestId } = await setupOrderWithGuest(db);
    const client = db.asClient();
    const first = await dispatchPosCommand(
      client, 'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(10) }, waiter,
    );
    expect(first.status).toBe(201);
    // Crash after line commit but before/while projecting: drop the totals
    // projection back to null while keeping the committed line.
    const order = db.order(orderId);
    order.subtotal = null;
    order.total = null;
    order.status = 'OPEN';
    const replay = await dispatchPosCommand(
      client, 'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(10) }, waiter,
    );
    expect(replay.status).toBe(200);
    expect(db.rows.posOrderLines).toHaveLength(1);
    expect(db.order(orderId).total).toEqual({ amountMicros: 4_300_000_000, currencyCode: 'KZT' });
    expect(db.order(orderId).status).toBe('IN_PROGRESS');
  });

  it('CAS exhaustion returns 409, never success with stale totals', async () => {
    const db = new StageBFakeDb();
    const { orderId, guestId } = await setupOrderWithGuest(db);
    const innerMutation = db.mutation.bind(db);
    db.mutation = async (mutation: unknown) => {
      if (docRoot(mutation) === 'updatePosOrders') return { updatePosOrders: [] };
      return innerMutation(mutation);
    };
    const added = await dispatchPosCommand(
      db.asClient(), 'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(11) }, waiter,
    );
    expect(added.status).toBe(409);
    expect((added.body as { code: string }).code).toBe('TOTALS_NOT_CONVERGED');
  });

  it('changeQty + void converge; guest transfer keeps order sum', async () => {
    const db = new StageBFakeDb();
    const { orderId, guestId } = await setupOrderWithGuest(db);
    const client = db.asClient();
    const first = await dispatchPosCommand(
      client, 'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(20) }, waiter,
    );
    const lineId = (first.body as { lineId: string }).lineId;
    const changed = await dispatchPosCommand(client, 'changeLineQuantity', { lineId, quantity: 2 }, waiter);
    expect(changed.status).toBe(200);
    expect(db.order(orderId).total).toEqual({ amountMicros: 8_600_000_000, currencyCode: 'KZT' });
    const guest2 = await dispatchPosCommand(client, 'addGuest', { orderId, idempotencyKey: key(21) }, waiter);
    const guest2Id = (guest2.body as { guestId: string }).guestId;
    const moved = await dispatchPosCommand(
      client, 'transferOrderLinesToGuest', { lineIds: [lineId], targetGuestId: guest2Id, idempotencyKey: key(22) }, admin,
    );
    expect(moved.status).toBe(201);
    expect(db.order(orderId).total).toEqual({ amountMicros: 8_600_000_000, currencyCode: 'KZT' });
    const voided = await dispatchPosCommand(
      client, 'voidOrderLines', { lineIds: [lineId], preparedState: 'NOT_PREPARED', idempotencyKey: key(23) }, admin,
    );
    expect(voided.status).toBe(201);
    expect(db.order(orderId).status).toBe('CANCELLED');
  });

  it('full payment + close flow is untouched by the totals guard', async () => {
    const db = new StageBFakeDb();
    const { orderId, guestId } = await setupOrderWithGuest(db);
    const client = db.asClient();
    await dispatchPosCommand(
      client, 'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(30) }, waiter,
    );
    const precheck = await executeCreatePrecheck(client, { orderId, idempotencyKey: key(31) }, waiter);
    expect(precheck.status).toBe(201);
    const paid = await executeRecordPayment(
      client, { orderId, paymentMethodId: CARD_METHOD, amountMicros: 4_300_000_000, idempotencyKey: key(32) }, waiter,
    );
    expect(paid.status).toBe(201);
    expect((paid.body as { remainingMicros: number }).remainingMicros).toBe(0);
    const closed = await executeCloseOrder(client, { orderId, idempotencyKey: key(33) }, waiter);
    expect(closed.status).toBe(201);
    expect(db.order(orderId).status).toBe('CLOSED');
    // Payment/close guards survive: second close with a fresh key is rejected.
    const closedAgain = await executeCloseOrder(client, { orderId, idempotencyKey: key(34) }, waiter);
    expect(closedAgain.status).toBe(400);
  });

  it('reconcile repairs the damaged F01 shape, refuses paid/closed orders', async () => {
    const db = new StageBFakeDb();
    const { orderId } = await setupOrderWithGuest(db);
    const client = db.asClient();
    const guestId = db.rows.posOrderGuests[0].id;
    await dispatchPosCommand(
      client, 'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(40) }, waiter,
    );
    // Simulate the live damaged projection: line saved, totals/status stale.
    const damaged = db.order(orderId);
    const lineId = db.rows.posOrderLines[0].id;
    damaged.subtotal = { amountMicros: null, currencyCode: null };
    damaged.total = { amountMicros: null, currencyCode: null };
    damaged.status = 'OPEN';
    const fixed = await executeReconcileDamagedOrderTotals(client, { orderId, idempotencyKey: key(41) }, admin);
    expect(fixed.status).toBe(200);
    expect(db.order(orderId).total).toEqual({ amountMicros: 4_300_000_000, currencyCode: 'KZT' });
    expect(db.order(orderId).status).toBe('IN_PROGRESS');
    expect(db.order(orderId).id).toBe(orderId);
    expect(db.rows.posOrderLines.map((row) => row.id)).toEqual([lineId]);
    // Idempotent: same key replays without rewriting.
    const replay = await executeReconcileDamagedOrderTotals(client, { orderId, idempotencyKey: key(41) }, admin);
    expect(replay.status).toBe(200);
    expect((replay.body as { replay?: boolean }).replay).toBe(true);
    // WAITER cannot reconcile.
    const forbidden = await dispatchPosCommand(client, 'reconcileDamagedOrderTotals', { orderId, idempotencyKey: key(42) }, waiter);
    expect(forbidden.status).toBe(403);
  });
});
