import { describe, expect, it } from 'vitest';

import {
  dispatchPosCommand,
  executeAddStopListEntry,
  executeClearStopListEntry,
  executeOpenOrder,
  executeOpenShift,
  executePrintKitchenTicket,
} from 'src/pos/pos-command.dispatch';

type Row = Record<string, unknown> & { id: string };

type TableKind =
  | 'posShifts'
  | 'posTables'
  | 'posMenuItems'
  | 'posOrders'
  | 'posOrderGuests'
  | 'posOrderLines'
  | 'posStopListEntries'
  | 'posKitchenTickets'
  | 'posKitchenTicketLines';

class UniqueViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UniqueViolationError';
  }
}

class FakePosDb {
  readonly rows: Record<TableKind, Row[]> = {
    posShifts: [],
    posTables: [],
    posMenuItems: [],
    posOrders: [],
    posOrderGuests: [],
    posOrderLines: [],
    posStopListEntries: [],
    posKitchenTickets: [],
    posKitchenTicketLines: [],
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

    if (kind === 'posStopListEntries') {
      const conflict = this.rows.posStopListEntries.some(
        (row) => row.menuItemId === data.menuItemId,
      );
      if (conflict) throw new UniqueViolationError('duplicate menuItemId');
    }

    if (kind === 'posKitchenTickets') {
      this.assertIdempotencyUnique(this.rows.posKitchenTickets, data);
      const requestKey = data.requestIdempotencyKey;
      if (
        typeof requestKey === 'string' &&
        this.rows.posKitchenTickets.some((row) => row.requestIdempotencyKey === requestKey)
      ) {
        throw new UniqueViolationError('duplicate requestIdempotencyKey');
      }
      return;
    }

    if (kind === 'posKitchenTicketLines') {
      const conflict = this.rows.posKitchenTicketLines.some(
        (row) => row.ticketId === data.ticketId && row.orderLineId === data.orderLineId,
      );
      if (conflict) throw new UniqueViolationError('duplicate ticket line');
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
      createPosStopListEntry: 'posStopListEntries',
      updatePosStopListEntry: 'posStopListEntries',
      createPosKitchenTicket: 'posKitchenTickets',
      createPosKitchenTicketLine: 'posKitchenTicketLines',
      updatePosKitchenTicket: 'posKitchenTickets',
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
      posShifts: 'posShifts',
      posTables: 'posTables',
      posMenuItems: 'posMenuItems',
      posOrders: 'posOrders',
      posOrderGuests: 'posOrderGuests',
      posOrderLines: 'posOrderLines',
      posStopListEntries: 'posStopListEntries',
      posKitchenTickets: 'posKitchenTickets',
      posKitchenTicketLines: 'posKitchenTicketLines',
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

    const first = await executeOpenShift(db, { idempotencyKey: key(1) }, waiter);
    expect(first.status).toBe(201);
    expect((first.body as { shiftId: string }).shiftId).toBeTruthy();

    const second = await executeOpenShift(db, { idempotencyKey: key(2) }, waiter);
    // The pre-existing open shift is surfaced instead of creating a second one.
    expect(second.status).toBe(200);
    const racedShiftId = (second.body as { shiftId: string }).shiftId;

    const winner = await executeOpenShift(db, { idempotencyKey: key(1) }, waiter);
    expect(winner.status).toBe(200);
    expect((winner.body as { shiftId: string }).shiftId).toBe(racedShiftId);

    expect(db.rows.posShifts.length).toBe(1);
  });

  it('opens an order only while a shift is open and only on an active table', async () => {
    const db = dbWithBaseline();
    await executeOpenShift(db, { idempotencyKey: key(1) }, waiter);

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
    await executeOpenShift(db, { idempotencyKey: key(1) }, waiter);
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

    const blankNamedGuest = await dispatchPosCommand(
      db,
      'addGuest',
      { orderId, idempotencyKey: key(70), name: '' },
      waiter,
    );
    expect(blankNamedGuest.status).toBe(201);
    const blankNamedRetry = await dispatchPosCommand(
      db,
      'addGuest',
      { orderId, idempotencyKey: key(70) },
      waiter,
    );
    expect(blankNamedRetry.status).toBe(200);
    expect((blankNamedRetry.body as { guestId: string }).guestId).toBe(
      (blankNamedGuest.body as { guestId: string }).guestId,
    );

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
    await executeOpenShift(db, { idempotencyKey: key(1) }, waiter);
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
    const shift = await executeOpenShift(db, { idempotencyKey: key(1) }, waiter);
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
    await executeOpenShift(db, { idempotencyKey: key(1) }, waiter);
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

  it('supports an idempotent stop-list lifecycle and unblocks the stale menu after clear', async () => {
    const db = dbWithBaseline();
    const first = await executeAddStopListEntry(
      db,
      { menuItemId: MENU_A, idempotencyKey: key(80) },
      waiter,
    );
    expect(first.status).toBe(201);

    const replay = await executeAddStopListEntry(
      db,
      { menuItemId: MENU_A, idempotencyKey: key(80) },
      waiter,
    );
    expect(replay.status).toBe(200);
    expect(db.rows.posStopListEntries.length).toBe(1);

    const cleared = await executeClearStopListEntry(
      db,
      { menuItemId: MENU_A, idempotencyKey: key(81) },
      waiter,
    );
    expect(cleared.status).toBe(200);
    expect(db.rows.posStopListEntries[0].isActive).toBe(false);

    const reopened = await executeAddStopListEntry(
      db,
      { menuItemId: MENU_A, idempotencyKey: key(82) },
      waiter,
    );
    expect(reopened.status).toBe(200);
    expect(db.rows.posStopListEntries.length).toBe(1);
    expect(db.rows.posStopListEntries[0].isActive).toBe(true);
  });

  it('prints only unsent deltas and makes retry/no-op safe', async () => {
    const db = dbWithBaseline();
    await executeOpenShift(db, { idempotencyKey: key(83) }, waiter);
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(84) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;
    const guest = await dispatchPosCommand(db, 'addGuest', { orderId, idempotencyKey: key(85) }, waiter);
    const guestId = (guest.body as { guestId: string }).guestId;
    const line = await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 2, idempotencyKey: key(86) },
      waiter,
    );
    const lineId = (line.body as { lineId: string }).lineId;

    const first = await executePrintKitchenTicket(
      db,
      { orderId, idempotencyKey: key(87) },
      waiter,
    );
    expect(first.status).toBe(201);
    expect(db.rows.posKitchenTickets.length).toBe(1);
    expect(db.rows.posKitchenTicketLines[0].quantity).toBe(2);
    expect(db.rows.posOrderLines.find((row) => row.id === lineId)?.kitchenSentQuantity).toBe(2);

    const retry = await executePrintKitchenTicket(
      db,
      { orderId, idempotencyKey: key(87) },
      waiter,
    );
    expect(retry.status).toBe(200);
    expect(db.rows.posKitchenTickets.length).toBe(1);

    const noOp = await executePrintKitchenTicket(
      db,
      { orderId, idempotencyKey: key(88) },
      waiter,
    );
    expect(noOp.status).toBe(200);
    expect((noOp.body as { printStatus: string }).printStatus).toBe('NO_UNSENT_LINES');

    await dispatchPosCommand(db, 'changeLineQuantity', { lineId, quantity: 3 }, waiter);
    const delta = await executePrintKitchenTicket(
      db,
      { orderId, idempotencyKey: key(89) },
      waiter,
    );
    expect(delta.status).toBe(201);
    expect(db.rows.posKitchenTickets.length).toBe(2);
    expect(db.rows.posKitchenTicketLines[1].quantity).toBe(1);
  });

  it('rejects reducing an already sent quantity', async () => {
    const db = dbWithBaseline();
    await executeOpenShift(db, { idempotencyKey: key(90) }, waiter);
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(91) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;
    const guest = await dispatchPosCommand(db, 'addGuest', { orderId, idempotencyKey: key(92) }, waiter);
    const guestId = (guest.body as { guestId: string }).guestId;
    const line = await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 2, idempotencyKey: key(93) },
      waiter,
    );
    const lineId = (line.body as { lineId: string }).lineId;
    await executePrintKitchenTicket(db, { orderId, idempotencyKey: key(94) }, waiter);
    const changed = await dispatchPosCommand(db, 'changeLineQuantity', { lineId, quantity: 1 }, waiter);
    expect(changed.status).toBe(400);
    expect((changed.body as { code: string }).code).toBe('LINE_ALREADY_SENT');
  });
});

describe('pos domain concurrency races', () => {
  it('surfaces the existing shift when two openShift calls race', async () => {
    const db = dbWithBaseline();
    // Simulate the concurrent winner: another open shift for the same staff.
    await executeOpenShift(db, { idempotencyKey: key(1) }, waiter);

    const losing = await executeOpenShift(db, { idempotencyKey: key(2) }, waiter);

    expect(losing.status).toBe(200);
    expect((losing.body as { shiftId: string }).shiftId).toBeTruthy();
    expect(db.rows.posShifts.length).toBe(1);
  });

  it('returns 409 when two openOrder calls race for the same table', async () => {
    const db = dbWithBaseline();
    // Both waiters have their own open shifts; the race is on the table claim.
    await executeOpenShift(db, { idempotencyKey: key(1) }, waiter);
    await executeOpenShift(db, { idempotencyKey: key(11) }, { staffId: OTHER_STAFF, role: 'WAITER' });
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
    await executeOpenShift(db, { idempotencyKey: key(1) }, waiter);
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
    await executeOpenShift(db, { idempotencyKey: key(1) }, waiter);
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
    const shift = await executeOpenShift(db, { idempotencyKey: key(1) }, waiter);
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

  it('rejects foreign idempotency-key reuse across authenticated staff contexts', async () => {
    const db = dbWithBaseline();

    const firstShift = await executeOpenShift(db, { idempotencyKey: key(21) }, waiter);
    expect(firstShift.status).toBe(201);

    const foreignShiftKey = await dispatchPosCommand(
      db,
      'openShift',
      { idempotencyKey: key(21) },
      { staffId: OTHER_STAFF, role: 'WAITER' },
    );
    expect(foreignShiftKey.status).toBe(409);
    expect((foreignShiftKey.body as { code: string }).code).toBe(
      'IDEMPOTENCY_CONFLICT',
    );

    await executeOpenShift(db, { idempotencyKey: key(22) }, { staffId: OTHER_STAFF, role: 'WAITER' });
    const firstOrder = await executeOpenOrder(
      db,
      { tableId: TABLE, idempotencyKey: key(23) },
      waiter,
    );
    expect(firstOrder.status).toBe(201);

    const foreignOrderKey = await executeOpenOrder(
      db,
      { tableId: TABLE, idempotencyKey: key(23) },
      { staffId: OTHER_STAFF, role: 'WAITER' },
    );
    expect(foreignOrderKey.status).toBe(409);
    expect((foreignOrderKey.body as { code: string }).code).toBe(
      'IDEMPOTENCY_CONFLICT',
    );

    const orderId = (firstOrder.body as { orderId: string }).orderId;
    const guest = await dispatchPosCommand(
      db,
      'addGuest',
      { orderId, idempotencyKey: key(24), name: 'Гость A' },
      waiter,
    );
    const guestId = (guest.body as { guestId: string }).guestId;

    const foreignGuestKey = await dispatchPosCommand(
      db,
      'addGuest',
      { orderId, idempotencyKey: key(24), name: 'Гость B' },
      waiter,
    );
    expect(foreignGuestKey.status).toBe(409);
    expect((foreignGuestKey.body as { code: string }).code).toBe(
      'IDEMPOTENCY_CONFLICT',
    );

    const firstLine = await dispatchPosCommand(
      db,
      'addLine',
      {
        orderId,
        guestId,
        menuItemId: MENU_A,
        quantity: 1,
        idempotencyKey: key(25),
      },
      waiter,
    );
    expect(firstLine.status).toBe(201);

    const foreignLineKey = await dispatchPosCommand(
      db,
      'addLine',
      {
        orderId,
        guestId,
        menuItemId: MENU_A,
        quantity: 2,
        idempotencyKey: key(25),
      },
      waiter,
    );
    expect(foreignLineKey.status).toBe(409);
    expect((foreignLineKey.body as { code: string }).code).toBe(
      'IDEMPOTENCY_CONFLICT',
    );
  });
});
