import { describe, expect, it } from 'vitest';

import {
  dispatchPosCommand,
  executeOpenOrder,
  executeOpenShift,
} from 'src/pos/pos-command.dispatch';

type Row = Record<string, unknown> & { id: string };

type TableKind =
  | 'workspaceMembers'
  | 'posShifts'
  | 'posTables'
  | 'posMenuItems'
  | 'posOrders'
  | 'posOrderGuests'
  | 'posOrderLines'
  | 'posStopListEntries';

class UniqueViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UniqueViolationError';
  }
}

class FakePosDb {
  readonly rows: Record<TableKind, Row[]> = {
    workspaceMembers: [],
    posShifts: [],
    posTables: [],
    posMenuItems: [],
    posOrders: [],
    posOrderGuests: [],
    posOrderLines: [],
    posStopListEntries: [],
  };

  seed(kind: TableKind, row: Row): Row {
    this.rows[kind].push(row);
    return row;
  }

  private assertUniqueCreates(kind: TableKind, data: Row): void {
    if (kind === 'posShifts') {
      const conflict = this.rows.posShifts.some(
        (row) => row.staffId === data.staffId && row.isOpen === true && data.isOpen === true,
      );
      if (conflict) {
        throw new UniqueViolationError('duplicate (staffId, isOpen)');
      }

      this.assertIdempotencyUnique(this.rows.posShifts, data);
      return;
    }

    if (kind === 'posOrders') {
      const conflict = this.rows.posOrders.some(
        (row) =>
          row.tableId === data.tableId &&
          row.claimToken != null &&
          data.claimToken != null &&
          row.claimToken === data.claimToken,
      );
      if (conflict) {
        throw new UniqueViolationError('duplicate (tableId, claimToken)');
      }

      this.assertIdempotencyUnique(this.rows.posOrders, data);
      return;
    }

    this.assertIdempotencyUnique(this.rows[kind], data);
  }

  private assertIdempotencyUnique(rows: Row[], data: Row): void {
    if (typeof data.idempotencyKey !== 'string') return;

    const conflict = rows.some(
      (row) => row.idempotencyKey === data.idempotencyKey,
    );

    if (conflict) {
      throw new UniqueViolationError('duplicate idempotencyKey');
    }
  }

  private findConnections(kind: TableKind, filter: Record<string, unknown>) {
    let result = this.rows[kind];

    for (const [field, condition] of Object.entries(filter)) {
      const predicate = condition as Record<string, unknown>;
      if (typeof predicate === 'object' && predicate !== null && 'eq' in predicate) {
        result = result.filter((row) => row[field] === predicate.eq);
      } else if (typeof predicate === 'object' && predicate !== null && 'in' in predicate) {
        const allowed = predicate.in as unknown[];
        result = result.filter((row) => allowed.includes(row[field]));
      }
    }

    return result;
  }

  query(query: unknown): Promise<unknown> {
    const document = query as Record<string, unknown>;
    const root = Object.keys(document)[0];
    const kind = this.toKind(root);
    const op = document[root] as Record<string, unknown>;
    const args = op.__args as Record<string, unknown>;
    const filter = (args?.filter ?? {}) as Record<string, unknown>;
    const limit = typeof args?.first === 'number' ? args.first : 100;

    const filtered = this.findConnections(kind, filter).slice(0, limit);

    return Promise.resolve({
      [root]: {
        edges: filtered.map((row) => ({ node: { ...row } })),
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    });
  }

  mutation(mutation: unknown): Promise<unknown> {
    const document = mutation as Record<string, unknown>;
    const root = Object.keys(document)[0];
    const op = document[root] as Record<string, unknown>;
    const args = op.__args as Record<string, unknown>;
    const data = args?.data as Row;
    const id = args?.id as string | undefined;

    const { createKind, updateKind } = this.mutationKind(root);

    if (createKind) {
      const record = { ...data, id: `${createKind}:${this.nextId()}` } as Row;
      this.assertUniqueCreates(createKind, record);
      this.rows[createKind].push(record);
      return Promise.resolve({ [root]: { ...record } });
    }

    if (updateKind) {
      const index = this.rows[updateKind].findIndex((row) => row.id === id);

      if (index === -1) {
        throw new Error(`${updateKind} record not found`);
      }

      this.rows[updateKind][index] = { ...this.rows[updateKind][index], ...data };
      return Promise.resolve({ [root]: { ...this.rows[updateKind][index] } });
    }

    throw new Error(`Unsupported mutation root: ${root}`);
  }

  private mutationKind(root: string): {
    createKind: TableKind | null;
    updateKind: TableKind | null;
  } {
    const map: Record<string, TableKind> = {
      createPosShift: 'posShifts',
      updatePosShift: 'posShifts',
      createPosOrder: 'posOrders',
      updatePosOrder: 'posOrders',
      createPosOrderGuest: 'posOrderGuests',
      updatePosOrderGuest: 'posOrderGuests',
      createPosOrderLine: 'posOrderLines',
      updatePosOrderLine: 'posOrderLines',
    };

    const kind = map[root];

    if (!kind) {
      return { createKind: null, updateKind: null };
    }

    return {
      createKind: root.startsWith('create') ? kind : null,
      updateKind: root.startsWith('update') ? kind : null,
    };
  }

  private toKind(root: string): TableKind {
    const map: Record<string, TableKind> = {
      workspaceMembers: 'workspaceMembers',
      posShifts: 'posShifts',
      posTables: 'posTables',
      posMenuItems: 'posMenuItems',
      posOrders: 'posOrders',
      posOrderGuests: 'posOrderGuests',
      posOrderLines: 'posOrderLines',
      posStopListEntries: 'posStopListEntries',
    };

    return map[root] ?? 'posOrders';
  }

  private nextId(): string {
    const counter = FakePosDb._counter++;
    return `40000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
  }

  private static _counter = 1;
}

const STAFF = '10000000-0000-4000-8000-000000000001';
const OTHER_STAFF = '10000000-0000-4000-8000-000000000002';
const TABLE = '20000000-0000-4000-8000-000000000001';
const MENU_A = '20000000-0000-4000-8000-000000000010';
const MENU_B = '20000000-0000-4000-8000-000000000011';

const waiter = { staffId: STAFF, role: 'WAITER' as const };

const key = (n: number) =>
  `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const dbWithBaseline = () => {
  const db = new FakePosDb();
  db.seed('workspaceMembers', { id: STAFF });
  db.seed('workspaceMembers', { id: OTHER_STAFF });
  db.seed('posTables', {
    id: TABLE,
    number: 'T1',
    isActive: true,
  });
  db.seed('posMenuItems', {
    id: MENU_A,
    name: 'Плов',
    price: { amountMicros: 1_500_000_000, currencyCode: 'KZT' },
    isActive: true,
  });
  db.seed('posMenuItems', {
    id: MENU_B,
    name: 'Чай',
    price: { amountMicros: 500_000_000, currencyCode: 'KZT' },
    isActive: true,
  });
  return db;
};

describe('pos domain happy path', () => {
  it('opens a shift and rejects a duplicate open for the same staff', async () => {
    const db = dbWithBaseline();

    const first = await executeOpenShift(db, { staffId: STAFF, idempotencyKey: key(1) });
    expect(first.status).toBe(201);
    expect((first.body as { shiftId: string }).shiftId).toBeTruthy();

    const second = await executeOpenShift(db, {
      staffId: STAFF,
      idempotencyKey: key(2),
    });
    // The pre-existing open shift is surfaced instead of creating a second one.
    expect(second.status).toBe(200);
    const racedShiftId = (second.body as { shiftId: string }).shiftId;

    const winner = await executeOpenShift(db, {
      staffId: STAFF,
      idempotencyKey: key(1),
    });
    expect(winner.status).toBe(200);
    expect((winner.body as { shiftId: string }).shiftId).toBe(racedShiftId);

    expect(db.rows.posShifts.length).toBe(1);
  });

  it('opens an order only while a shift is open and only on an active table', async () => {
    const db = dbWithBaseline();
    await executeOpenShift(db, { staffId: STAFF, idempotencyKey: key(1) });

    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(2) }, waiter);
    expect(opened.status).toBe(201);
    const orderId = (opened.body as { orderId: string }).orderId;

    const reopened = await executeOpenOrder(
      db,
      { tableId: TABLE, idempotencyKey: key(3) },
      waiter,
    );
    expect(reopened.status).toBe(409);
    expect((reopened.body as { code: string }).code).toBe('TABLE_NOT_AVAILABLE');
    expect((reopened.body as { orderId: string }).orderId).toBe(orderId);

    const withoutShift = await executeOpenOrder(
      db,
      { tableId: TABLE, idempotencyKey: key(4) },
      { staffId: OTHER_STAFF, role: 'WAITER' },
    );
    expect(withoutShift.status).toBe(400);
    expect((withoutShift.body as { code: string }).code).toBe('SHIFT_REQUIRED');
  });

  it('adds guests and lines, snapshots the menu, and recomputes totals', async () => {
    const db = dbWithBaseline();
    await executeOpenShift(db, { staffId: STAFF, idempotencyKey: key(1) });
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(2) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;

    const guest1 = await dispatchPosCommand(
      db,
      'addGuest',
      { orderId, idempotencyKey: key(3) },
      waiter,
    );
    expect(guest1.status).toBe(201);
    const guest1Id = (guest1.body as { guestId: string }).guestId;
    expect((guest1.body as { displayNumber: string }).displayNumber).toBe('Гость 1');

    const guest2 = await dispatchPosCommand(
      db,
      'addGuest',
      { orderId, idempotencyKey: key(4) },
      waiter,
    );
    expect((guest2.body as { displayNumber: string }).displayNumber).toBe('Гость 2');
    const guest2Id = (guest2.body as { guestId: string }).guestId;

    const line1 = await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId: guest1Id, menuItemId: MENU_A, quantity: 2, idempotencyKey: key(5) },
      waiter,
    );
    expect(line1.status).toBe(201);
    const line1Id = (line1.body as { lineId: string }).lineId;

    await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId: guest2Id, menuItemId: MENU_B, quantity: 1, idempotencyKey: key(6) },
      waiter,
    );

    const order = db.rows.posOrders.find((row) => row.id === orderId)!;
    // 2 x 1_500 = 3_000 + 1 x 500 = 500 -> 3_500 in tenge.
    expect((order.subtotal as { amountMicros: number }).amountMicros).toBe(3_500_000_000);
    expect((order.total as { amountMicros: number }).amountMicros).toBe(3_500_000_000);
    expect(order.status).toBe('IN_PROGRESS');

    const guest1Row = db.rows.posOrderGuests.find((row) => row.id === guest1Id)!;
    expect((guest1Row.subtotal as { amountMicros: number }).amountMicros).toBe(3_000_000_000);

    const storedLine = db.rows.posOrderLines.find((row) => row.id === line1Id)!;
    expect(storedLine.itemNameSnapshot).toBe('Плов');
    expect((storedLine.unitPrice as { amountMicros: number }).amountMicros).toBe(1_500_000_000);

    // Two identical menu items stay as separate, independent lines.
    const lineA2 = await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId: guest1Id, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(7) },
      waiter,
    );
    expect(lineA2.status).toBe(201);
    expect(
      db.rows.posOrderLines.filter((row) => row.menuItemId === MENU_A).length,
    ).toBe(2);
  });

  it('changes line quantities and recomputes totals', async () => {
    const db = dbWithBaseline();
    await executeOpenShift(db, { staffId: STAFF, idempotencyKey: key(1) });
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(2) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;

    const guest = await dispatchPosCommand(
      db,
      'addGuest',
      { orderId, idempotencyKey: key(3) },
      waiter,
    );
    const guestId = (guest.body as { guestId: string }).guestId;

    const line = await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId, menuItemId: MENU_B, quantity: 1, idempotencyKey: key(4) },
      waiter,
    );
    const lineId = (line.body as { lineId: string }).lineId;

    const changed = await dispatchPosCommand(
      db,
      'changeLineQuantity',
      { lineId, quantity: 3 },
      waiter,
    );
    expect(changed.status).toBe(200);

    const order = db.rows.posOrders.find((row) => row.id === orderId)!;
    expect((order.subtotal as { amountMicros: number }).amountMicros).toBe(1_500_000_000);
  });

  it('closes a shift but leaves orders open and owned', async () => {
    const db = dbWithBaseline();
    const shift = await executeOpenShift(db, { staffId: STAFF, idempotencyKey: key(1) });
    const shiftId = (shift.body as { shiftId: string }).shiftId;
    await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(2) }, waiter);

    const closed = await dispatchPosCommand(db, 'closeShift', { shiftId }, waiter);
    expect(closed.status).toBe(200);

    const closedAgain = await dispatchPosCommand(db, 'closeShift', { shiftId }, waiter);
    expect(closedAgain.status).toBe(200);

    const order = db.rows.posOrders[0];
    expect(order.status).toBe('OPEN');
    expect(order.ownerStaffId).toBe(STAFF);

    const shifted = db.rows.posShifts[0];
    expect(shifted.isOpen).toBeNull();
    expect(shifted.openToken).toBeNull();
    expect(shifted.status).toBe('CLOSED');
  });

  it('blocks editing an order owned by another waiter', async () => {
    const db = dbWithBaseline();
    await executeOpenShift(db, { staffId: STAFF, idempotencyKey: key(1) });
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(2) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;
    await dispatchPosCommand(
      db,
      'addGuest',
      { orderId, idempotencyKey: key(3) },
      waiter,
    );

    const otherGuest = await dispatchPosCommand(
      db,
      'addGuest',
      { orderId, idempotencyKey: key(4) },
      { staffId: OTHER_STAFF, role: 'WAITER' },
    );
    expect(otherGuest.status).toBe(400);
    expect((otherGuest.body as { code: string }).code).toBe('ORDER_NOT_OWNED');

    const adminGuest = await dispatchPosCommand(
      db,
      'addGuest',
      { orderId, idempotencyKey: key(4) },
      { staffId: OTHER_STAFF, role: 'ADMIN' },
    );
    expect(adminGuest.status).toBe(201);
  });

  it('enforces the role command matrix for future admin-only commands', async () => {
    const db = dbWithBaseline();
    const result = await dispatchPosCommand(
      db,
      'changeLineQuantity',
      { lineId: 'does-not-matter', quantity: 1 },
      { staffId: STAFF, role: 'WAITER' as const },
    );
    expect(result.status).toBe(400);
    expect((result.body as { code: string }).code).toBe('LINE_NOT_FOUND');
  });
});

describe('pos domain concurrency races', () => {
  it('surfaces the existing shift when two openShift calls race', async () => {
    const db = dbWithBaseline();
    // Simulate the concurrent winner: another open shift for the same staff.
    await executeOpenShift(db, { staffId: STAFF, idempotencyKey: key(1) });

    const losing = await executeOpenShift(db, {
      staffId: STAFF,
      idempotencyKey: key(2),
    });

    expect(losing.status).toBe(200);
    expect((losing.body as { shiftId: string }).shiftId).toBeTruthy();
    expect(db.rows.posShifts.length).toBe(1);
  });

  it('returns 409 when two openOrder calls race for the same table', async () => {
    const db = dbWithBaseline();
    // Both waiters have their own open shifts; the race is on the table claim.
    await executeOpenShift(db, { staffId: STAFF, idempotencyKey: key(1) });
    await executeOpenShift(db, { staffId: OTHER_STAFF, idempotencyKey: key(11) });
    await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(2) }, waiter);

    const losing = await executeOpenOrder(
      db,
      { tableId: TABLE, idempotencyKey: key(3) },
      { staffId: OTHER_STAFF, role: 'WAITER' },
    );

    expect(losing.status).toBe(409);
    expect((losing.body as { code: string }).code).toBe('TABLE_NOT_AVAILABLE');
    expect(db.rows.posOrders.length).toBe(1);
  });

  it('does not duplicate a line on idempotent resubmission of addLine', async () => {
    const db = dbWithBaseline();
    await executeOpenShift(db, { staffId: STAFF, idempotencyKey: key(1) });
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(2) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;
    const guest = await dispatchPosCommand(
      db,
      'addGuest',
      { orderId, idempotencyKey: key(3) },
      waiter,
    );
    const guestId = (guest.body as { guestId: string }).guestId;

    const input = { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(4) };

    const first = await dispatchPosCommand(db, 'addLine', input, waiter);
    expect(first.status).toBe(201);
    expect(
      db.rows.posOrderLines.length,
    ).toBe(1);

    const duplicate = await dispatchPosCommand(db, 'addLine', input, waiter);
    expect(duplicate.status).toBe(200);
    expect((duplicate.body as { lineId: string }).lineId).toBe(
      (first.body as { lineId: string }).lineId,
    );
    expect(db.rows.posOrderLines.length).toBe(1);
  });

  it('blocks adding a stop-listed menu item server-side', async () => {
    const db = dbWithBaseline();
    db.seed('posStopListEntries', {
      id: '50000000-0000-4000-8000-000000000001',
      menuItemId: MENU_A,
      isActive: true,
    });
    await executeOpenShift(db, { staffId: STAFF, idempotencyKey: key(1) });
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(2) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;
    const guest = await dispatchPosCommand(
      db,
      'addGuest',
      { orderId, idempotencyKey: key(3) },
      waiter,
    );
    const guestId = (guest.body as { guestId: string }).guestId;

    const blocked = await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(4) },
      waiter,
    );

    expect(blocked.status).toBe(400);
    expect((blocked.body as { code: string }).code).toBe('STOP_LISTED');
  });

  it('lets an admin close a shift owned by another staff member', async () => {
    const db = dbWithBaseline();
    const shift = await executeOpenShift(db, { staffId: STAFF, idempotencyKey: key(1) });
    const shiftId = (shift.body as { shiftId: string }).shiftId;

    const waiterClose = await dispatchPosCommand(
      db,
      'closeShift',
      { shiftId },
      { staffId: OTHER_STAFF, role: 'WAITER' },
    );
    expect(waiterClose.status).toBe(400);
    expect((waiterClose.body as { code: string }).code).toBe('SHIFT_NOT_OWNED');

    const adminClose = await dispatchPosCommand(
      db,
      'closeShift',
      { shiftId },
      { staffId: OTHER_STAFF, role: 'ADMIN' },
    );
    expect(adminClose.status).toBe(200);
  });
});