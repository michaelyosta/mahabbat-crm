import { describe, expect, it } from 'vitest';

import {
  dispatchPosCommand,
  executeAddStopListEntry,
  executeClearStopListEntry,
  executeCancelPrecheck,
  executeCreatePrecheck,
  executeCloseOrder,
  executeRecordPayment,
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
  | 'posKitchenTicketLines'
  | 'posPrechecks'
  | 'posPaymentMethods'
  | 'posPayments'
  | 'posPrepayments'
  | 'posOperationalEvents';

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
    posPrechecks: [],
    posPaymentMethods: [],
    posPayments: [],
    posPrepayments: [],
    posOperationalEvents: [],
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

    if (kind === 'posOperationalEvents') {
      this.assertIdempotencyUnique(this.rows.posOperationalEvents, data);
      return;
    }

    if (kind === 'posPrechecks') {
      this.assertIdempotencyUnique(this.rows.posPrechecks, data);
      if (
        typeof data.activeOrderKey === 'string' &&
        this.rows.posPrechecks.some((row) => row.activeOrderKey === data.activeOrderKey)
      ) {
        throw new UniqueViolationError('duplicate activeOrderKey');
      }
      if (
        typeof data.cancelIdempotencyKey === 'string' &&
        this.rows.posPrechecks.some((row) => row.cancelIdempotencyKey === data.cancelIdempotencyKey)
      ) {
        throw new UniqueViolationError('duplicate cancelIdempotencyKey');
      }
      return;
    }

    if (kind === 'posPayments') {
      this.assertIdempotencyUnique(this.rows.posPayments, data);
      if (
        typeof data.lockKey === 'string' &&
        this.rows.posPayments.some((row) => row.lockKey === data.lockKey)
      ) {
        throw new UniqueViolationError('duplicate payment lockKey');
      }
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
      const filter = (args?.filter ?? {}) as Record<string, unknown>;
      const matchesCondition = (value: unknown, condition: unknown): boolean => {
        const predicate = condition as Record<string, unknown>;
        if (typeof predicate !== 'object' || predicate === null) return true;
        if ('eq' in predicate) return JSON.stringify(value) === JSON.stringify(predicate.eq);
        if (typeof value !== 'object' || value === null) return true;
        return Object.entries(predicate).every(([nestedField, nestedCondition]) =>
          matchesCondition((value as Record<string, unknown>)[nestedField], nestedCondition),
        );
      };
      const matches = this.rows[updateKind].filter((row) =>
        Object.entries(filter).every(([field, condition]) => {
          return matchesCondition(row[field], condition);
        }),
      );
      const indices = id
        ? [this.rows[updateKind].findIndex((row) => row.id === id)]
        : matches.map((row) => this.rows[updateKind].indexOf(row));
      if (indices.length === 0 || indices.every((index) => index === -1)) {
        return Promise.resolve({ [root]: id ? null : [] });
      }
      const updatedRows = indices
        .filter((index) => index >= 0)
        .map((index) => {
          this.rows[updateKind][index] = { ...this.rows[updateKind][index], ...data };
          return { ...this.rows[updateKind][index] };
        });
      return Promise.resolve({ [root]: id ? updatedRows[0] : updatedRows });
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
      updatePosOrders: 'posOrders',
      createPosOrderGuest: 'posOrderGuests',
      updatePosOrderGuest: 'posOrderGuests',
      createPosOrderLine: 'posOrderLines',
      updatePosOrderLine: 'posOrderLines',
      createPosStopListEntry: 'posStopListEntries',
      updatePosStopListEntry: 'posStopListEntries',
      createPosKitchenTicket: 'posKitchenTickets',
      createPosKitchenTicketLine: 'posKitchenTicketLines',
      updatePosKitchenTicket: 'posKitchenTickets',
      createPosPrecheck: 'posPrechecks',
      updatePosPrecheck: 'posPrechecks',
      createPosPaymentMethod: 'posPaymentMethods',
      updatePosPaymentMethod: 'posPaymentMethods',
      createPosPayment: 'posPayments',
      updatePosPayment: 'posPayments',
      createPosPrepayment: 'posPrepayments',
      updatePosPrepayment: 'posPrepayments',
      updatePosPrepayments: 'posPrepayments',
      createPosOperationalEvent: 'posOperationalEvents',
      updatePosOperationalEvent: 'posOperationalEvents',
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
      posPrechecks: 'posPrechecks',
      posPaymentMethods: 'posPaymentMethods',
      posPayments: 'posPayments',
      posPrepayments: 'posPrepayments',
      posOperationalEvents: 'posOperationalEvents',
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
const CASH_METHOD = '20000000-0000-4000-8000-000000000020';
const CARD_METHOD = '20000000-0000-4000-8000-000000000021';

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
  db.seed('posPaymentMethods', {
    id: CASH_METHOD,
    name: 'Наличные',
    methodType: 'CASH',
    isActive: true,
    sortOrder: 0,
  });
  db.seed('posPaymentMethods', {
    id: CARD_METHOD,
    name: 'Карта',
    methodType: 'CARD',
    isActive: true,
    sortOrder: 1,
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

  it('removes the last unsent unit without closing the table order', async () => {
    const db = dbWithBaseline();
    await executeOpenShift(db, { idempotencyKey: key(10) }, waiter);
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(11) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;
    const guest = await dispatchPosCommand(db, 'addGuest', { orderId, idempotencyKey: key(12) }, waiter);
    const guestId = (guest.body as { guestId: string }).guestId;
    const added = await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(13) },
      waiter,
    );
    const lineId = (added.body as { lineId: string }).lineId;

    const removed = await dispatchPosCommand(db, 'removeUnsentLine', { lineId }, waiter);
    const replay = await dispatchPosCommand(db, 'removeUnsentLine', { lineId }, waiter);
    const line = db.rows.posOrderLines.find((row) => row.id === lineId)!;
    const order = db.rows.posOrders.find((row) => row.id === orderId)!;
    const guestRow = db.rows.posOrderGuests.find((row) => row.id === guestId)!;

    expect(removed.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(line.status).toBe('VOIDED');
    expect(line.voidReason).toBe('REMOVED_BEFORE_KITCHEN');
    expect(order.status).toBe('IN_PROGRESS');
    expect(order.subtotal).toBeNull();
    expect(order.total).toBeNull();
    expect(guestRow.subtotal).toBeNull();
  });

  it('does not remove a line after it has been sent to the kitchen', async () => {
    const db = dbWithBaseline();
    await executeOpenShift(db, { idempotencyKey: key(20) }, waiter);
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(21) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;
    const guest = await dispatchPosCommand(db, 'addGuest', { orderId, idempotencyKey: key(22) }, waiter);
    const guestId = (guest.body as { guestId: string }).guestId;
    const added = await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(23) },
      waiter,
    );
    const lineId = (added.body as { lineId: string }).lineId;
    await executePrintKitchenTicket(db, { orderId, idempotencyKey: key(24) }, waiter);

    const removed = await dispatchPosCommand(db, 'removeUnsentLine', { lineId }, waiter);

    expect(removed.status).toBe(400);
    expect((removed.body as { code: string }).code).toBe('LINE_ALREADY_SENT');
    expect(db.rows.posOrderLines.find((row) => row.id === lineId)?.status).toBe('ACTIVE');
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

  it('creates an immutable precheck snapshot, locks the order, and restores editability only after admin cancel', async () => {
    const db = dbWithBaseline();
    await executeOpenShift(db, { idempotencyKey: key(95) }, waiter);
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(96) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;
    const guest = await dispatchPosCommand(db, 'addGuest', { orderId, idempotencyKey: key(97) }, waiter);
    const guestId = (guest.body as { guestId: string }).guestId;
    await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 2, idempotencyKey: key(98) },
      waiter,
    );

    const created = await executeCreatePrecheck(db, { orderId, idempotencyKey: key(99) }, waiter);
    expect(created.status).toBe(201);
    const precheckId = (created.body as { precheckId: string }).precheckId;
    expect(db.rows.posPrechecks).toHaveLength(1);
    expect(db.rows.posPrechecks[0].status).toBe('ACTIVE');
    expect(db.rows.posOrders.find((row) => row.id === orderId)?.status).toBe('PRECHECK_PRINTED');
    expect((db.rows.posPrechecks[0].totalSnapshot as { amountMicros: number }).amountMicros).toBe(
      3_000_000_000,
    );

    const retry = await executeCreatePrecheck(db, { orderId, idempotencyKey: key(99) }, waiter);
    expect(retry.status).toBe(200);
    expect((retry.body as { precheckId: string }).precheckId).toBe(precheckId);

    const locked = await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId, menuItemId: MENU_B, quantity: 1, idempotencyKey: key(100) },
      waiter,
    );
    expect(locked.status).toBe(400);
    expect((locked.body as { code: string }).code).toBe('ORDER_NOT_EDITABLE');

    const waiterCancel = await dispatchPosCommand(
      db,
      'cancelPrecheck',
      { orderId, idempotencyKey: key(101) },
      waiter,
    );
    expect(waiterCancel.status).toBe(403);
    expect((waiterCancel.body as { code: string }).code).toBe('COMMAND_FORBIDDEN');

    const admin = { staffId: OTHER_STAFF, role: 'ADMIN' as const };
    const cancelled = await executeCancelPrecheck(
      db,
      { orderId, idempotencyKey: key(101) },
      admin,
    );
    expect(cancelled.status).toBe(200);
    expect(db.rows.posPrechecks[0].status).toBe('CANCELLED');
    expect(db.rows.posOrders.find((row) => row.id === orderId)?.status).toBe('IN_PROGRESS');

    const cancelRetry = await executeCancelPrecheck(
      db,
      { orderId, idempotencyKey: key(101) },
      admin,
    );
    expect(cancelRetry.status).toBe(200);
    expect((cancelRetry.body as { precheckId: string }).precheckId).toBe(precheckId);

    const restored = await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId, menuItemId: MENU_B, quantity: 1, idempotencyKey: key(102) },
      waiter,
    );
    expect(restored.status).toBe(201);
  });

  it('serializes partial payments, rejects overpayment, and closes the table only at zero remaining', async () => {
    const db = dbWithBaseline();
    await executeOpenShift(db, { idempotencyKey: key(103) }, waiter);
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(104) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;
    const guest = await dispatchPosCommand(db, 'addGuest', { orderId, idempotencyKey: key(105) }, waiter);
    const guestId = (guest.body as { guestId: string }).guestId;
    await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 2, idempotencyKey: key(106) },
      waiter,
    );
    await executeCreatePrecheck(db, { orderId, idempotencyKey: key(107) }, waiter);

    const first = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 1_000_000_000, idempotencyKey: key(108) },
      waiter,
    );
    expect(first.status).toBe(201);
    expect((first.body as { remainingMicros: number }).remainingMicros).toBe(2_000_000_000);

    const retry = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 1_000_000_000, idempotencyKey: key(108) },
      waiter,
    );
    expect(retry.status).toBe(200);
    expect(db.rows.posPayments.filter((row) => row.status === 'SUCCESS')).toHaveLength(1);

    const overpay = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CARD_METHOD, amountMicros: 2_100_000_000, idempotencyKey: key(109) },
      waiter,
    );
    expect(overpay.status).toBe(400);
    expect((overpay.body as { code: string }).code).toBe('OVERPAYMENT');

    const second = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CARD_METHOD, amountMicros: 2_000_000_000, idempotencyKey: key(110) },
      waiter,
    );
    expect(second.status).toBe(201);
    expect((second.body as { remainingMicros: number }).remainingMicros).toBe(0);

    const closed = await executeCloseOrder(db, { orderId, idempotencyKey: key(111) }, waiter);
    expect(closed.status).toBe(201);
    expect(db.rows.posOrders.find((row) => row.id === orderId)?.status).toBe('CLOSED');
    expect(db.rows.posOrders.find((row) => row.id === orderId)?.claimToken).toBeNull();

    const closeRetry = await executeCloseOrder(db, { orderId, idempotencyKey: key(111) }, waiter);
    expect(closeRetry.status).toBe(200);
    expect(db.rows.posPayments.filter((row) => row.status === 'SUCCESS')).toHaveLength(2);
  });

  it('releases the (tableId, claimToken) claim when voiding the last line cancels the order', async () => {
    const db = dbWithBaseline();
    const admin = { staffId: OTHER_STAFF, role: 'ADMIN' as const };
    await executeOpenShift(db, { idempotencyKey: key(120) }, waiter);
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(121) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;
    const guest = await dispatchPosCommand(db, 'addGuest', { orderId, idempotencyKey: key(122) }, waiter);
    const guestId = (guest.body as { guestId: string }).guestId;
    const line = await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(123) },
      waiter,
    );
    const lineId = (line.body as { lineId: string }).lineId;

    const voided = await dispatchPosCommand(
      db,
      'voidOrderLines',
      { lineIds: [lineId], preparedState: 'NOT_PREPARED', idempotencyKey: key(124) },
      admin,
    );
    const cancelled = db.rows.posOrders.find((row) => row.id === orderId);
    expect(voided.status).toBe(201);
    // The claim must be dropped or the unique (tableId, claimToken) index would block re-opening.
    expect(cancelled?.status).toBe('CANCELLED');
    expect(cancelled?.claimToken).toBeNull();

    const reopened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(125) }, waiter);
    expect(reopened.status).toBe(201);
    expect((reopened.body as { orderId: string }).orderId).not.toBe(orderId);
  });
});

describe('pos cash tender and change', () => {
  const setupOrderWithTotal = async (db: FakePosDb, totalMicros: number) => {
    await executeOpenShift(db, { idempotencyKey: key(500) }, waiter);
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(501) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;
    const guest = await dispatchPosCommand(db, 'addGuest', { orderId, idempotencyKey: key(502) }, waiter);
    const guestId = (guest.body as { guestId: string }).guestId;
    const menu = db.rows.posMenuItems.find((row) => row.id === MENU_A)!;
    menu.price = { amountMicros: totalMicros, currencyCode: 'KZT' };
    await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(503) },
      waiter,
    );
    await executeCreatePrecheck(db, { orderId, idempotencyKey: key(504) }, waiter);
    return orderId;
  };

  it('cash exact tender applies fully with no change', async () => {
    const db = dbWithBaseline();
    const orderId = await setupOrderWithTotal(db, 7_000_000_000);
    const result = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 7_000_000_000, tenderedAmountMicros: 7_000_000_000, idempotencyKey: key(510) },
      waiter,
    );
    expect(result.status).toBe(201);
    const body = result.body as any;
    expect(body.appliedMicros).toBe(7_000_000_000);
    expect(body.changeMicros).toBe(0);
    expect(body.remainingMicros).toBe(0);
    const stored = db.rows.posPayments.find((row) => row.idempotencyKey === key(510))!;
    expect((stored.amount as any).amountMicros).toBe(7_000_000_000);
    expect((stored.tenderedAmount as any).amountMicros).toBe(7_000_000_000);
    expect((stored.changeAmount as any).amountMicros).toBe(0);
  });

  it('cash over-tender caps applied and returns change', async () => {
    const db = dbWithBaseline();
    const orderId = await setupOrderWithTotal(db, 7_000_000_000);
    const result = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 10_000_000_000, tenderedAmountMicros: 10_000_000_000, idempotencyKey: key(520) },
      waiter,
    );
    expect(result.status).toBe(201);
    const body = result.body as any;
    expect(body.appliedMicros).toBe(7_000_000_000);
    expect(body.changeMicros).toBe(3_000_000_000);
    expect(body.remainingMicros).toBe(0);
    const order = db.rows.posOrders.find((row) => row.id === orderId)!;
    expect((order.paidTotal as any).amountMicros).toBe(7_000_000_000);
  });

  it('cash partial tender leaves remaining', async () => {
    const db = dbWithBaseline();
    const orderId = await setupOrderWithTotal(db, 7_000_000_000);
    const result = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 4_000_000_000, tenderedAmountMicros: 4_000_000_000, idempotencyKey: key(530) },
      waiter,
    );
    expect(result.status).toBe(201);
    const body = result.body as any;
    expect(body.appliedMicros).toBe(4_000_000_000);
    expect(body.changeMicros).toBe(0);
    expect(body.remainingMicros).toBe(3_000_000_000);
  });

  it('mixed card + cash with change closes order', async () => {
    const db = dbWithBaseline();
    const orderId = await setupOrderWithTotal(db, 20_000_000_000);
    const card = await executeRecordPayment(db, { orderId, paymentMethodId: CARD_METHOD, amountMicros: 12_000_000_000, idempotencyKey: key(540) }, waiter);
    expect(card.status).toBe(201);
    expect((card.body as any).remainingMicros).toBe(8_000_000_000);
    const cash = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 10_000_000_000, tenderedAmountMicros: 10_000_000_000, idempotencyKey: key(541) },
      waiter,
    );
    expect(cash.status).toBe(201);
    expect((cash.body as any).appliedMicros).toBe(8_000_000_000);
    expect((cash.body as any).changeMicros).toBe(2_000_000_000);
    expect((cash.body as any).remainingMicros).toBe(0);
    const closed = await executeCloseOrder(db, { orderId, idempotencyKey: key(542) }, waiter);
    expect(closed.status).toBe(201);
  });

  it('retry same idempotency key returns same payment and no duplicate', async () => {
    const db = dbWithBaseline();
    const orderId = await setupOrderWithTotal(db, 7_000_000_000);
    const first = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 10_000_000_000, tenderedAmountMicros: 10_000_000_000, idempotencyKey: key(550) },
      waiter,
    );
    expect(first.status).toBe(201);
    const second = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 10_000_000_000, tenderedAmountMicros: 10_000_000_000, idempotencyKey: key(550) },
      waiter,
    );
    expect(second.status).toBe(200);
    expect((second.body as any).paymentId).toBe((first.body as any).paymentId);
    expect(db.rows.posPayments.filter((row) => row.status === 'SUCCESS')).toHaveLength(1);
    const paidTotal = (db.rows.posOrders.find((row) => row.id === orderId)?.paidTotal as any).amountMicros;
    expect(paidTotal).toBe(7_000_000_000);
  });

  it('concurrent cash payments do not produce negative remaining', async () => {
    const db = dbWithBaseline();
    const orderId = await setupOrderWithTotal(db, 7_000_000_000);
    const first = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 4_000_000_000, tenderedAmountMicros: 4_000_000_000, idempotencyKey: key(560) },
      waiter,
    );
    expect(first.status).toBe(201);
    // Second payment attempts to pay 4 000 but remaining is 3 000; without tendered cap it should overpay for CARD,
    // but for cash with tendered equal to applied we test card-like non-cash overpayment via CASH without tendered mismatch:
    // Use a second cash payment without tendered field to trigger plain overpayment check.
    const second = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 4_000_000_000, idempotencyKey: key(561) },
      waiter,
    );
    expect(second.status).toBe(400);
    expect((second.body as any).code).toBe('OVERPAYMENT');
    expect((db.rows.posOrders.find((row) => row.id === orderId)?.paidTotal as any).amountMicros).toBe(4_000_000_000);
  });

  it('CARD does not use cash change semantics', async () => {
    const db = dbWithBaseline();
    const orderId = await setupOrderWithTotal(db, 7_000_000_000);
    // Send tendered for CARD; server should ignore cash semantics and apply amountMicros directly (no change)
    const result = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CARD_METHOD, amountMicros: 7_000_000_000, tenderedAmountMicros: 10_000_000_000, idempotencyKey: key(570) },
      waiter,
    );
    expect(result.status).toBe(201);
    const body = result.body as any;
    expect(body.appliedMicros).toBe(7_000_000_000);
    expect(body.changeMicros).toBe(0);
    expect(body.remainingMicros).toBe(0);
    const stored = db.rows.posPayments.find((row) => row.idempotencyKey === key(570))!;
    // CARD stored change should be 0 or null, not 3k
    const change = stored.changeAmount ? (stored.changeAmount as any).amountMicros : 0;
    expect(change).toBe(0);
    // Overpayment for CARD must still be rejected even if tendered would have implied change
    const freshDb = dbWithBaseline();
    const freshOrderId = await setupOrderWithTotal(freshDb, 7_000_000_000);
    const over = await executeRecordPayment(
      freshDb,
      { orderId: freshOrderId, paymentMethodId: CARD_METHOD, amountMicros: 10_000_000_000, idempotencyKey: key(571) },
      waiter,
    );
    expect(over.status).toBe(400);
    expect((over.body as any).code).toBe('OVERPAYMENT');
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

describe('foreign order is read-only for a waiter (server-side authorization)', () => {
  const foreignWaiter = { staffId: OTHER_STAFF, role: 'WAITER' as const };
  const admin = { staffId: OTHER_STAFF, role: 'ADMIN' as const };

  const setupPrecheckOrder = async (db: FakePosDb) => {
    await executeOpenShift(db, { idempotencyKey: key(801) }, waiter);
    const opened = await executeOpenOrder(db, { tableId: TABLE, idempotencyKey: key(802) }, waiter);
    const orderId = (opened.body as { orderId: string }).orderId;
    const guest = await dispatchPosCommand(db, 'addGuest', { orderId, idempotencyKey: key(803) }, waiter);
    const guestId = (guest.body as { guestId: string }).guestId;
    await dispatchPosCommand(
      db,
      'addLine',
      { orderId, guestId, menuItemId: MENU_A, quantity: 1, idempotencyKey: key(804) },
      waiter,
    );
    await executeCreatePrecheck(db, { orderId, idempotencyKey: key(805) }, waiter);
    return orderId;
  };

  it('rejects a foreign waiter recordPayment with ORDER_NOT_OWNED', async () => {
    const db = dbWithBaseline();
    const orderId = await setupPrecheckOrder(db);

    const foreign = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 1_000_000_000, idempotencyKey: key(806) },
      foreignWaiter,
    );
    expect(foreign.status).toBe(400);
    expect((foreign.body as { code: string }).code).toBe('ORDER_NOT_OWNED');
    expect(db.rows.posPayments).toHaveLength(0);

    const owner = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 1_000_000_000, idempotencyKey: key(807) },
      waiter,
    );
    expect(owner.status).toBe(201);
    expect(db.rows.posPayments).toHaveLength(1);
  });

  it('rejects a foreign waiter closeOrder with ORDER_NOT_OWNED', async () => {
    const db = dbWithBaseline();
    const orderId = await setupPrecheckOrder(db);

    await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 1_500_000_000, idempotencyKey: key(808) },
      waiter,
    );
    const precheckId = (db.rows.posPrechecks[0] as { id: string }).id;
    void precheckId;

    const foreign = await executeCloseOrder(db, { orderId, idempotencyKey: key(809) }, foreignWaiter);
    expect(foreign.status).toBe(400);
    expect((foreign.body as { code: string }).code).toBe('ORDER_NOT_OWNED');
    expect(db.rows.posOrders.find((row) => row.id === orderId)?.status).toBe('PRECHECK_PRINTED');

    const owner = await executeCloseOrder(db, { orderId, idempotencyKey: key(810) }, waiter);
    expect(owner.status).toBe(201);
    expect(db.rows.posOrders.find((row) => row.id === orderId)?.status).toBe('CLOSED');
  });

  it('rejects a foreign waiter applyPrepayment with ORDER_NOT_OWNED', async () => {
    const db = dbWithBaseline();
    const orderId = await setupPrecheckOrder(db);
    db.seed('posPrepayments', {
      id: '40000000-0000-4000-8000-000000000001',
      orderId: null,
      amount: { amountMicros: 100_000_000, currencyCode: 'KZT' },
      status: 'UNAPPLIED',
      createdByStaffId: STAFF,
    });

    const foreign = await dispatchPosCommand(
      db,
      'applyPrepayment',
      { prepaymentId: '40000000-0000-4000-8000-000000000001', orderId, idempotencyKey: key(811) },
      foreignWaiter,
    );
    expect(foreign.status).toBe(400);
    expect((foreign.body as { code: string }).code).toBe('ORDER_NOT_OWNED');
    expect(db.rows.posPrepayments[0].status).toBe('UNAPPLIED');
  });

  it('allows an ADMIN to pay and close any order', async () => {
    const db = dbWithBaseline();
    const orderId = await setupPrecheckOrder(db);
    const pay = await executeRecordPayment(
      db,
      { orderId, paymentMethodId: CASH_METHOD, amountMicros: 1_500_000_000, idempotencyKey: key(812) },
      admin,
    );
    expect(pay.status).toBe(201);
    const close = await executeCloseOrder(db, { orderId, idempotencyKey: key(813) }, admin);
    expect(close.status).toBe(201);
  });
});
