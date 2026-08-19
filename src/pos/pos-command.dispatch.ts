import { randomUUID } from 'crypto';

import { type CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import {
  isPosOrderActive,
  isPosOrderEditable,
  nextPosOrderStatusAfterLineChange,
  type PosOrderStatus,
} from 'src/pos/pos-order-state';
import {
  commandAllowedForRole,
  orderCanBeEditedBy,
  shiftCanBeClosedBy,
  type PosActor,
  type PosCommand,
} from 'src/pos/pos-permissions';
import {
  microsToCurrency,
  normalizeCurrency,
  sumActiveLinesMicros,
} from 'src/pos/pos-money';

type ExistingRecord = {
  id: string;
};

type ShiftRecord = ExistingRecord & {
  staffId?: string | null;
  status?: string | null;
  isOpen?: boolean | null;
  openToken?: string | null;
  closedAt?: string | null;
  idempotencyKey?: string | null;
};

type TableRecord = ExistingRecord & {
  number?: string | null;
  zoneId?: string | null;
  isActive?: boolean | null;
};

type MenuItemRecord = ExistingRecord & {
  name?: string | null;
  price?: unknown;
  isActive?: boolean | null;
};

type OrderRecord = ExistingRecord & {
  status?: string | null;
  shiftId?: string | null;
  tableId?: string | null;
  ownerStaffId?: string | null;
  openedByStaffId?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  claimToken?: string | null;
  idempotencyKey?: string | null;
  subtotal?: unknown;
  total?: unknown;
};

type GuestRecord = ExistingRecord & {
  orderId?: string | null;
  ordinal?: number | null;
  displayNumber?: string | null;
  name?: string | null;
  subtotal?: unknown;
  idempotencyKey?: string | null;
};

type LineRecord = ExistingRecord & {
  orderId?: string | null;
  guestId?: string | null;
  menuItemId?: string | null;
  itemNameSnapshot?: string | null;
  unitPrice?: unknown;
  quantity?: number | null;
  status?: string | null;
  createdByStaffId?: string | null;
  idempotencyKey?: string | null;
};

type StopListEntryRecord = ExistingRecord & {
  menuItemId?: string | null;
  isActive?: boolean | null;
};

type CommandResult = { status: number; body: unknown };

export const POS_ERROR_CODES = [
  'INVALID_SIGNATURE',
  'COMMAND_FORBIDDEN',
  'INVALID_STAFF',
  'SHIFT_REQUIRED',
  'SHIFT_NOT_FOUND',
  'SHIFT_ALREADY_CLOSED',
  'SHIFT_NOT_OWNED',
  'TABLE_NOT_FOUND',
  'TABLE_INACTIVE',
  'TABLE_NOT_AVAILABLE',
  'ORDER_NOT_FOUND',
  'ORDER_NOT_EDITABLE',
  'ORDER_NOT_OWNED',
  'ORDER_ALREADY_CLOSED',
  'GUEST_NOT_FOUND',
  'GUEST_NOT_IN_ORDER',
  'MENU_ITEM_NOT_FOUND',
  'MENU_ITEM_INACTIVE',
  'STOP_LISTED',
  'LINE_NOT_FOUND',
  'LINE_NOT_EDITABLE',
  'IDEMPOTENCY_CONFLICT',
  'CONFLICT',
] as const;

export type PosErrorCode = (typeof POS_ERROR_CODES)[number];

const errorResult = (
  code: PosErrorCode,
  message: string,
): CommandResult => ({
  status: 400,
  body: { code, message },
});

const okResult = (status: number, body: unknown): CommandResult => ({
  status,
  body,
});

const idempotencyConflict = (message: string): CommandResult => ({
  status: 409,
  body: { code: 'IDEMPOTENCY_CONFLICT', message },
});

type NodeSelection = Record<string, boolean | Record<string, boolean>>;

const SHIFT_FIELDS: NodeSelection = {
  id: true,
  staffId: true,
  status: true,
  isOpen: true,
  openToken: true,
  closedAt: true,
  idempotencyKey: true,
};

const TABLE_FIELDS: NodeSelection = {
  id: true,
  number: true,
  zoneId: true,
  isActive: true,
};

const MENU_ITEM_FIELDS: NodeSelection = {
  id: true,
  name: true,
  price: { amountMicros: true, currencyCode: true },
  isActive: true,
};

const ORDER_FIELDS: NodeSelection = {
  id: true,
  status: true,
  shiftId: true,
  tableId: true,
  ownerStaffId: true,
  openedByStaffId: true,
  openedAt: true,
  closedAt: true,
  claimToken: true,
  idempotencyKey: true,
  subtotal: { amountMicros: true, currencyCode: true },
  total: { amountMicros: true, currencyCode: true },
};

const GUEST_FIELDS: NodeSelection = {
  id: true,
  orderId: true,
  ordinal: true,
  displayNumber: true,
  name: true,
  subtotal: { amountMicros: true, currencyCode: true },
  idempotencyKey: true,
};

const LINE_FIELDS: NodeSelection = {
  id: true,
  orderId: true,
  guestId: true,
  menuItemId: true,
  itemNameSnapshot: true,
  unitPrice: { amountMicros: true, currencyCode: true },
  quantity: true,
  status: true,
  createdByStaffId: true,
  idempotencyKey: true,
};

const STOP_LIST_FIELDS: NodeSelection = {
  id: true,
  menuItemId: true,
  isActive: true,
};

const queryConnection = async <T extends ExistingRecord>(
  client: CoreApiClientLike,
  root: string,
  args: Record<string, unknown>,
  nodeFields: NodeSelection,
): Promise<T[]> => {
  const result = (await client.query({
    [root]: {
      __args: { first: 100, ...args },
      edges: { node: nodeFields },
      pageInfo: { hasNextPage: true, endCursor: true },
    },
  })) as Record<string, Connection<T>>;

  return (result[root]?.edges ?? [])
    .map((edge) => edge?.node)
    .filter((node): node is T => Boolean(node));
};

type Connection<T> = {
  edges?: Array<{ node?: T | null } | null>;
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } | null;
};

const workspaceMemberExists = async (
  client: CoreApiClientLike,
  staffId: string,
): Promise<boolean> => {
  const result = (await client.query({
    workspaceMembers: {
      __args: { filter: { id: { eq: staffId } }, first: 1 },
      edges: { node: { id: true } },
    },
  })) as { workspaceMembers?: Connection<ExistingRecord> };

  return Boolean(result.workspaceMembers?.edges?.[0]?.node?.id);
};

const findShiftById = async (
  client: CoreApiClientLike,
  shiftId: string,
): Promise<ShiftRecord | null> => {
  const shift = await queryConnection<ShiftRecord>(
    client,
    'posShifts',
    { filter: { id: { eq: shiftId } }, first: 1 },
    SHIFT_FIELDS,
  );

  return shift[0] ?? null;
};

const findShiftByIdempotencyKey = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<ShiftRecord | null> => {
  const shift = await queryConnection<ShiftRecord>(
    client,
    'posShifts',
    { filter: { idempotencyKey: { eq: idempotencyKey } }, first: 1 },
    SHIFT_FIELDS,
  );

  return shift[0] ?? null;
};

const findOpenShiftByStaffId = async (
  client: CoreApiClientLike,
  staffId: string,
): Promise<ShiftRecord | null> => {
  const shifts = await queryConnection<ShiftRecord>(
    client,
    'posShifts',
    { filter: { staffId: { eq: staffId }, isOpen: { eq: true } }, first: 100 },
    SHIFT_FIELDS,
  );

  return shifts.find((shift) => shift.isOpen === true) ?? null;
};

const findTableById = async (
  client: CoreApiClientLike,
  tableId: string,
): Promise<TableRecord | null> => {
  const table = await queryConnection<TableRecord>(
    client,
    'posTables',
    { filter: { id: { eq: tableId } }, first: 1 },
    TABLE_FIELDS,
  );

  return table[0] ?? null;
};

const findMenuItemById = async (
  client: CoreApiClientLike,
  menuItemId: string,
): Promise<MenuItemRecord | null> => {
  const item = await queryConnection<MenuItemRecord>(
    client,
    'posMenuItems',
    { filter: { id: { eq: menuItemId } }, first: 1 },
    MENU_ITEM_FIELDS,
  );

  return item[0] ?? null;
};

const findActiveStopListEntry = async (
  client: CoreApiClientLike,
  menuItemId: string,
): Promise<StopListEntryRecord | null> => {
  const entries = await queryConnection<StopListEntryRecord>(
    client,
    'posStopListEntries',
    {
      filter: { menuItemId: { eq: menuItemId }, isActive: { eq: true } },
      first: 1,
    },
    STOP_LIST_FIELDS,
  );

  return entries.find((entry) => entry.isActive === true) ?? null;
};

const findOrderById = async (
  client: CoreApiClientLike,
  orderId: string,
): Promise<OrderRecord | null> => {
  const order = await queryConnection<OrderRecord>(
    client,
    'posOrders',
    { filter: { id: { eq: orderId } }, first: 1 },
    ORDER_FIELDS,
  );

  return order[0] ?? null;
};

const findOrderByIdempotencyKey = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<OrderRecord | null> => {
  const order = await queryConnection<OrderRecord>(
    client,
    'posOrders',
    { filter: { idempotencyKey: { eq: idempotencyKey } }, first: 1 },
    ORDER_FIELDS,
  );

  return order[0] ?? null;
};

const findActiveOrderForTable = async (
  client: CoreApiClientLike,
  tableId: string,
): Promise<OrderRecord | null> => {
  const orders = await queryConnection<OrderRecord>(
    client,
    'posOrders',
    { filter: { tableId: { eq: tableId } }, first: 100 },
    ORDER_FIELDS,
  );

  return (
    orders.find((order) => isPosOrderActive(order.status as PosOrderStatus)) ??
    null
  );
};

const findGuestById = async (
  client: CoreApiClientLike,
  guestId: string,
): Promise<GuestRecord | null> => {
  const guest = await queryConnection<GuestRecord>(
    client,
    'posOrderGuests',
    { filter: { id: { eq: guestId } }, first: 1 },
    GUEST_FIELDS,
  );

  return guest[0] ?? null;
};

const findGuestByIdempotencyKey = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<GuestRecord | null> => {
  const guest = await queryConnection<GuestRecord>(
    client,
    'posOrderGuests',
    { filter: { idempotencyKey: { eq: idempotencyKey } }, first: 1 },
    GUEST_FIELDS,
  );

  return guest[0] ?? null;
};

const findGuestsByOrder = async (
  client: CoreApiClientLike,
  orderId: string,
): Promise<GuestRecord[]> => {
  const guests = await queryConnection<GuestRecord>(
    client,
    'posOrderGuests',
    { filter: { orderId: { eq: orderId } }, first: 100 },
    GUEST_FIELDS,
  );

  return guests.sort(
    (left, right) => (left.ordinal ?? 0) - (right.ordinal ?? 0),
  );
};

const findLineById = async (
  client: CoreApiClientLike,
  lineId: string,
): Promise<LineRecord | null> => {
  const line = await queryConnection<LineRecord>(
    client,
    'posOrderLines',
    { filter: { id: { eq: lineId } }, first: 1 },
    LINE_FIELDS,
  );

  return line[0] ?? null;
};

const findLineByIdempotencyKey = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<LineRecord | null> => {
  const line = await queryConnection<LineRecord>(
    client,
    'posOrderLines',
    { filter: { idempotencyKey: { eq: idempotencyKey } }, first: 1 },
    LINE_FIELDS,
  );

  return line[0] ?? null;
};

const findLinesByOrder = async (
  client: CoreApiClientLike,
  orderId: string,
): Promise<LineRecord[]> => {
  const lines = await queryConnection<LineRecord>(
    client,
    'posOrderLines',
    { filter: { orderId: { eq: orderId } }, first: 100 },
    LINE_FIELDS,
  );

  return lines.sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
};

const assertOrderEditableForActor = (
  order: OrderRecord,
  actor: PosActor,
): CommandResult | null => {
  if (!isPosOrderEditable(order.status as PosOrderStatus)) {
    return errorResult('ORDER_NOT_EDITABLE', 'Order is locked or closed.');
  }

  if (!orderCanBeEditedBy(order.ownerStaffId, actor)) {
    return errorResult('ORDER_NOT_OWNED', 'Order belongs to another staff member.');
  }

  return null;
};

const updateLinesTotals = async (
  client: CoreApiClientLike,
  order: OrderRecord,
): Promise<{ activeLineCount: number }> => {
  const lines = await findLinesByOrder(client, order.id);
  const activeLines = lines.filter((line) => line.status === 'ACTIVE');

  const orderSubtotalMicros = sumActiveLinesMicros(
    activeLines.map((line) => ({
      unitPrice: line.unitPrice,
      quantity: line.quantity ?? 0,
      status: line.status,
    })),
  );
  const subtotal =
    activeLines.length === 0 ? null : microsToCurrency(orderSubtotalMicros);

  const guests = await findGuestsByOrder(client, order.id);

  for (const guest of guests) {
    const guestLines = activeLines.filter((line) => line.guestId === guest.id);
    const guestSubtotalMicros = sumActiveLinesMicros(
      guestLines.map((line) => ({
        unitPrice: line.unitPrice,
        quantity: line.quantity ?? 0,
        status: line.status,
      })),
    );
    const guestSubtotal =
      guestLines.length === 0 ? null : microsToCurrency(guestSubtotalMicros);
    const current = normalizeCurrency(guest.subtotal);

    if (
      guestSubtotal !== null &&
      (current.amountMicros !== guestSubtotal.amountMicros ||
        current.currencyCode !== guestSubtotal.currencyCode)
    ) {
      await client.mutation({
        updatePosOrderGuest: {
          __args: { id: guest.id, data: { subtotal: guestSubtotal } },
          id: true,
        },
      });
    }
  }

  const currentSubtotal = normalizeCurrency(order.subtotal);
  const currentTotal = normalizeCurrency(order.total);

  const needsTotalsUpdate =
    subtotal === null ||
    currentSubtotal.amountMicros !== subtotal.amountMicros ||
    currentSubtotal.currencyCode !== subtotal.currencyCode ||
    currentTotal.amountMicros !== subtotal.amountMicros ||
    currentTotal.currencyCode !== subtotal.currencyCode;

  const nextStatus = nextPosOrderStatusAfterLineChange(
    order.status as PosOrderStatus,
    activeLines.length,
  );

  const needsStatusUpdate = nextStatus !== order.status;

  if (needsTotalsUpdate || needsStatusUpdate) {
    await client.mutation({
      updatePosOrder: {
        __args: {
          id: order.id,
          data: {
            ...(needsTotalsUpdate ? { subtotal, total: subtotal } : {}),
            ...(needsStatusUpdate ? { status: nextStatus } : {}),
          },
        },
        id: true,
      },
    });
  }

  return { activeLineCount: activeLines.length };
};

const createShift = async (
  client: CoreApiClientLike,
  staffId: string,
  idempotencyKey: string,
): Promise<ShiftRecord> => {
  const openedAt = new Date().toISOString();

  const result = (await client.mutation({
    createPosShift: {
      __args: {
        data: {
          staffId,
          status: 'OPEN',
          openedAt,
          isOpen: true,
          openToken: randomUUID(),
          idempotencyKey,
        },
      },
      id: true,
      status: true,
    },
  })) as { createPosShift?: ShiftRecord };

  const created = result.createPosShift;
  if (!created?.id) {
    throw new Error('Shift was created but could not be read back.');
  }

  return created;
};

export const executeOpenShift = async (
  client: CoreApiClientLike,
  payload: { staffId: string; idempotencyKey: string },
  actor?: PosActor,
): Promise<CommandResult> => {
  const { staffId, idempotencyKey } = payload;

  if (actor && actor.staffId !== staffId) {
    return errorResult(
      'INVALID_STAFF',
      'staffId must match the authenticated POS actor.',
    );
  }

  if (!(await workspaceMemberExists(client, staffId))) {
    return errorResult('INVALID_STAFF', 'Staff member does not exist.');
  }

  const existingByIdempotency = await findShiftByIdempotencyKey(
    client,
    idempotencyKey,
  );

  if (existingByIdempotency) {
    if (existingByIdempotency.staffId !== staffId) {
      return idempotencyConflict(
        'The idempotency key belongs to another staff member.',
      );
    }

    return okResult(200, {
      shiftId: existingByIdempotency.id,
      status: existingByIdempotency.status ?? 'OPEN',
    });
  }

  try {
    const created = await createShift(client, staffId, idempotencyKey);
    return okResult(201, { shiftId: created.id, status: created.status });
  } catch {
    // A concurrent caller may have won the unique (staffId, isOpen) race.
    const raced = await findOpenShiftByStaffId(client, staffId);

    if (raced) {
      return okResult(200, { shiftId: raced.id, status: raced.status ?? 'OPEN' });
    }

    return errorResult('CONFLICT', 'Shift could not be opened.');
  }
};

export const executeCloseShift = async (
  client: CoreApiClientLike,
  payload: { shiftId: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const shift = await findShiftById(client, payload.shiftId);

  if (!shift) {
    return errorResult('SHIFT_NOT_FOUND', 'Shift does not exist.');
  }

  if (shift.status === 'CLOSED') {
    return okResult(200, {
      shiftId: shift.id,
      status: 'CLOSED',
      closedAt: shift.closedAt ?? null,
    });
  }

  if (shift.status !== 'OPEN') {
    return errorResult('SHIFT_ALREADY_CLOSED', 'Shift is already closed.');
  }

  if (!shiftCanBeClosedBy(shift.staffId, actor)) {
    return errorResult('SHIFT_NOT_OWNED', 'Shift belongs to another staff member.');
  }

  const closedAt = new Date().toISOString();

  await client.mutation({
    updatePosShift: {
      __args: {
        id: shift.id,
        data: { status: 'CLOSED', closedAt, isOpen: null, openToken: null },
      },
      id: true,
    },
  });

  return okResult(200, { shiftId: shift.id, status: 'CLOSED', closedAt });
};

export const executeOpenOrder = async (
  client: CoreApiClientLike,
  payload: { tableId: string; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const openShift = await findOpenShiftByStaffId(client, actor.staffId);

  if (!openShift) {
    return errorResult('SHIFT_REQUIRED', 'Open a shift before opening an order.');
  }

  const table = await findTableById(client, payload.tableId);

  if (!table) {
    return errorResult('TABLE_NOT_FOUND', 'Table does not exist.');
  }

  if (table.isActive === false) {
    return errorResult('TABLE_INACTIVE', 'Table is not active.');
  }

  const existingByIdempotency = await findOrderByIdempotencyKey(
    client,
    payload.idempotencyKey,
  );

  if (existingByIdempotency) {
    if (
      existingByIdempotency.tableId !== payload.tableId ||
      existingByIdempotency.ownerStaffId !== actor.staffId
    ) {
      return idempotencyConflict(
        'The idempotency key belongs to another order context.',
      );
    }

    return okResult(200, {
      orderId: existingByIdempotency.id,
      status: existingByIdempotency.status ?? 'OPEN',
    });
  }

  const openedAt = new Date().toISOString();

  try {
    const result = (await client.mutation({
      createPosOrder: {
        __args: {
          data: {
            shiftId: openShift.id,
            tableId: payload.tableId,
            ownerStaffId: actor.staffId,
            openedByStaffId: actor.staffId,
            status: 'OPEN',
            openedAt,
            claimToken: payload.tableId,
            idempotencyKey: payload.idempotencyKey,
            subtotal: null,
            total: null,
          },
        },
        id: true,
        status: true,
      },
    })) as { createPosOrder?: OrderRecord };

    const created = result.createPosOrder;
    if (!created?.id) {
      throw new Error('Order was created but could not be read back.');
    }

    return okResult(201, { orderId: created.id, status: created.status });
  } catch {
    // A concurrent caller may have won the unique (tableId, claimToken) race.
    const raced = await findActiveOrderForTable(client, payload.tableId);

    if (raced) {
      if (
        raced.idempotencyKey &&
        raced.idempotencyKey === payload.idempotencyKey
      ) {
        return okResult(200, {
          orderId: raced.id,
          status: raced.status ?? 'OPEN',
        });
      }

      return {
        status: 409,
        body: {
          code: 'TABLE_NOT_AVAILABLE',
          message: 'The table already has an active order.',
          orderId: raced.id,
        },
      };
    }

    return errorResult('CONFLICT', 'Order could not be opened.');
  }
};

export const executeAddGuest = async (
  client: CoreApiClientLike,
  payload: { orderId: string; idempotencyKey: string; name?: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const order = await findOrderById(client, payload.orderId);

  if (!order) {
    return errorResult('ORDER_NOT_FOUND', 'Order does not exist.');
  }

  const editableIssue = assertOrderEditableForActor(order, actor);
  if (editableIssue) return editableIssue;

  const existingByIdempotency = await findGuestByIdempotencyKey(
    client,
    payload.idempotencyKey,
  );

  if (existingByIdempotency) {
    const existingName = existingByIdempotency.name ?? null;
    const requestedName = payload.name ?? null;

    if (
      existingByIdempotency.orderId !== payload.orderId ||
      existingName !== requestedName
    ) {
      return idempotencyConflict(
        'The idempotency key belongs to another guest context.',
      );
    }

    return okResult(200, { guestId: existingByIdempotency.id });
  }

  const guests = await findGuestsByOrder(client, payload.orderId);
  const lastGuest = guests[guests.length - 1];
  const ordinal = (lastGuest?.ordinal ?? 0) + 1;
  const displayNumber = `Гость ${ordinal}`;

  try {
    const result = (await client.mutation({
      createPosOrderGuest: {
        __args: {
          data: {
            orderId: payload.orderId,
            ordinal,
            displayNumber,
            ...(payload.name ? { name: payload.name } : {}),
            idempotencyKey: payload.idempotencyKey,
            subtotal: null,
          },
        },
        id: true,
      },
    })) as { createPosOrderGuest?: GuestRecord };

    const created = result.createPosOrderGuest;
    if (!created?.id) {
      throw new Error('Guest was created but could not be read back.');
    }

    return okResult(201, { guestId: created.id, displayNumber });
  } catch {
    const raced = await findGuestByIdempotencyKey(client, payload.idempotencyKey);

    if (raced) {
      return okResult(200, { guestId: raced.id });
    }

    return errorResult('CONFLICT', 'Guest could not be added.');
  }
};

export const executeAddLine = async (
  client: CoreApiClientLike,
  payload: {
    orderId: string;
    guestId: string;
    menuItemId: string;
    quantity: number;
    idempotencyKey: string;
  },
  actor: PosActor,
): Promise<CommandResult> => {
  const order = await findOrderById(client, payload.orderId);

  if (!order) {
    return errorResult('ORDER_NOT_FOUND', 'Order does not exist.');
  }

  const editableIssue = assertOrderEditableForActor(order, actor);
  if (editableIssue) return editableIssue;

  const guest = await findGuestById(client, payload.guestId);

  if (!guest) {
    return errorResult('GUEST_NOT_FOUND', 'Guest does not exist.');
  }

  if (guest.orderId !== payload.orderId) {
    return errorResult('GUEST_NOT_IN_ORDER', 'Guest does not belong to the order.');
  }

  const menuItem = await findMenuItemById(client, payload.menuItemId);

  if (!menuItem) {
    return errorResult('MENU_ITEM_NOT_FOUND', 'Menu item does not exist.');
  }

  if (menuItem.isActive === false) {
    return errorResult('MENU_ITEM_INACTIVE', 'Menu item is not active.');
  }

  const stopListed = await findActiveStopListEntry(client, payload.menuItemId);

  if (stopListed) {
    return errorResult('STOP_LISTED', 'Menu item is on the active stop list.');
  }

  const existingByIdempotency = await findLineByIdempotencyKey(
    client,
    payload.idempotencyKey,
  );

  if (existingByIdempotency) {
    if (
      existingByIdempotency.orderId !== payload.orderId ||
      existingByIdempotency.guestId !== payload.guestId ||
      existingByIdempotency.menuItemId !== payload.menuItemId ||
      existingByIdempotency.quantity !== payload.quantity ||
      existingByIdempotency.createdByStaffId !== actor.staffId
    ) {
      return idempotencyConflict(
        'The idempotency key belongs to another line context.',
      );
    }

    return okResult(200, { lineId: existingByIdempotency.id });
  }

  const unitPrice = normalizeCurrency(menuItem.price);

  try {
    const result = (await client.mutation({
      createPosOrderLine: {
        __args: {
          data: {
            orderId: payload.orderId,
            guestId: payload.guestId,
            menuItemId: payload.menuItemId,
            itemNameSnapshot: menuItem.name ?? '',
            unitPrice,
            quantity: payload.quantity,
            status: 'ACTIVE',
            createdByStaffId: actor.staffId,
            idempotencyKey: payload.idempotencyKey,
          },
        },
        id: true,
      },
    })) as { createPosOrderLine?: LineRecord };

    const created = result.createPosOrderLine;
    if (!created?.id) {
      throw new Error('Line was created but could not be read back.');
    }

    await updateLinesTotals(client, order);

    return okResult(201, { lineId: created.id, orderId: payload.orderId });
  } catch {
    const raced = await findLineByIdempotencyKey(client, payload.idempotencyKey);

    if (raced) {
      return okResult(200, { lineId: raced.id });
    }

    return errorResult('CONFLICT', 'Line could not be added.');
  }
};

export const executeChangeLineQuantity = async (
  client: CoreApiClientLike,
  payload: { lineId: string; quantity: number },
  actor: PosActor,
): Promise<CommandResult> => {
  const line = await findLineById(client, payload.lineId);

  if (!line) {
    return errorResult('LINE_NOT_FOUND', 'Line does not exist.');
  }

  if (line.status !== 'ACTIVE') {
    return errorResult('LINE_NOT_EDITABLE', 'Voided lines cannot be changed.');
  }

  if (!line.orderId) {
    return errorResult('LINE_NOT_EDITABLE', 'Line is not attached to an order.');
  }

  const order = await findOrderById(client, line.orderId);

  if (!order) {
    return errorResult('ORDER_NOT_FOUND', 'Order does not exist.');
  }

  const editableIssue = assertOrderEditableForActor(order, actor);
  if (editableIssue) return editableIssue;

  await client.mutation({
    updatePosOrderLine: {
      __args: { id: line.id, data: { quantity: payload.quantity } },
      id: true,
    },
  });

  await updateLinesTotals(client, order);

  return okResult(200, { lineId: line.id, quantity: payload.quantity });
};

export const dispatchPosCommand = async (
  client: CoreApiClientLike,
  command: PosCommand,
  payload: Record<string, unknown>,
  actor: PosActor,
): Promise<CommandResult> => {
  if (!commandAllowedForRole(command, actor.role)) {
    return {
      status: 403,
      body: {
        code: 'COMMAND_FORBIDDEN',
        message: `Role ${actor.role} cannot run command ${command}.`,
      },
    };
  }

  switch (command) {
    case 'openShift':
      return executeOpenShift(client, {
        staffId: payload.staffId as string,
        idempotencyKey: payload.idempotencyKey as string,
      }, actor);
    case 'closeShift':
      return executeCloseShift(
        client,
        { shiftId: payload.shiftId as string },
        actor,
      );
    case 'openOrder':
      return executeOpenOrder(
        client,
        {
          tableId: payload.tableId as string,
          idempotencyKey: payload.idempotencyKey as string,
        },
        actor,
      );
    case 'addGuest':
      return executeAddGuest(
        client,
        {
          orderId: payload.orderId as string,
          idempotencyKey: payload.idempotencyKey as string,
          name: payload.name as string | undefined,
        },
        actor,
      );
    case 'addLine':
      return executeAddLine(
        client,
        {
          orderId: payload.orderId as string,
          guestId: payload.guestId as string,
          menuItemId: payload.menuItemId as string,
          quantity: payload.quantity as number,
          idempotencyKey: payload.idempotencyKey as string,
        },
        actor,
      );
    case 'changeLineQuantity':
      return executeChangeLineQuantity(
        client,
        { lineId: payload.lineId as string, quantity: payload.quantity as number },
        actor,
      );
  }
};
