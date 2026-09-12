import { createHash, randomUUID } from 'crypto';

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
  POS_CURRENCY_CODE,
  sumActiveLinesMicros,
} from 'src/pos/pos-money';
import {
  executeRetryPrintJob,
  findPrinter,
  findStation,
  enqueueKitchenPrintJobs,
  enqueuePrecheckPrintJob,
  type KitchenQueueLine,
  type PrecheckQueueSnapshot,
} from 'src/printing/print-queue';

const ensureInventoryConsumptionRequest = async (client: CoreApiClientLike, orderId: string): Promise<void> => {
  try {
    await client.mutation({
      createInventoryConsumptionRequest: {
        __args: { data: { orderId, status: 'PENDING', idempotencyKey: orderId, attemptCount: 0 } },
        id: true,
      },
    });
  } catch {
    // recovery cron will handle
  }
};

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
  productionStationId?: string | null;
};

type ProductionStationRecord = ExistingRecord & {
  label?: string | null;
  isActive?: boolean | null;
  printerDeviceId?: string | null;
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
  paidTotal?: unknown;
  prepaidTotal?: unknown;
  closedByStaffId?: string | null;
  closeIdempotencyKey?: string | null;
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
  kitchenSentQuantity?: number | null;
  status?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  voidPreparedState?: string | null;
  voidedByStaffId?: string | null;
  createdByStaffId?: string | null;
  idempotencyKey?: string | null;
};

type StopListEntryRecord = ExistingRecord & {
  menuItemId?: string | null;
  isActive?: boolean | null;
  idempotencyKey?: string | null;
  createdByStaffId?: string | null;
  clearedAt?: string | null;
  clearedByStaffId?: string | null;
};

type KitchenTicketRecord = ExistingRecord & {
  orderId?: string | null;
  ticketType?: string | null;
  createdAt?: string | null;
  createdByStaffId?: string | null;
  printStatus?: string | null;
  idempotencyKey?: string | null;
  requestIdempotencyKey?: string | null;
};

type KitchenTicketLineRecord = ExistingRecord & {
  ticketId?: string | null;
  orderLineId?: string | null;
  guestId?: string | null;
  guestDisplayNumber?: string | null;
  itemNameSnapshot?: string | null;
  quantity?: number | null;
  action?: string | null;
  productionStationId?: string | null;
  stationNameSnapshot?: string | null;
};

const toKitchenQueueLines = (lines: KitchenTicketLineRecord[]): KitchenQueueLine[] =>
  lines
    .filter((line): line is KitchenTicketLineRecord & { orderLineId: string } => Boolean(line.orderLineId))
    .map((line) => ({
      orderLineId: line.orderLineId,
      guestId: line.guestId ?? null,
      guestDisplayNumber: line.guestDisplayNumber ?? null,
      itemNameSnapshot: line.itemNameSnapshot ?? '',
      quantity: Math.max(0, line.quantity ?? 0),
      action: line.action === 'CANCEL' ? 'CANCEL' : 'ADD',
      productionStationId: line.productionStationId ?? null,
      stationNameSnapshot: line.stationNameSnapshot ?? null,
    }));

type PrecheckRecord = ExistingRecord & {
  orderId?: string | null;
  status?: string | null;
  subtotalSnapshot?: unknown;
  totalSnapshot?: unknown;
  guestTotalsSnapshot?: string | null;
  createdByStaffId?: string | null;
  cancelledAt?: string | null;
  cancelledByStaffId?: string | null;
  activeOrderKey?: string | null;
  idempotencyKey?: string | null;
  cancelIdempotencyKey?: string | null;
  printStatus?: string | null;
  guestItemsSnapshot?: string | null;
  createdAt?: string | null;
};

type PaymentMethodRecord = ExistingRecord & {
  name?: string | null;
  methodType?: string | null;
  isActive?: boolean | null;
  sortOrder?: number | null;
};

type PaymentRecord = ExistingRecord & {
  orderId?: string | null;
  paymentMethodId?: string | null;
  amount?: unknown;
  status?: string | null;
  acceptedByStaffId?: string | null;
  idempotencyKey?: string | null;
  lockKey?: string | null;
  paymentMethodNameSnapshot?: string | null;
  paymentMethodTypeSnapshot?: string | null;
  orderPaidTotalBefore?: unknown;
  appliedToOrder?: boolean | null;
  tenderedAmount?: unknown;
  changeAmount?: unknown;
};

type ReservationRecord = ExistingRecord & {
  tableId?: string | null;
  orderId?: string | null;
  scheduledAt?: string | null;
  guestName?: string | null;
  phone?: string | null;
  status?: string | null;
  createdByStaffId?: string | null;
  idempotencyKey?: string | null;
};

type PrepaymentRecord = ExistingRecord & {
  reservationId?: string | null;
  orderId?: string | null;
  paymentMethodId?: string | null;
  amount?: unknown;
  status?: string | null;
  createdByStaffId?: string | null;
  appliedByStaffId?: string | null;
  idempotencyKey?: string | null;
  applyIdempotencyKey?: string | null;
  appliedAt?: string | null;
};

type StaffRecord = ExistingRecord & {
  displayName?: string | null;
  staffRole?: string | null;
  isActive?: boolean | null;
};

type OperationalEventRecord = ExistingRecord & {
  label?: string | null;
  eventType?: string | null;
  actorStaffId?: string | null;
  occurredAt?: string | null;
  orderId?: string | null;
  details?: string | null;
  idempotencyKey?: string | null;
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
  'LINE_ALREADY_SENT',
  'STOP_LIST_NOT_FOUND',
  'KITCHEN_TICKET_NOT_FOUND',
  'PRINT_JOB_NOT_FOUND',
  'PRINTER_DEVICE_NOT_FOUND',
  'PRODUCTION_STATION_NOT_FOUND',
  'PRINT_CONFIG_INVALID',
  'PRECHECK_NOT_FOUND',
  'PRECHECK_NOT_ACTIVE',
  'PAYMENT_METHOD_NOT_FOUND',
  'PAYMENT_METHOD_INACTIVE',
  'PAYMENT_NOT_FOUND',
  'PAYMENT_IN_PROGRESS',
  'PAYMENT_ORDER_STATE',
  'OVERPAYMENT',
  'PAYMENT_AMOUNT_INVALID',
  'ORDER_NOT_PAID',
  'RESERVATION_NOT_FOUND',
  'RESERVATION_STATUS_INVALID',
  'RESERVATION_TABLE_MISMATCH',
  'PREPAYMENT_NOT_FOUND',
  'PREPAYMENT_ALREADY_APPLIED',
  'PREPAYMENT_AMOUNT_INVALID',
  'PREPAYMENT_EXCEEDS_ORDER',
  'STAFF_NOT_FOUND',
  'STAFF_INACTIVE',
  'GUEST_TRANSFER_INVALID',
  'VOID_LINE_INVALID',
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

const normalizeGuestName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

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
  productionStationId: true,
};

const PRODUCTION_STATION_FIELDS: NodeSelection = {
  id: true,
  label: true,
  isActive: true,
  printerDeviceId: true,
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
  paidTotal: { amountMicros: true, currencyCode: true },
  prepaidTotal: { amountMicros: true, currencyCode: true },
  closedByStaffId: true,
  closeIdempotencyKey: true,
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
  kitchenSentQuantity: true,
  status: true,
  voidedAt: true,
  voidReason: true,
  voidPreparedState: true,
  voidedByStaffId: true,
  createdByStaffId: true,
  idempotencyKey: true,
};

const STOP_LIST_FIELDS: NodeSelection = {
  id: true,
  menuItemId: true,
  isActive: true,
  idempotencyKey: true,
  createdByStaffId: true,
  clearedAt: true,
  clearedByStaffId: true,
};

const KITCHEN_TICKET_FIELDS: NodeSelection = {
  id: true,
  orderId: true,
  ticketType: true,
  createdAt: true,
  createdByStaffId: true,
  printStatus: true,
  idempotencyKey: true,
  requestIdempotencyKey: true,
};

const KITCHEN_TICKET_LINE_FIELDS: NodeSelection = {
  id: true,
  ticketId: true,
  orderLineId: true,
  guestId: true,
  guestDisplayNumber: true,
  itemNameSnapshot: true,
  quantity: true,
  action: true,
  productionStationId: true,
  stationNameSnapshot: true,
};

const PRECHECK_FIELDS: NodeSelection = {
  id: true,
  orderId: true,
  status: true,
  subtotalSnapshot: { amountMicros: true, currencyCode: true },
  totalSnapshot: { amountMicros: true, currencyCode: true },
  guestTotalsSnapshot: true,
  createdByStaffId: true,
  cancelledAt: true,
  cancelledByStaffId: true,
  activeOrderKey: true,
  idempotencyKey: true,
  cancelIdempotencyKey: true,
  printStatus: true,
  guestItemsSnapshot: true,
  createdAt: true,
};

const PAYMENT_METHOD_FIELDS: NodeSelection = {
  id: true,
  name: true,
  methodType: true,
  isActive: true,
  sortOrder: true,
};

const PAYMENT_FIELDS: NodeSelection = {
  id: true,
  orderId: true,
  paymentMethodId: true,
  amount: { amountMicros: true, currencyCode: true },
  status: true,
  acceptedByStaffId: true,
  idempotencyKey: true,
  lockKey: true,
  paymentMethodNameSnapshot: true,
  paymentMethodTypeSnapshot: true,
  orderPaidTotalBefore: { amountMicros: true, currencyCode: true },
  appliedToOrder: true,
  tenderedAmount: { amountMicros: true, currencyCode: true },
  changeAmount: { amountMicros: true, currencyCode: true },
};

const RESERVATION_FIELDS: NodeSelection = {
  id: true,
  tableId: true,
  orderId: true,
  scheduledAt: true,
  guestName: true,
  phone: true,
  status: true,
  createdByStaffId: true,
  idempotencyKey: true,
};

const PREPAYMENT_FIELDS: NodeSelection = {
  id: true,
  reservationId: true,
  orderId: true,
  paymentMethodId: true,
  amount: { amountMicros: true, currencyCode: true },
  status: true,
  createdByStaffId: true,
  appliedByStaffId: true,
  idempotencyKey: true,
  applyIdempotencyKey: true,
  appliedAt: true,
};

const STAFF_FIELDS: NodeSelection = {
  id: true,
  displayName: true,
  staffRole: true,
  isActive: true,
};

const OPERATIONAL_EVENT_FIELDS: NodeSelection = {
  id: true,
  label: true,
  eventType: true,
  actorStaffId: true,
  occurredAt: true,
  orderId: true,
  details: true,
  idempotencyKey: true,
};

const queryConnection = async <T extends ExistingRecord>(
  client: CoreApiClientLike,
  root: string,
  args: Record<string, unknown>,
  nodeFields: NodeSelection,
): Promise<T[]> => {
  // Callers provide the standard Twenty connection arguments (`filter`, `first`).
  // Keep accepting a raw filter as well, but do not nest `filter` inside `filter`.
  // Twenty rejects that shape at runtime with:
  // "Filter for field ... must have exactly one operator".
  const connectionArgs = 'filter' in args ? args : { filter: args };
  const result = (await client.query({
    [root]: {
      __args: { first: 100, ...connectionArgs },
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

const findStopListEntryByMenuItem = async (
  client: CoreApiClientLike,
  menuItemId: string,
): Promise<StopListEntryRecord | null> => {
  const entries = await queryConnection<StopListEntryRecord>(
    client,
    'posStopListEntries',
    { filter: { menuItemId: { eq: menuItemId } }, first: 1 },
    STOP_LIST_FIELDS,
  );

  return entries[0] ?? null;
};

const findStopListEntryByIdempotencyKey = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<StopListEntryRecord | null> => {
  const entries = await queryConnection<StopListEntryRecord>(
    client,
    'posStopListEntries',
    { filter: { idempotencyKey: { eq: idempotencyKey } }, first: 1 },
    STOP_LIST_FIELDS,
  );

  return entries[0] ?? null;
};

const findKitchenTicketByRequestIdempotencyKey = async (
  client: CoreApiClientLike,
  requestIdempotencyKey: string,
): Promise<KitchenTicketRecord | null> => {
  const tickets = await queryConnection<KitchenTicketRecord>(
    client,
    'posKitchenTickets',
    {
      filter: { requestIdempotencyKey: { eq: requestIdempotencyKey } },
      first: 1,
    },
    KITCHEN_TICKET_FIELDS,
  );

  return tickets[0] ?? null;
};

const findKitchenTicketBySemanticKey = async (
  client: CoreApiClientLike,
  semanticKey: string,
): Promise<KitchenTicketRecord | null> => {
  const tickets = await queryConnection<KitchenTicketRecord>(
    client,
    'posKitchenTickets',
    { filter: { idempotencyKey: { eq: semanticKey } }, first: 1 },
    KITCHEN_TICKET_FIELDS,
  );

  return tickets[0] ?? null;
};

const findKitchenTicketsByOrder = async (
  client: CoreApiClientLike,
  orderId: string,
): Promise<KitchenTicketRecord[]> =>
  queryConnection<KitchenTicketRecord>(
    client,
    'posKitchenTickets',
    { filter: { orderId: { eq: orderId } }, first: 100 },
    KITCHEN_TICKET_FIELDS,
  );

const findProductionStationById = async (
  client: CoreApiClientLike,
  stationId: string,
): Promise<ProductionStationRecord | null> => {
  const stations = await queryConnection<ProductionStationRecord>(
    client,
    'posProductionStations',
    { filter: { id: { eq: stationId } }, first: 1 },
    PRODUCTION_STATION_FIELDS,
  );
  return stations[0] ?? null;
};

const findKitchenTicketLines = async (
  client: CoreApiClientLike,
  ticketId: string,
): Promise<KitchenTicketLineRecord[]> =>
  queryConnection<KitchenTicketLineRecord>(
    client,
    'posKitchenTicketLines',
    { filter: { ticketId: { eq: ticketId } }, first: 100 },
    KITCHEN_TICKET_LINE_FIELDS,
  );

const findKitchenTicketLine = async (
  client: CoreApiClientLike,
  ticketId: string,
  orderLineId: string,
): Promise<KitchenTicketLineRecord | null> => {
  const lines = await queryConnection<KitchenTicketLineRecord>(
    client,
    'posKitchenTicketLines',
    {
      filter: { ticketId: { eq: ticketId }, orderLineId: { eq: orderLineId } },
      first: 1,
    },
    KITCHEN_TICKET_LINE_FIELDS,
  );
  return lines[0] ?? null;
};

const findPrecheckByIdempotencyKey = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<PrecheckRecord | null> => {
  const prechecks = await queryConnection<PrecheckRecord>(
    client,
    'posPrechecks',
    { filter: { idempotencyKey: { eq: idempotencyKey } }, first: 1 },
    PRECHECK_FIELDS,
  );
  return prechecks[0] ?? null;
};

const findActivePrecheckByOrderId = async (
  client: CoreApiClientLike,
  orderId: string,
): Promise<PrecheckRecord | null> => {
  const prechecks = await queryConnection<PrecheckRecord>(
    client,
    'posPrechecks',
    { filter: { activeOrderKey: { eq: orderId } }, first: 1 },
    PRECHECK_FIELDS,
  );
  return prechecks.find((precheck) => precheck.status === 'ACTIVE') ?? null;
};

const findPrecheckByCancelIdempotencyKey = async (
  client: CoreApiClientLike,
  cancelIdempotencyKey: string,
): Promise<PrecheckRecord | null> => {
  const prechecks = await queryConnection<PrecheckRecord>(
    client,
    'posPrechecks',
    { filter: { cancelIdempotencyKey: { eq: cancelIdempotencyKey } }, first: 1 },
    PRECHECK_FIELDS,
  );
  return prechecks[0] ?? null;
};

const findPaymentMethodById = async (
  client: CoreApiClientLike,
  paymentMethodId: string,
): Promise<PaymentMethodRecord | null> => {
  const methods = await queryConnection<PaymentMethodRecord>(
    client,
    'posPaymentMethods',
    { filter: { id: { eq: paymentMethodId } }, first: 1 },
    PAYMENT_METHOD_FIELDS,
  );
  return methods[0] ?? null;
};

const findPaymentByIdempotencyKey = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<PaymentRecord | null> => {
  const payments = await queryConnection<PaymentRecord>(
    client,
    'posPayments',
    { filter: { idempotencyKey: { eq: idempotencyKey } }, first: 1 },
    PAYMENT_FIELDS,
  );
  return payments[0] ?? null;
};

const findPendingPaymentByOrder = async (
  client: CoreApiClientLike,
  orderId: string,
): Promise<PaymentRecord | null> => {
  const payments = await queryConnection<PaymentRecord>(
    client,
    'posPayments',
    { filter: { lockKey: { eq: orderId }, status: { eq: 'PENDING' } }, first: 1 },
    PAYMENT_FIELDS,
  );
  return payments[0] ?? null;
};

const findReservationById = async (
  client: CoreApiClientLike,
  reservationId: string,
): Promise<ReservationRecord | null> => {
  const rows = await queryConnection<ReservationRecord>(
    client,
    'posReservations',
    { filter: { id: { eq: reservationId } }, first: 1 },
    RESERVATION_FIELDS,
  );
  return rows[0] ?? null;
};

const findReservationByIdempotencyKey = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<ReservationRecord | null> => {
  const rows = await queryConnection<ReservationRecord>(
    client,
    'posReservations',
    { filter: { idempotencyKey: { eq: idempotencyKey } }, first: 1 },
    RESERVATION_FIELDS,
  );
  return rows[0] ?? null;
};

const findPrepaymentById = async (
  client: CoreApiClientLike,
  prepaymentId: string,
): Promise<PrepaymentRecord | null> => {
  const rows = await queryConnection<PrepaymentRecord>(
    client,
    'posPrepayments',
    { filter: { id: { eq: prepaymentId } }, first: 1 },
    PREPAYMENT_FIELDS,
  );
  return rows[0] ?? null;
};

const findPrepaymentByIdempotencyKey = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<PrepaymentRecord | null> => {
  const rows = await queryConnection<PrepaymentRecord>(
    client,
    'posPrepayments',
    { filter: { idempotencyKey: { eq: idempotencyKey } }, first: 1 },
    PREPAYMENT_FIELDS,
  );
  return rows[0] ?? null;
};

const findPrepaymentByApplyIdempotencyKey = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<PrepaymentRecord | null> => {
  const rows = await queryConnection<PrepaymentRecord>(
    client,
    'posPrepayments',
    { filter: { applyIdempotencyKey: { eq: idempotencyKey } }, first: 1 },
    PREPAYMENT_FIELDS,
  );
  return rows[0] ?? null;
};

const findStaffById = async (
  client: CoreApiClientLike,
  staffId: string,
): Promise<StaffRecord | null> => {
  const rows = await queryConnection<StaffRecord>(
    client,
    'posStaffs',
    { filter: { id: { eq: staffId } }, first: 1 },
    STAFF_FIELDS,
  );
  return rows[0] ?? null;
};

const findOperationalEventByIdempotencyKey = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<OperationalEventRecord | null> => {
  const rows = await queryConnection<OperationalEventRecord>(
    client,
    'posOperationalEvents',
    { filter: { idempotencyKey: { eq: idempotencyKey } }, first: 1 },
    OPERATIONAL_EVENT_FIELDS,
  );
  return rows[0] ?? null;
};

const findPrepaymentsByReservation = async (
  client: CoreApiClientLike,
  reservationId: string,
): Promise<PrepaymentRecord[]> =>
  queryConnection<PrepaymentRecord>(
    client,
    'posPrepayments',
    { filter: { reservationId: { eq: reservationId } }, first: 100 },
    PREPAYMENT_FIELDS,
  );

const findOrderByCloseIdempotencyKey = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<OrderRecord | null> => {
  const orders = await queryConnection<OrderRecord>(
    client,
    'posOrders',
    { filter: { closeIdempotencyKey: { eq: idempotencyKey } }, first: 1 },
    ORDER_FIELDS,
  );
  return orders[0] ?? null;
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
    const needsGuestSubtotalUpdate =
      guestSubtotal === null
        ? guest.subtotal != null
        : current.amountMicros !== guestSubtotal.amountMicros ||
          current.currencyCode !== guestSubtotal.currencyCode;

    if (needsGuestSubtotalUpdate) {
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

const createOperationalEvent = async (
  client: CoreApiClientLike,
  input: {
    eventType: string;
    actorStaffId: string;
    orderId?: string;
    details: Record<string, unknown>;
    idempotencyKey: string;
  },
): Promise<OperationalEventRecord | null> => {
  const existing = await findOperationalEventByIdempotencyKey(
    client,
    input.idempotencyKey,
  );
  if (existing) return existing;

  const details = JSON.stringify(input.details);
  try {
    const result = (await client.mutation({
      createPosOperationalEvent: {
        __args: {
          data: {
            label: input.eventType,
            eventType: input.eventType,
            actorStaffId: input.actorStaffId,
            occurredAt: new Date().toISOString(),
            ...(input.orderId ? { orderId: input.orderId } : {}),
            details,
            idempotencyKey: input.idempotencyKey,
          },
        },
        ...OPERATIONAL_EVENT_FIELDS,
      },
    })) as { createPosOperationalEvent?: OperationalEventRecord };
    return result.createPosOperationalEvent ?? null;
  } catch {
    return findOperationalEventByIdempotencyKey(client, input.idempotencyKey);
  }
};

const PRINTING_PRINTER_FIELDS: NodeSelection = {
  id: true,
  label: true,
  connectionType: true,
  host: true,
  port: true,
  isActive: true,
  isPrecheckPrinter: true,
  paperWidth: true,
  encodingProfile: true,
  escPosCodePage: true,
  cutSupport: true,
  status: true,
};

const PRINTING_STATION_FIELDS: NodeSelection = {
  id: true,
  label: true,
  isActive: true,
  printerDeviceId: true,
};

const validPrinterHost = (host: string): boolean =>
  host.length > 0 && host.length <= 253 && !/[\u0000-\u001f\u007f\s]/.test(host);

export const executeUpsertPrinterDevice = async (
  client: CoreApiClientLike,
  payload: {
    printerDeviceId?: string;
    label: string;
    host: string;
    port: number;
    isActive: boolean;
    isPrecheckPrinter: boolean;
    paperWidth: '58' | '80';
    encodingProfile: 'CP866' | 'WINDOWS1251' | 'UTF8';
    escPosCodePage?: number | null;
    cutSupport: boolean;
  },
  actor: PosActor,
): Promise<CommandResult> => {
  if (!payload.label.trim() || !validPrinterHost(payload.host) || !Number.isInteger(payload.port) || payload.port < 1 || payload.port > 65535) {
    return errorResult('PRINT_CONFIG_INVALID', 'Параметры принтера некорректны.');
  }
  const updatedAt = new Date().toISOString();
  const data = {
    label: payload.label.trim(),
    connectionType: 'ETHERNET_RAW_TCP',
    host: payload.host.trim(),
    port: payload.port,
    isActive: payload.isActive,
    isPrecheckPrinter: payload.isPrecheckPrinter,
    paperWidth: payload.paperWidth,
    encodingProfile: payload.encodingProfile,
    escPosCodePage: payload.escPosCodePage ?? null,
    cutSupport: payload.cutSupport,
    status: 'CONFIGURED',
    updatedAt,
  };
  try {
    const result = payload.printerDeviceId
      ? await client.mutation({ updatePosPrinterDevice: { __args: { id: payload.printerDeviceId, data }, ...PRINTING_PRINTER_FIELDS } })
      : await client.mutation({ createPosPrinterDevice: { __args: { data: { ...data, createdAt: updatedAt } }, ...PRINTING_PRINTER_FIELDS } });
    const printer = (payload.printerDeviceId
      ? (result as { updatePosPrinterDevice?: Record<string, unknown> }).updatePosPrinterDevice
      : (result as { createPosPrinterDevice?: Record<string, unknown> }).createPosPrinterDevice) as { id?: string } | undefined;
    if (!printer?.id) return errorResult('CONFLICT', 'Принтер не удалось сохранить.');
    await createOperationalEvent(client, {
      eventType: 'PRINTER_DEVICE_CONFIGURED',
      actorStaffId: actor.staffId,
      details: { printerDeviceId: printer.id, host: data.host, port: data.port, isActive: data.isActive, isPrecheckPrinter: data.isPrecheckPrinter },
      idempotencyKey: `printer-config:${printer.id}:${updatedAt}`,
    });
    return okResult(payload.printerDeviceId ? 200 : 201, { printerDeviceId: printer.id, status: 'CONFIGURED' });
  } catch {
    return errorResult('CONFLICT', 'Принтер не удалось сохранить.');
  }
};

export const executeUpsertProductionStation = async (
  client: CoreApiClientLike,
  payload: { productionStationId?: string; label: string; printerDeviceId?: string | null; isActive: boolean },
  actor: PosActor,
): Promise<CommandResult> => {
  if (!payload.label.trim()) return errorResult('PRINT_CONFIG_INVALID', 'Название станции не может быть пустым.');
  if (payload.printerDeviceId) {
    const printer = await findPrinter(client, payload.printerDeviceId);
    if (!printer) return errorResult('PRINTER_DEVICE_NOT_FOUND', 'Принтер не найден.');
  }
  const updatedAt = new Date().toISOString();
  const data = { label: payload.label.trim(), printerDeviceId: payload.printerDeviceId ?? null, isActive: payload.isActive, updatedAt };
  try {
    const result = payload.productionStationId
      ? await client.mutation({ updatePosProductionStation: { __args: { id: payload.productionStationId, data }, ...PRINTING_STATION_FIELDS } })
      : await client.mutation({ createPosProductionStation: { __args: { data: { ...data, createdAt: updatedAt } }, ...PRINTING_STATION_FIELDS } });
    const station = (payload.productionStationId
      ? (result as { updatePosProductionStation?: Record<string, unknown> }).updatePosProductionStation
      : (result as { createPosProductionStation?: Record<string, unknown> }).createPosProductionStation) as { id?: string } | undefined;
    if (!station?.id) return errorResult('CONFLICT', 'Станцию не удалось сохранить.');
    await createOperationalEvent(client, {
      eventType: 'PRODUCTION_STATION_CONFIGURED',
      actorStaffId: actor.staffId,
      details: { productionStationId: station.id, printerDeviceId: data.printerDeviceId, isActive: data.isActive },
      idempotencyKey: `station-config:${station.id}:${updatedAt}`,
    });
    return okResult(payload.productionStationId ? 200 : 201, { productionStationId: station.id, status: 'CONFIGURED' });
  } catch {
    return errorResult('CONFLICT', 'Станцию не удалось сохранить.');
  }
};

export const executeSetMenuItemProductionStation = async (
  client: CoreApiClientLike,
  payload: { menuItemId: string; productionStationId?: string | null; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const menuItem = await findMenuItemById(client, payload.menuItemId);
  if (!menuItem) return errorResult('MENU_ITEM_NOT_FOUND', 'Блюдо не найдено.');
  if (payload.productionStationId) {
    const station = await findStation(client, payload.productionStationId);
    if (!station) return errorResult('PRODUCTION_STATION_NOT_FOUND', 'Производственная станция не найдена.');
  }
  try {
    await client.mutation({ updatePosMenuItem: { __args: { id: payload.menuItemId, data: { productionStationId: payload.productionStationId ?? null } }, id: true, productionStationId: true } });
  } catch {
    return errorResult('CONFLICT', 'Маршрут блюда не удалось сохранить.');
  }
  await createOperationalEvent(client, {
    eventType: 'MENU_ITEM_PRINT_ROUTE_CONFIGURED',
    actorStaffId: actor.staffId,
    details: { menuItemId: payload.menuItemId, productionStationId: payload.productionStationId ?? null },
    idempotencyKey: payload.idempotencyKey,
  });
  return okResult(200, { menuItemId: payload.menuItemId, productionStationId: payload.productionStationId ?? null });
};

const parseEventDetails = (event: OperationalEventRecord): Record<string, unknown> => {
  if (!event.details) return {};
  try {
    const parsed: unknown = JSON.parse(event.details);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
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
  payload: { idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const { idempotencyKey } = payload;
  const staffId = actor.staffId;

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
    for (const delayMs of [0, 25, 75, 150]) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const raced = await findOpenShiftByStaffId(client, staffId);
      if (raced) {
        return okResult(200, { shiftId: raced.id, status: raced.status ?? 'OPEN' });
      }
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
            paidTotal: microsToCurrency(0),
            prepaidTotal: microsToCurrency(0),
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
    const existingName = normalizeGuestName(existingByIdempotency.name);
    const requestedName = normalizeGuestName(payload.name);

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
            ...(normalizeGuestName(payload.name)
              ? { name: normalizeGuestName(payload.name) }
              : {}),
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
            kitchenSentQuantity: 0,
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
    // A concurrent duplicate can commit the line before its indexed read is
    // visible to the retrying resolver. Give the authoritative record a short
    // bounded convergence window before returning a transport-looking 500.
    for (const delayMs of [0, 25, 75, 150]) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const raced = await findLineByIdempotencyKey(client, payload.idempotencyKey);
      if (raced) {
        return okResult(200, { lineId: raced.id });
      }
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

  const kitchenSentQuantity = line.kitchenSentQuantity ?? 0;
  if (payload.quantity < kitchenSentQuantity) {
    return errorResult(
      'LINE_ALREADY_SENT',
      'A sent quantity cannot be reduced before an administrative kitchen correction.',
    );
  }

  await client.mutation({
    updatePosOrderLine: {
      __args: { id: line.id, data: { quantity: payload.quantity } },
      id: true,
    },
  });

  await updateLinesTotals(client, order);

  return okResult(200, { lineId: line.id, quantity: payload.quantity });
};

export const executeRemoveUnsentLine = async (
  client: CoreApiClientLike,
  payload: { lineId: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const line = await findLineById(client, payload.lineId);

  if (!line) {
    return errorResult('LINE_NOT_FOUND', 'Line does not exist.');
  }

  if (
    line.status === 'VOIDED' &&
    line.voidReason === 'REMOVED_BEFORE_KITCHEN'
  ) {
    return okResult(200, { lineId: line.id, removed: true, replay: true });
  }

  if (line.status !== 'ACTIVE') {
    return errorResult('LINE_NOT_EDITABLE', 'Voided lines cannot be removed.');
  }

  if ((line.kitchenSentQuantity ?? 0) > 0) {
    return errorResult(
      'LINE_ALREADY_SENT',
      'A sent line requires the administrative kitchen correction flow.',
    );
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
      __args: {
        id: line.id,
        data: {
          status: 'VOIDED',
          voidedAt: new Date().toISOString(),
          voidedByStaffId: actor.staffId,
          voidPreparedState: 'NOT_PREPARED',
          voidReason: 'REMOVED_BEFORE_KITCHEN',
        },
      },
      id: true,
    },
  });

  await updateLinesTotals(client, order);

  return okResult(201, { lineId: line.id, removed: true });
};

export const executeAddStopListEntry = async (
  client: CoreApiClientLike,
  payload: { menuItemId: string; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const menuItem = await findMenuItemById(client, payload.menuItemId);
  if (!menuItem) {
    return errorResult('MENU_ITEM_NOT_FOUND', 'Menu item does not exist.');
  }

  const replay = await findStopListEntryByIdempotencyKey(
    client,
    payload.idempotencyKey,
  );
  if (replay) {
    if (replay.menuItemId !== payload.menuItemId || replay.createdByStaffId !== actor.staffId) {
      return idempotencyConflict('The idempotency key belongs to another stop-list context.');
    }
    return okResult(200, { stopListEntryId: replay.id, isActive: replay.isActive === true });
  }

  const existing = await findStopListEntryByMenuItem(client, payload.menuItemId);
  if (existing) {
    if (existing.isActive === true) {
      return okResult(200, { stopListEntryId: existing.id, isActive: true });
    }

    await client.mutation({
      updatePosStopListEntry: {
        __args: {
          id: existing.id,
          data: {
            isActive: true,
            createdAt: new Date().toISOString(),
            createdByStaffId: actor.staffId,
            clearedAt: null,
            clearedByStaffId: null,
            idempotencyKey: payload.idempotencyKey,
          },
        },
        id: true,
      },
    });
    return okResult(200, { stopListEntryId: existing.id, isActive: true });
  }

  try {
    const result = (await client.mutation({
      createPosStopListEntry: {
        __args: {
          data: {
            menuItemId: payload.menuItemId,
            label: menuItem.name ?? null,
            isActive: true,
            createdAt: new Date().toISOString(),
            createdByStaffId: actor.staffId,
            idempotencyKey: payload.idempotencyKey,
          },
        },
        id: true,
      },
    })) as { createPosStopListEntry?: StopListEntryRecord };
    const created = result.createPosStopListEntry;
    if (!created?.id) throw new Error('Stop-list entry was created but not readable.');
    return okResult(201, { stopListEntryId: created.id, isActive: true });
  } catch {
    const raced = await findStopListEntryByMenuItem(client, payload.menuItemId);
    if (raced) return okResult(200, { stopListEntryId: raced.id, isActive: raced.isActive === true });
    return errorResult('CONFLICT', 'Stop-list entry could not be created.');
  }
};

export const executeClearStopListEntry = async (
  client: CoreApiClientLike,
  payload: { menuItemId: string; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const menuItem = await findMenuItemById(client, payload.menuItemId);
  if (!menuItem) {
    return errorResult('MENU_ITEM_NOT_FOUND', 'Menu item does not exist.');
  }

  const replay = await findStopListEntryByIdempotencyKey(
    client,
    payload.idempotencyKey,
  );
  if (replay) {
    if (replay.menuItemId !== payload.menuItemId || replay.clearedByStaffId !== actor.staffId) {
      return idempotencyConflict('The idempotency key belongs to another stop-list context.');
    }
    return okResult(200, { stopListEntryId: replay.id, isActive: replay.isActive === true });
  }

  const existing = await findStopListEntryByMenuItem(client, payload.menuItemId);
  if (!existing || existing.isActive !== true) {
    return okResult(200, { stopListEntryId: existing?.id ?? null, isActive: false });
  }

  await client.mutation({
    updatePosStopListEntry: {
      __args: {
        id: existing.id,
        data: {
          isActive: false,
          clearedAt: new Date().toISOString(),
          clearedByStaffId: actor.staffId,
          idempotencyKey: payload.idempotencyKey,
        },
      },
      id: true,
    },
  });
  return okResult(200, { stopListEntryId: existing.id, isActive: false });
};

const kitchenSemanticKey = (
  orderId: string,
  lines: LineRecord[],
): string => {
  const snapshot = lines
    .map((line) => `${line.id}:${line.quantity ?? 0}:${line.kitchenSentQuantity ?? 0}`)
    .sort()
    .join('|');
  const digest = createHash('sha256').update(`${orderId}|${snapshot}`).digest('hex');
  return `kitchen-new-items:${orderId}:${digest}`;
};

const repairKitchenTicket = async (
  client: CoreApiClientLike,
  ticket: KitchenTicketRecord,
  actor: PosActor,
): Promise<void> => {
  if (!ticket.orderId) return;
  const tickets = await findKitchenTicketsByOrder(client, ticket.orderId);
  const newItemsTickets = tickets.filter(
    (candidate) => candidate.ticketType === 'NEW_ITEMS',
  );
  const allNewItemLines = (
    await Promise.all(
      newItemsTickets.map((candidate) =>
        findKitchenTicketLines(client, candidate.id),
      ),
    )
  ).flat();
  const ticketLines = await findKitchenTicketLines(client, ticket.id);
  for (const ticketLine of ticketLines) {
    if (!ticketLine.orderLineId) continue;
    const line = await findLineById(client, ticketLine.orderLineId);
    if (!line) continue;
    const sent = allNewItemLines
      .filter(
        (candidate) =>
          candidate.orderLineId === ticketLine.orderLineId &&
          candidate.action === 'ADD',
      )
      .reduce((sum, candidate) => sum + (candidate.quantity ?? 0), 0);
    if (sent !== (line.kitchenSentQuantity ?? 0)) {
      await client.mutation({
        updatePosOrderLine: {
          __args: { id: line.id, data: { kitchenSentQuantity: sent } },
          id: true,
        },
      });
    }
  }

  // A retry after a crash is allowed to repair server-owned sent quantities,
  // but never changes the immutable ticket or its actor.
  void actor;
};

export const executePrintKitchenTicket = async (
  client: CoreApiClientLike,
  payload: { orderId: string; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const order = await findOrderById(client, payload.orderId);
  if (!order) return errorResult('ORDER_NOT_FOUND', 'Order does not exist.');

  const editableIssue = assertOrderEditableForActor(order, actor);
  if (editableIssue) return editableIssue;

  const requestReplay = await findKitchenTicketByRequestIdempotencyKey(
    client,
    payload.idempotencyKey,
  );
  if (requestReplay) {
    await repairKitchenTicket(client, requestReplay, actor);
    const replayLines = await findKitchenTicketLines(client, requestReplay.id);
    const jobs = await enqueueKitchenPrintJobs(client, {
      ticketId: requestReplay.id,
      orderId: payload.orderId,
      ticketType: 'NEW_ITEMS',
      lines: toKitchenQueueLines(replayLines),
    });
    return okResult(200, {
      ticketId: requestReplay.id,
      printStatus: jobs.find((job) => job.status)?.status ?? requestReplay.printStatus ?? 'QUEUED',
      lineCount: replayLines.length,
    });
  }

  const lines = (await findLinesByOrder(client, payload.orderId)).filter(
    (line) =>
      line.status === 'ACTIVE' && (line.quantity ?? 0) > (line.kitchenSentQuantity ?? 0),
  );
  if (lines.length === 0) {
    return okResult(200, { ticketId: null, printStatus: 'NO_UNSENT_LINES', lineCount: 0 });
  }

  const previousTickets = await findKitchenTicketsByOrder(client, payload.orderId);
  const isAdditional = previousTickets.some((candidate) => candidate.ticketType === 'NEW_ITEMS');
  const semanticKey = kitchenSemanticKey(payload.orderId, lines);
  const semanticReplay = await findKitchenTicketBySemanticKey(client, semanticKey);
  if (semanticReplay) {
    await repairKitchenTicket(client, semanticReplay, actor);
    const replayLines = await findKitchenTicketLines(client, semanticReplay.id);
    const jobs = await enqueueKitchenPrintJobs(client, {
      ticketId: semanticReplay.id,
      orderId: payload.orderId,
      ticketType: 'NEW_ITEMS',
      lines: toKitchenQueueLines(replayLines),
      isAdditional,
    });
    return okResult(200, {
      ticketId: semanticReplay.id,
      printStatus: jobs.find((job) => job.status)?.status ?? semanticReplay.printStatus ?? 'QUEUED',
      lineCount: replayLines.length,
    });
  }

  const createdAt = new Date().toISOString();
  let ticket: KitchenTicketRecord | null = null;
  let createdNewTicket = false;
  try {
    const result = (await client.mutation({
      createPosKitchenTicket: {
        __args: {
          data: {
            orderId: payload.orderId,
            ticketType: 'NEW_ITEMS',
            createdAt,
            createdByStaffId: actor.staffId,
            printStatus: 'QUEUED',
            idempotencyKey: semanticKey,
            requestIdempotencyKey: payload.idempotencyKey,
          },
        },
        id: true,
        printStatus: true,
      },
    })) as { createPosKitchenTicket?: KitchenTicketRecord };
    ticket = result.createPosKitchenTicket ?? null;
    createdNewTicket = true;
  } catch {
    const raced =
      (await findKitchenTicketByRequestIdempotencyKey(client, payload.idempotencyKey)) ??
      (await findKitchenTicketBySemanticKey(client, semanticKey));
    if (!raced) return errorResult('CONFLICT', 'Kitchen ticket could not be created.');
    ticket = raced;
  }

  if (!ticket?.id) return errorResult('CONFLICT', 'Kitchen ticket could not be read back.');

  const existingTicketLines = await findKitchenTicketLines(client, ticket.id);
  const existingLineIds = new Set(existingTicketLines.map((line) => line.orderLineId));
  for (const line of lines) {
    const delta = Math.max(0, (line.quantity ?? 0) - (line.kitchenSentQuantity ?? 0));
    if (!delta || existingLineIds.has(line.id)) continue;
    const guest = line.guestId ? await findGuestById(client, line.guestId) : null;
    const menuItem = line.menuItemId ? await findMenuItemById(client, line.menuItemId) : null;
    const station = menuItem?.productionStationId
      ? await findProductionStationById(client, menuItem.productionStationId)
      : null;
    const printable: KitchenQueueLine = {
      orderLineId: line.id,
      guestDisplayNumber: guest?.displayNumber ?? null,
      itemNameSnapshot: line.itemNameSnapshot ?? '',
      quantity: delta,
      action: 'ADD' as const,
      productionStationId: station?.id ?? menuItem?.productionStationId ?? null,
      stationNameSnapshot: station?.label ?? null,
    };
    try {
      await client.mutation({
        createPosKitchenTicketLine: {
          __args: {
            data: {
              ticketId: ticket.id,
              orderLineId: line.id,
              guestId: line.guestId,
              guestDisplayNumber: printable.guestDisplayNumber,
              itemNameSnapshot: printable.itemNameSnapshot,
              quantity: printable.quantity,
              action: printable.action,
              productionStationId: printable.productionStationId,
              stationNameSnapshot: printable.stationNameSnapshot,
            },
          },
          id: true,
        },
      });
    } catch {
      // Another terminal may have inserted this immutable ticket line first.
      // Re-read it and continue repairing sent quantity rather than surfacing
      // a duplicate-print 500 to the POS.
      const racedLine = await findKitchenTicketLine(client, ticket.id, line.id);
      if (!racedLine) {
        return errorResult('CONFLICT', 'Kitchen ticket line could not be created.');
      }
    }
  }

  await repairKitchenTicket(client, ticket, actor);
  const ticketLines = await findKitchenTicketLines(client, ticket.id);
  const jobs = await enqueueKitchenPrintJobs(client, {
    ticketId: ticket.id,
    orderId: payload.orderId,
    ticketType: 'NEW_ITEMS',
    lines: toKitchenQueueLines(ticketLines),
    isAdditional,
  });

  return okResult(createdNewTicket ? 201 : 200, {
    ticketId: ticket.id,
    printStatus: jobs.find((job) => job.status)?.status ?? ticket.printStatus ?? 'QUEUED',
    lineCount: ticketLines.length,
  });
};

const createCancellationKitchenTicket = async (
  client: CoreApiClientLike,
  orderId: string,
  lines: LineRecord[],
  actor: PosActor,
  operationKey: string,
): Promise<KitchenTicketRecord | null> => {
  const semanticKey = `kitchen-cancellation:${orderId}:${operationKey}`;
  let ticket = await findKitchenTicketBySemanticKey(client, semanticKey);
  if (!ticket) {
    try {
      const result = (await client.mutation({
        createPosKitchenTicket: {
          __args: {
            data: {
              orderId,
              ticketType: 'CANCELLATION',
              createdAt: new Date().toISOString(),
              createdByStaffId: actor.staffId,
              printStatus: 'QUEUED',
              idempotencyKey: semanticKey,
              requestIdempotencyKey: operationKey,
            },
          },
          ...KITCHEN_TICKET_FIELDS,
        },
      })) as { createPosKitchenTicket?: KitchenTicketRecord };
      ticket = result.createPosKitchenTicket ?? null;
    } catch {
      ticket = await findKitchenTicketBySemanticKey(client, semanticKey);
    }
  }

  if (!ticket?.id) return null;

  const existing = await findKitchenTicketLines(client, ticket.id);
  const existingIds = new Set(existing.map((line) => line.orderLineId));
  for (const line of lines) {
    if (!line.id || existingIds.has(line.id)) continue;
    const guest = line.guestId ? await findGuestById(client, line.guestId) : null;
    const menuItem = line.menuItemId ? await findMenuItemById(client, line.menuItemId) : null;
    const station = menuItem?.productionStationId
      ? await findProductionStationById(client, menuItem.productionStationId)
      : null;
    const quantity = Math.max(0, line.kitchenSentQuantity ?? 0);
    if (!quantity) continue;
    const printable: KitchenQueueLine = {
      orderLineId: line.id,
      guestDisplayNumber: guest?.displayNumber ?? null,
      itemNameSnapshot: line.itemNameSnapshot ?? '',
      quantity,
      action: 'CANCEL',
      productionStationId: station?.id ?? menuItem?.productionStationId ?? null,
      stationNameSnapshot: station?.label ?? null,
    };
    try {
      await client.mutation({
        createPosKitchenTicketLine: {
          __args: {
            data: {
              ticketId: ticket.id,
              orderLineId: line.id,
              guestId: line.guestId,
              guestDisplayNumber: printable.guestDisplayNumber,
              itemNameSnapshot: printable.itemNameSnapshot,
              quantity: printable.quantity,
              action: 'CANCEL',
              productionStationId: printable.productionStationId,
              stationNameSnapshot: printable.stationNameSnapshot,
            },
          },
          id: true,
        },
      });
    } catch {
      const raced = await findKitchenTicketLine(client, ticket.id, line.id);
      if (!raced) return null;
    }
  }

  const ticketLines = await findKitchenTicketLines(client, ticket.id);
  if (ticketLines.length > 0) {
    await enqueueKitchenPrintJobs(client, {
      ticketId: ticket.id,
      orderId,
      ticketType: 'CANCELLATION',
      lines: toKitchenQueueLines(ticketLines),
    });
  }

  return ticket;
};

export const executeVoidOrderLines = async (
  client: CoreApiClientLike,
  payload: {
    lineIds: string[];
    preparedState: 'PREPARED' | 'NOT_PREPARED';
    reason?: string;
    idempotencyKey: string;
  },
  actor: PosActor,
): Promise<CommandResult> => {
  const replay = await findOperationalEventByIdempotencyKey(client, payload.idempotencyKey);
  if (replay) {
    const details = parseEventDetails(replay);
    return okResult(200, { ...details, eventId: replay.id, replay: true });
  }

  const lines = await Promise.all(payload.lineIds.map((id) => findLineById(client, id)));
  if (lines.some((line) => !line)) return errorResult('LINE_NOT_FOUND', 'One or more order lines do not exist.');
  const existingLines = lines as LineRecord[];
  const orderId = existingLines[0]?.orderId;
  if (!orderId || existingLines.some((line) => line.orderId !== orderId)) {
    return errorResult('VOID_LINE_INVALID', 'All lines must belong to the same order.');
  }
  const order = await findOrderById(client, orderId);
  if (!order) return errorResult('ORDER_NOT_FOUND', 'Order does not exist.');
  const editableIssue = assertOrderEditableForActor(order, actor);
  if (editableIssue) return editableIssue;
  if (existingLines.some((line) => line.status !== 'ACTIVE')) {
    return errorResult('VOID_LINE_INVALID', 'Only active lines can be voided.');
  }

  for (const line of existingLines) {
    await client.mutation({
      updatePosOrderLine: {
        __args: {
          id: line.id,
          data: {
            status: 'VOIDED',
            voidedAt: new Date().toISOString(),
            voidedByStaffId: actor.staffId,
            voidPreparedState: payload.preparedState,
            ...(payload.reason ? { voidReason: payload.reason } : {}),
          },
        },
        id: true,
      },
    });
  }

  const cancellationTicket = existingLines.some((line) => (line.kitchenSentQuantity ?? 0) > 0)
    ? await createCancellationKitchenTicket(client, orderId, existingLines, actor, payload.idempotencyKey)
    : null;
  const totals = await updateLinesTotals(client, order);
  if (totals.activeLineCount === 0) {
    // Release the (tableId, claimToken) claim so the table can be re-opened.
    await client.mutation({
      updatePosOrder: {
        __args: {
          id: order.id,
          data: { status: 'CANCELLED', claimToken: null },
        },
        id: true,
      },
    });
  }

  const details = {
    orderId,
    lineIds: payload.lineIds,
    preparedState: payload.preparedState,
    ...(payload.reason ? { reason: payload.reason } : {}),
    ...(cancellationTicket?.id ? { cancellationTicketId: cancellationTicket.id } : {}),
    activeLineCount: totals.activeLineCount,
  };
  const event = await createOperationalEvent(client, {
    eventType: 'VOID_ORDER_LINES',
    actorStaffId: actor.staffId,
    orderId,
    details,
    idempotencyKey: payload.idempotencyKey,
  });
  if (!event?.id) return errorResult('CONFLICT', 'Void operation audit could not be recorded.');
  return okResult(201, { ...details, eventId: event.id, cancellationTicketId: cancellationTicket?.id ?? null });
};

const assertTransferableOrder = async (
  client: CoreApiClientLike,
  orderId: string,
  actor: PosActor,
): Promise<{ order: OrderRecord } | CommandResult> => {
  const order = await findOrderById(client, orderId);
  if (!order) return errorResult('ORDER_NOT_FOUND', 'Order does not exist.');
  const editableIssue = assertOrderEditableForActor(order, actor);
  if (editableIssue) return editableIssue;
  return { order };
};

export const executeTransferOrderToTable = async (
  client: CoreApiClientLike,
  payload: { orderId: string; targetTableId: string; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const replay = await findOperationalEventByIdempotencyKey(client, payload.idempotencyKey);
  if (replay) return okResult(200, { ...parseEventDetails(replay), eventId: replay.id, replay: true });
  const checked = await assertTransferableOrder(client, payload.orderId, actor);
  if ('status' in checked) return checked;
  const order = checked.order;
  const target = await findTableById(client, payload.targetTableId);
  if (!target) return errorResult('TABLE_NOT_FOUND', 'Target table does not exist.');
  if (target.isActive === false) return errorResult('TABLE_INACTIVE', 'Target table is inactive.');
  const occupied = await findActiveOrderForTable(client, payload.targetTableId);
  if (occupied && occupied.id !== order.id) return errorResult('TABLE_NOT_AVAILABLE', 'Target table already has an active order.');
  const fromTableId = order.tableId;
  if (fromTableId !== payload.targetTableId) {
    try {
      await client.mutation({
        updatePosOrder: {
          __args: { id: order.id, data: { tableId: payload.targetTableId, claimToken: payload.targetTableId } },
          id: true,
        },
      });
    } catch {
      const raced = await findActiveOrderForTable(client, payload.targetTableId);
      if (raced && raced.id !== order.id) return errorResult('TABLE_NOT_AVAILABLE', 'Target table already has an active order.');
      return errorResult('CONFLICT', 'Order table transfer could not be completed.');
    }
  }
  const details = { orderId: order.id, fromTableId: fromTableId ?? null, targetTableId: payload.targetTableId };
  const event = await createOperationalEvent(client, { eventType: 'TRANSFER_ORDER_TO_TABLE', actorStaffId: actor.staffId, orderId: order.id, details, idempotencyKey: payload.idempotencyKey });
  if (!event?.id) return errorResult('CONFLICT', 'Table transfer audit could not be recorded.');
  return okResult(201, { ...details, eventId: event.id });
};

export const executeTransferOrderToWaiter = async (
  client: CoreApiClientLike,
  payload: { orderId: string; targetStaffId: string; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const replay = await findOperationalEventByIdempotencyKey(client, payload.idempotencyKey);
  if (replay) return okResult(200, { ...parseEventDetails(replay), eventId: replay.id, replay: true });
  const checked = await assertTransferableOrder(client, payload.orderId, actor);
  if ('status' in checked) return checked;
  const order = checked.order;
  const target = await findStaffById(client, payload.targetStaffId);
  if (!target) return errorResult('STAFF_NOT_FOUND', 'Target staff does not exist.');
  if (target.isActive === false) return errorResult('STAFF_INACTIVE', 'Target staff is inactive.');
  const details = { orderId: order.id, fromStaffId: order.ownerStaffId ?? null, targetStaffId: payload.targetStaffId };
  if (order.ownerStaffId !== payload.targetStaffId) {
    await client.mutation({
      updatePosOrder: { __args: { id: order.id, data: { ownerStaffId: payload.targetStaffId } }, id: true },
    });
  }
  const event = await createOperationalEvent(client, { eventType: 'TRANSFER_ORDER_TO_WAITER', actorStaffId: actor.staffId, orderId: order.id, details, idempotencyKey: payload.idempotencyKey });
  if (!event?.id) return errorResult('CONFLICT', 'Waiter transfer audit could not be recorded.');
  return okResult(201, { ...details, eventId: event.id });
};

export const executeTransferOrderLinesToGuest = async (
  client: CoreApiClientLike,
  payload: { lineIds: string[]; targetGuestId: string; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const replay = await findOperationalEventByIdempotencyKey(client, payload.idempotencyKey);
  if (replay) return okResult(200, { ...parseEventDetails(replay), eventId: replay.id, replay: true });
  const lines = (await Promise.all(payload.lineIds.map((id) => findLineById(client, id))));
  if (lines.some((line) => !line)) return errorResult('LINE_NOT_FOUND', 'One or more order lines do not exist.');
  const existingLines = lines as LineRecord[];
  const orderId = existingLines[0]?.orderId;
  if (!orderId || existingLines.some((line) => line.orderId !== orderId)) return errorResult('GUEST_TRANSFER_INVALID', 'All lines must belong to one order.');
  const checked = await assertTransferableOrder(client, orderId, actor);
  if ('status' in checked) return checked;
  const guest = await findGuestById(client, payload.targetGuestId);
  if (!guest || guest.orderId !== orderId) return errorResult('GUEST_NOT_IN_ORDER', 'Target guest does not belong to the order.');
  if (existingLines.some((line) => line.status !== 'ACTIVE')) return errorResult('GUEST_TRANSFER_INVALID', 'Only active lines can be transferred.');
  const fromGuestIds = [...new Set(existingLines.map((line) => line.guestId ?? null))];
  for (const line of existingLines) {
    if (line.guestId !== payload.targetGuestId) {
      await client.mutation({ updatePosOrderLine: { __args: { id: line.id, data: { guestId: payload.targetGuestId } }, id: true } });
    }
  }
  await updateLinesTotals(client, checked.order);
  const details = { orderId, lineIds: payload.lineIds, fromGuestIds, targetGuestId: payload.targetGuestId };
  const event = await createOperationalEvent(client, { eventType: 'TRANSFER_ORDER_LINES_TO_GUEST', actorStaffId: actor.staffId, orderId, details, idempotencyKey: payload.idempotencyKey });
  if (!event?.id) return errorResult('CONFLICT', 'Guest transfer audit could not be recorded.');
  return okResult(201, { ...details, eventId: event.id });
};

const repairPrecheckOrderLock = async (
  client: CoreApiClientLike,
  order: OrderRecord,
): Promise<void> => {
  if (order.status === 'PRECHECK_PRINTED') return;

  await client.mutation({
    updatePosOrder: {
      __args: { id: order.id, data: { status: 'PRECHECK_PRINTED' } },
      id: true,
    },
  });
};

const repairCancelledPrecheckOrder = async (
  client: CoreApiClientLike,
  order: OrderRecord,
): Promise<void> => {
  if (order.status !== 'PRECHECK_PRINTED') return;

  await client.mutation({
    updatePosOrder: {
      __args: { id: order.id, data: { status: 'IN_PROGRESS' } },
      id: true,
    },
  });
};

const buildPrecheckSnapshot = async (
  client: CoreApiClientLike,
  order: OrderRecord,
): Promise<{
  order: OrderRecord;
  subtotal: ReturnType<typeof normalizeCurrency>;
  guestTotals: Array<{ displayNumber: string; amountMicros: number; currencyCode: string }>;
  guestItems: PrecheckQueueSnapshot['guests'];
  tableNumber: string;
  waiterName: string;
}> => {
  await updateLinesTotals(client, order);
  const refreshedOrder = await findOrderById(client, order.id);
  if (!refreshedOrder) throw new Error('Order disappeared while creating precheck.');

  const guests = await findGuestsByOrder(client, order.id);
  const lines = (await findLinesByOrder(client, order.id)).filter(
    (line) => line.status === 'ACTIVE',
  );
  const guestTotals = guests.map((guest) => {
    const subtotal = normalizeCurrency(guest.subtotal);
    return {
      displayNumber: guest.displayNumber ?? `Гость ${guest.ordinal ?? 0}`,
      amountMicros: subtotal.amountMicros,
      currencyCode: subtotal.currencyCode,
    };
  });
  const guestItems = guests.map((guest) => ({
    displayNumber: guest.displayNumber ?? `Гость ${guest.ordinal ?? 0}`,
    lines: lines
      .filter((line) => line.guestId === guest.id)
      .map((line) => {
        const unitPriceMicros = normalizeCurrency(line.unitPrice).amountMicros;
        const quantity = line.quantity ?? 0;
        return {
          itemNameSnapshot: line.itemNameSnapshot ?? '',
          quantity,
          unitPriceMicros,
          lineTotalMicros: unitPriceMicros * quantity,
        };
      }),
  }));
  const table = order.tableId ? await findTableById(client, order.tableId) : null;
  const staff = order.ownerStaffId ? await findStaffById(client, order.ownerStaffId) : null;

  return {
    order: refreshedOrder,
    subtotal: normalizeCurrency(refreshedOrder.subtotal),
    guestTotals,
    guestItems,
    tableNumber: table?.number ?? '—',
    waiterName: staff?.displayName ?? 'Сотрудник',
  };
};

const precheckQueueSnapshotFromRecord = async (
  client: CoreApiClientLike,
  precheck: PrecheckRecord,
  order: OrderRecord,
): Promise<PrecheckQueueSnapshot> => {
  let guests: PrecheckQueueSnapshot['guests'] = [];
  try {
    const parsed = JSON.parse(precheck.guestItemsSnapshot ?? '[]') as unknown;
    if (Array.isArray(parsed)) guests = parsed as PrecheckQueueSnapshot['guests'];
  } catch {
    // A legacy precheck without the item snapshot remains printable as a
    // totals-only document; new prechecks always store the immutable list.
  }
  const table = order.tableId ? await findTableById(client, order.tableId) : null;
  const staff = order.ownerStaffId ? await findStaffById(client, order.ownerStaffId) : null;
  return {
    precheckId: precheck.id,
    orderId: order.id,
    tableNumber: table?.number ?? '—',
    waiterName: staff?.displayName ?? 'Сотрудник',
    createdAt: precheck.createdAt ?? new Date().toISOString(),
    guests,
    subtotalMicros: normalizeCurrency(precheck.subtotalSnapshot).amountMicros,
    totalMicros: normalizeCurrency(precheck.totalSnapshot).amountMicros,
  };
};

const precheckResponse = (
  precheck: PrecheckRecord,
  order: OrderRecord,
  status: number,
): CommandResult => ({
  status,
  body: {
    precheckId: precheck.id,
    orderId: order.id,
    orderStatus: order.status ?? 'PRECHECK_PRINTED',
    status: precheck.status ?? 'ACTIVE',
    printStatus: precheck.printStatus ?? 'QUEUED',
    totalSnapshot: precheck.totalSnapshot ?? null,
  },
});

export const executeCreatePrecheck = async (
  client: CoreApiClientLike,
  payload: { orderId: string; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const order = await findOrderById(client, payload.orderId);
  if (!order) return errorResult('ORDER_NOT_FOUND', 'Order does not exist.');

  const existingByIdempotency = await findPrecheckByIdempotencyKey(
    client,
    payload.idempotencyKey,
  );
  if (existingByIdempotency) {
    if (
      existingByIdempotency.orderId !== payload.orderId ||
      existingByIdempotency.createdByStaffId !== actor.staffId
    ) {
      return idempotencyConflict('The idempotency key belongs to another precheck context.');
    }

    if (existingByIdempotency.status === 'ACTIVE') {
      await repairPrecheckOrderLock(client, order);
    }
    const refreshed = (await findOrderById(client, payload.orderId)) ?? order;
    await enqueuePrecheckPrintJob(client, await precheckQueueSnapshotFromRecord(client, existingByIdempotency, refreshed));
    return precheckResponse(existingByIdempotency, refreshed, 200);
  }

  const active = await findActivePrecheckByOrderId(client, payload.orderId);
  if (active) {
    await repairPrecheckOrderLock(client, order);
    const refreshed = (await findOrderById(client, payload.orderId)) ?? order;
    await enqueuePrecheckPrintJob(client, await precheckQueueSnapshotFromRecord(client, active, refreshed));
    return precheckResponse(active, refreshed, 200);
  }

  const editableIssue = assertOrderEditableForActor(order, actor);
  if (editableIssue) return editableIssue;

  const snapshot = await buildPrecheckSnapshot(client, order);
  const createdAt = new Date().toISOString();
  const guestTotalsSnapshot = JSON.stringify(snapshot.guestTotals);
  let precheck: PrecheckRecord | null = null;
  let createdNew = false;

  try {
    const result = (await client.mutation({
      createPosPrecheck: {
        __args: {
          data: {
            orderId: payload.orderId,
            label: `Предчек ${payload.orderId.slice(0, 8)}`,
            status: 'ACTIVE',
            subtotalSnapshot: snapshot.subtotal,
            totalSnapshot: normalizeCurrency(snapshot.order.total),
            guestTotalsSnapshot,
            guestItemsSnapshot: JSON.stringify(snapshot.guestItems),
            createdByStaffId: actor.staffId,
            activeOrderKey: payload.orderId,
            idempotencyKey: payload.idempotencyKey,
            printStatus: 'QUEUED',
            createdAt,
          },
        },
        id: true,
        orderId: true,
        status: true,
        subtotalSnapshot: { amountMicros: true, currencyCode: true },
        totalSnapshot: { amountMicros: true, currencyCode: true },
        guestTotalsSnapshot: true,
        guestItemsSnapshot: true,
        createdByStaffId: true,
        activeOrderKey: true,
        idempotencyKey: true,
        printStatus: true,
      },
    })) as { createPosPrecheck?: PrecheckRecord };
    precheck = result.createPosPrecheck ?? null;
    createdNew = true;
  } catch {
    const raced =
      (await findPrecheckByIdempotencyKey(client, payload.idempotencyKey)) ??
      (await findActivePrecheckByOrderId(client, payload.orderId));
    if (!raced) return errorResult('CONFLICT', 'Precheck could not be created.');
    precheck = raced;
  }

  if (!precheck?.id) return errorResult('CONFLICT', 'Precheck could not be read back.');

  await repairPrecheckOrderLock(client, order);
  const lockedOrder = (await findOrderById(client, payload.orderId)) ?? order;
  const queued = await enqueuePrecheckPrintJob(client, {
    precheckId: precheck.id,
    orderId: payload.orderId,
    tableNumber: snapshot.tableNumber,
    waiterName: snapshot.waiterName,
    createdAt,
    guests: snapshot.guestItems,
    subtotalMicros: snapshot.subtotal.amountMicros,
    totalMicros: normalizeCurrency(snapshot.order.total).amountMicros,
  });

  if (queued?.status && queued.status !== precheck.printStatus) {
    precheck.printStatus = queued.status;
  }
  return precheckResponse(precheck, lockedOrder, createdNew ? 201 : 200);
};

export const executeCancelPrecheck = async (
  client: CoreApiClientLike,
  payload: { orderId: string; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const order = await findOrderById(client, payload.orderId);
  if (!order) return errorResult('ORDER_NOT_FOUND', 'Order does not exist.');

  const replay = await findPrecheckByCancelIdempotencyKey(client, payload.idempotencyKey);
  if (replay) {
    if (replay.orderId !== payload.orderId || replay.cancelledByStaffId !== actor.staffId) {
      return idempotencyConflict('The idempotency key belongs to another cancellation context.');
    }
    await repairCancelledPrecheckOrder(client, order);
    const refreshed = (await findOrderById(client, payload.orderId)) ?? order;
    return precheckResponse(replay, refreshed, 200);
  }

  const active = await findActivePrecheckByOrderId(client, payload.orderId);
  if (!active) {
    return errorResult('PRECHECK_NOT_FOUND', 'No active precheck exists for this order.');
  }

  const cancelledAt = new Date().toISOString();
  try {
    await client.mutation({
      updatePosPrecheck: {
        __args: {
          id: active.id,
          data: {
            status: 'CANCELLED',
            activeOrderKey: null,
            cancelledAt,
            cancelledByStaffId: actor.staffId,
            cancelIdempotencyKey: payload.idempotencyKey,
          },
        },
        id: true,
        orderId: true,
        status: true,
        cancelledAt: true,
        cancelledByStaffId: true,
        cancelIdempotencyKey: true,
        activeOrderKey: true,
        printStatus: true,
      },
    });
  } catch {
    const raced = await findPrecheckByCancelIdempotencyKey(client, payload.idempotencyKey);
    if (!raced) return errorResult('CONFLICT', 'Precheck could not be cancelled.');
    await repairCancelledPrecheckOrder(client, order);
    const refreshed = (await findOrderById(client, payload.orderId)) ?? order;
    return precheckResponse(raced, refreshed, 200);
  }

  await client.mutation({
    updatePosOrder: {
      __args: { id: order.id, data: { status: 'IN_PROGRESS' } },
      id: true,
    },
  });

  const cancelled = (await findPrecheckByCancelIdempotencyKey(client, payload.idempotencyKey)) ?? {
    ...active,
    status: 'CANCELLED',
    activeOrderKey: null,
    cancelledAt,
    cancelledByStaffId: actor.staffId,
    cancelIdempotencyKey: payload.idempotencyKey,
  };
  const editableOrder = (await findOrderById(client, payload.orderId)) ?? order;
  return precheckResponse(cancelled, editableOrder, 200);
};

const paymentTotals = (order: OrderRecord) => {
  const totalMicros = normalizeCurrency(order.total).amountMicros;
  const prepaidMicros = normalizeCurrency(order.prepaidTotal).amountMicros;
  const paidMicros = normalizeCurrency(order.paidTotal).amountMicros;
  return {
    totalMicros,
    prepaidMicros,
    paidMicros,
    remainingMicros: totalMicros - prepaidMicros - paidMicros,
  };
};

const paymentResponse = (
  payment: PaymentRecord,
  order: OrderRecord,
  status: number,
): CommandResult => {
  const totals = paymentTotals(order);
  return okResult(status, {
    paymentId: payment.id,
    orderId: order.id,
    status: payment.status ?? 'PENDING',
    amount: payment.amount ?? null,
    tenderedAmount: payment.tenderedAmount ?? null,
    changeAmount: payment.changeAmount ?? null,
    tenderedMicros: normalizeCurrency(payment.tenderedAmount).amountMicros || normalizeCurrency(payment.amount).amountMicros,
    changeMicros: normalizeCurrency(payment.changeAmount).amountMicros,
    appliedMicros: normalizeCurrency(payment.amount).amountMicros,
    remainingMicros: totals.remainingMicros,
    prepaidMicros: totals.prepaidMicros,
    orderStatus: order.status ?? null,
  });
};

const updatePayment = async (
  client: CoreApiClientLike,
  paymentId: string,
  data: Record<string, unknown>,
): Promise<void> => {
  await client.mutation({
    updatePosPayment: {
      __args: { id: paymentId, data },
      id: true,
    },
  });
};

const mutationUpdatedRows = (result: unknown, root: string): number => {
  const value = (result as Record<string, unknown> | null)?.[root];
  if (Array.isArray(value)) return value.length;
  return value && typeof value === 'object' && 'id' in value ? 1 : 0;
};

// Twenty's CurrencyFilterInput compares each component independently; it does
// not accept the Currency value shape used by create/update inputs.
const currencyFilter = (amountMicros: number) => ({
  amountMicros: { eq: amountMicros },
  currencyCode: { eq: POS_CURRENCY_CODE },
});

const guardedUpdatePaidTotal = async (
  client: CoreApiClientLike,
  order: OrderRecord,
  expectedPaidMicros: number,
  nextPaidMicros: number,
): Promise<boolean> => {
  const result = await client.mutation({
    updatePosOrders: {
      __args: {
        filter: {
          id: { eq: order.id },
          status: { eq: 'PRECHECK_PRINTED' },
          paidTotal: currencyFilter(expectedPaidMicros),
        },
        data: { paidTotal: microsToCurrency(nextPaidMicros) },
      },
      id: true,
    },
  });
  return mutationUpdatedRows(result, 'updatePosOrders') > 0;
};

const closeOrderResponse = (order: OrderRecord, status: number): CommandResult =>
  okResult(status, {
    orderId: order.id,
    status: order.status ?? 'CLOSED',
    closedAt: order.closedAt ?? null,
    closedByStaffId: order.closedByStaffId ?? null,
    prepaidMicros: paymentTotals(order).prepaidMicros,
    remainingMicros: paymentTotals(order).remainingMicros,
  });

export const executeRecordPayment = async (
  client: CoreApiClientLike,
  payload: {
    orderId: string;
    paymentMethodId: string;
    amountMicros: number;
    tenderedAmountMicros?: number;
    idempotencyKey: string;
  },
  actor: PosActor,
): Promise<CommandResult> => {
  if (!Number.isSafeInteger(payload.amountMicros) || payload.amountMicros <= 0) {
    return errorResult('PAYMENT_AMOUNT_INVALID', 'Payment amount must be a positive safe integer.');
  }
  if (
    payload.tenderedAmountMicros !== undefined &&
    (!Number.isSafeInteger(payload.tenderedAmountMicros) || payload.tenderedAmountMicros <= 0)
  ) {
    return errorResult('PAYMENT_AMOUNT_INVALID', 'Payment amount must be a positive safe integer.');
  }

  const order = await findOrderById(client, payload.orderId);
  if (!order) return errorResult('ORDER_NOT_FOUND', 'Order does not exist.');

  const method = await findPaymentMethodById(client, payload.paymentMethodId);
  if (!method) return errorResult('PAYMENT_METHOD_NOT_FOUND', 'Payment method does not exist.');
  if (method.isActive === false) {
    return errorResult('PAYMENT_METHOD_INACTIVE', 'Payment method is inactive.');
  }

  const isCash = method.methodType === 'CASH';
  const tenderedProvided = payload.tenderedAmountMicros !== undefined && isCash;

  const existing = await findPaymentByIdempotencyKey(client, payload.idempotencyKey);
  if (existing) {
    const existingTendered = existing.tenderedAmount
      ? normalizeCurrency(existing.tenderedAmount).amountMicros
      : normalizeCurrency(existing.amount).amountMicros;
    const existingApplied = normalizeCurrency(existing.amount).amountMicros;
    const expectedTendered = tenderedProvided ? payload.tenderedAmountMicros : payload.amountMicros;
    // For idempotency, compare tendered when cash, otherwise compare amount directly.
    const tenderedMatches = tenderedProvided
      ? existingTendered === expectedTendered
      : existingApplied === payload.amountMicros;
    if (
      existing.orderId !== payload.orderId ||
      existing.paymentMethodId !== payload.paymentMethodId ||
      !tenderedMatches ||
      existing.acceptedByStaffId !== actor.staffId
    ) {
      return idempotencyConflict('The idempotency key belongs to another payment context.');
    }
    if (existing.status === 'SUCCESS') return paymentResponse(existing, order, 200);
    if (existing.status === 'REJECTED') {
      return errorResult('OVERPAYMENT', 'Payment was rejected because it would overpay the order.');
    }
  }

  if (order.status !== 'PRECHECK_PRINTED') {
    return errorResult('PAYMENT_ORDER_STATE', 'Payments require a printed precheck.');
  }

  // Derive applied/change for creation: need current remaining.
  const deriveForRemaining = (remaining: number) => {
    if (isCash && tenderedProvided) {
      const tendered = payload.tenderedAmountMicros as number;
      const applied = Math.min(tendered, remaining);
      const change = tendered - applied;
      return { applied, tendered, change };
    }
    return { applied: payload.amountMicros, tendered: payload.amountMicros, change: 0 };
  };

  let payment = existing;
  if (!payment) {
    const totals = paymentTotals(order);
    if (totals.remainingMicros <= 0) {
      return errorResult('OVERPAYMENT', 'Payment exceeds the remaining amount.');
    }
    const { applied } = deriveForRemaining(totals.remainingMicros);
    if (applied <= 0) {
      return errorResult('OVERPAYMENT', 'Payment exceeds the remaining amount.');
    }
    if (!isCash && applied > totals.remainingMicros) {
      return errorResult('OVERPAYMENT', 'Payment exceeds the remaining amount.');
    }
    if (isCash && !tenderedProvided && applied > totals.remainingMicros) {
      return errorResult('OVERPAYMENT', 'Payment exceeds the remaining amount.');
    }
    // For cash with tendered, overpayment is capped as change, not rejected.
    const lockOwner = await findPendingPaymentByOrder(client, payload.orderId);
    if (lockOwner) {
      return errorResult('PAYMENT_IN_PROGRESS', 'Another payment is currently being processed for this order.');
    }

    const derived = deriveForRemaining(totals.remainingMicros);
    try {
      const result = (await client.mutation({
        createPosPayment: {
          __args: {
            data: {
              orderId: payload.orderId,
              paymentMethodId: payload.paymentMethodId,
              amount: microsToCurrency(derived.applied),
              status: 'PENDING',
              acceptedByStaffId: actor.staffId,
              idempotencyKey: payload.idempotencyKey,
              lockKey: payload.orderId,
              paymentMethodNameSnapshot: method.name ?? '',
              paymentMethodTypeSnapshot: method.methodType ?? 'OTHER',
              orderPaidTotalBefore: normalizeCurrency(order.paidTotal),
              appliedToOrder: false,
              ...(isCash
                ? {
                    tenderedAmount: microsToCurrency(derived.tendered),
                    changeAmount: microsToCurrency(derived.change),
                  }
                : {}),
            },
          },
          id: true,
          orderId: true,
          paymentMethodId: true,
          amount: { amountMicros: true, currencyCode: true },
          status: true,
          acceptedByStaffId: true,
          idempotencyKey: true,
          lockKey: true,
          paymentMethodNameSnapshot: true,
          paymentMethodTypeSnapshot: true,
          orderPaidTotalBefore: { amountMicros: true, currencyCode: true },
          appliedToOrder: true,
          tenderedAmount: { amountMicros: true, currencyCode: true },
          changeAmount: { amountMicros: true, currencyCode: true },
        },
      })) as { createPosPayment?: PaymentRecord };
      payment = result.createPosPayment ?? null;
    } catch {
      const racedByKey = await findPaymentByIdempotencyKey(client, payload.idempotencyKey);
      if (racedByKey) {
        payment = racedByKey;
      } else {
        return errorResult('PAYMENT_IN_PROGRESS', 'Another payment is currently being processed for this order.');
      }
    }
  }

  if (!payment?.id) return errorResult('PAYMENT_NOT_FOUND', 'Payment could not be read back.');

  // The applied amount is authoritative server-side; for cash with tendered it is derived from
  // the remaining at the moment of finalization, not a client-supplied amount.
  const storedApplied = normalizeCurrency(payment.amount).amountMicros;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentOrder = await findOrderById(client, payload.orderId);
    if (!currentOrder) return errorResult('ORDER_NOT_FOUND', 'Order does not exist.');
    if (currentOrder.status !== 'PRECHECK_PRINTED') {
      return errorResult('PAYMENT_ORDER_STATE', 'Payments require a printed precheck.');
    }

    const currentTotals = paymentTotals(currentOrder);
    const beforeMicros = normalizeCurrency(payment.orderPaidTotalBefore).amountMicros;
    const expectedAfterOwnPayment = beforeMicros + storedApplied;

    // If the order aggregate was advanced and the only pending lock belongs to
    // this payment, a retry can safely finalize the payment after a crash.
    if (currentTotals.paidMicros === expectedAfterOwnPayment) {
      await updatePayment(client, payment.id, {
        status: 'SUCCESS',
        appliedToOrder: true,
        lockKey: null,
      });
      const refreshed = (await findOrderById(client, payload.orderId)) ?? currentOrder;
      const finalized = (await findPaymentByIdempotencyKey(client, payload.idempotencyKey)) ?? {
        ...payment,
        status: 'SUCCESS',
      };
      return paymentResponse(finalized, refreshed, existing ? 200 : 201);
    }

    // Non-cash overpayment check uses storedApplied (server-derived for cash).
    if (!isCash && storedApplied > currentTotals.remainingMicros) {
      await updatePayment(client, payment.id, {
        status: 'REJECTED',
        lockKey: null,
        appliedToOrder: false,
      });
      return errorResult('OVERPAYMENT', 'Payment exceeds the remaining amount.');
    }
    if (isCash && !tenderedProvided && storedApplied > currentTotals.remainingMicros) {
      await updatePayment(client, payment.id, {
        status: 'REJECTED',
        lockKey: null,
        appliedToOrder: false,
      });
      return errorResult('OVERPAYMENT', 'Payment exceeds the remaining amount.');
    }

    const updated = await guardedUpdatePaidTotal(
      client,
      currentOrder,
      currentTotals.paidMicros,
      currentTotals.paidMicros + storedApplied,
    );
    if (!updated) continue;

    await updatePayment(client, payment.id, {
      status: 'SUCCESS',
      appliedToOrder: true,
      lockKey: null,
    });
    const refreshed = (await findOrderById(client, payload.orderId)) ?? currentOrder;
    const finalized = (await findPaymentByIdempotencyKey(client, payload.idempotencyKey)) ?? {
      ...payment,
      status: 'SUCCESS',
    };
    return paymentResponse(finalized, refreshed, existing ? 200 : 201);
  }

  return errorResult('CONFLICT', 'Payment could not be applied after concurrent updates.');
};

export const executeCloseOrder = async (
  client: CoreApiClientLike,
  payload: { orderId: string; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const replay = await findOrderByCloseIdempotencyKey(client, payload.idempotencyKey);
  if (replay) {
    if (replay.id !== payload.orderId || replay.closedByStaffId !== actor.staffId) {
      return idempotencyConflict('The idempotency key belongs to another close-order context.');
    }
    await ensureInventoryConsumptionRequest(client, payload.orderId);
    return closeOrderResponse(replay, 200);
  }

  const order = await findOrderById(client, payload.orderId);
  if (!order) return errorResult('ORDER_NOT_FOUND', 'Order does not exist.');
  if (order.status === 'CLOSED') {
    return errorResult('ORDER_ALREADY_CLOSED', 'Order is already closed.');
  }
  if (order.status !== 'PRECHECK_PRINTED') {
    return errorResult('PAYMENT_ORDER_STATE', 'Order must have a printed precheck before close.');
  }

  const pending = await findPendingPaymentByOrder(client, order.id);
  if (pending) return errorResult('PAYMENT_IN_PROGRESS', 'A payment is still being processed.');

  const totals = paymentTotals(order);
  if (totals.remainingMicros !== 0) {
    return errorResult('ORDER_NOT_PAID', `Order still has ${totals.remainingMicros} micros remaining.`);
  }

  const closedAt = new Date().toISOString();
  try {
    const result = await client.mutation({
      updatePosOrders: {
        __args: {
          filter: {
            id: { eq: order.id },
            status: { eq: 'PRECHECK_PRINTED' },
            paidTotal: currencyFilter(totals.paidMicros),
          },
          data: {
            status: 'CLOSED',
            closedAt,
            closedByStaffId: actor.staffId,
            closeIdempotencyKey: payload.idempotencyKey,
            claimToken: null,
          },
        },
        id: true,
        status: true,
        closedAt: true,
        closedByStaffId: true,
        closeIdempotencyKey: true,
        paidTotal: { amountMicros: true, currencyCode: true },
      },
    });
    if (mutationUpdatedRows(result, 'updatePosOrders') === 0) {
      const raced = await findOrderByCloseIdempotencyKey(client, payload.idempotencyKey);
      if (raced) {
        await ensureInventoryConsumptionRequest(client, payload.orderId);
        return closeOrderResponse(raced, 200);
      }
      return errorResult('CONFLICT', 'Order close lost a concurrent state transition.');
    }
  } catch {
    const raced = await findOrderByCloseIdempotencyKey(client, payload.idempotencyKey);
    if (raced) {
      await ensureInventoryConsumptionRequest(client, payload.orderId);
      return closeOrderResponse(raced, 200);
    }
    const refreshed = await findOrderById(client, order.id);
    if (refreshed?.status === 'CLOSED') {
      await ensureInventoryConsumptionRequest(client, payload.orderId);
      return closeOrderResponse(refreshed, 200);
    }
    return errorResult('CONFLICT', 'Order could not be closed.');
  }

  const closed = (await findOrderByCloseIdempotencyKey(client, payload.idempotencyKey)) ?? {
    ...order,
    status: 'CLOSED',
    closedAt,
    closedByStaffId: actor.staffId,
    closeIdempotencyKey: payload.idempotencyKey,
    claimToken: null,
  };
  await ensureInventoryConsumptionRequest(client, order.id);
  return closeOrderResponse(closed, 201);
};

const reservationResponse = (
  reservation: ReservationRecord,
  status: number,
): CommandResult => {
  const overdue =
    reservation.status === 'ACTIVE' &&
    Boolean(reservation.scheduledAt) &&
    Date.parse(reservation.scheduledAt as string) < Date.now();
  return okResult(status, {
    reservationId: reservation.id,
    tableId: reservation.tableId ?? null,
    orderId: reservation.orderId ?? null,
    scheduledAt: reservation.scheduledAt ?? null,
    guestName: reservation.guestName ?? null,
    phone: reservation.phone ?? null,
    status: reservation.status ?? 'ACTIVE',
    overdue,
    createdByStaffId: reservation.createdByStaffId ?? null,
  });
};

export const executeCreateReservation = async (
  client: CoreApiClientLike,
  payload: {
    tableId: string;
    scheduledAt?: string;
    guestName?: string;
    phone?: string;
    idempotencyKey: string;
  },
  actor: PosActor,
): Promise<CommandResult> => {
  const table = await findTableById(client, payload.tableId);
  if (!table) return errorResult('TABLE_NOT_FOUND', 'Table does not exist.');
  if (table.isActive === false) return errorResult('TABLE_INACTIVE', 'Table is not active.');
  const existing = await findReservationByIdempotencyKey(client, payload.idempotencyKey);
  if (existing) {
    if (existing.tableId !== payload.tableId || existing.createdByStaffId !== actor.staffId) {
      return idempotencyConflict('The idempotency key belongs to another reservation context.');
    }
    return reservationResponse(existing, 200);
  }
  try {
    const result = (await client.mutation({
      createPosReservation: {
        __args: {
          data: {
            tableId: payload.tableId,
            ...(payload.scheduledAt ? { scheduledAt: payload.scheduledAt } : {}),
            ...(payload.guestName ? { guestName: payload.guestName } : {}),
            ...(payload.phone ? { phone: payload.phone } : {}),
            status: 'ACTIVE',
            createdByStaffId: actor.staffId,
            idempotencyKey: payload.idempotencyKey,
            label: payload.guestName || `Бронь ${payload.tableId.slice(0, 8)}`,
          },
        },
        id: true,
        tableId: true,
        orderId: true,
        scheduledAt: true,
        guestName: true,
        phone: true,
        status: true,
        createdByStaffId: true,
      },
    })) as { createPosReservation?: ReservationRecord };
    const reservation = result.createPosReservation;
    if (!reservation?.id) throw new Error('Reservation was created but not readable.');
    return reservationResponse({ ...reservation, tableId: reservation.tableId ?? payload.tableId }, 201);
  } catch {
    const raced = await findReservationByIdempotencyKey(client, payload.idempotencyKey);
    if (raced) return reservationResponse(raced, 200);
    return errorResult('CONFLICT', 'Reservation could not be created.');
  }
};

export const executeUpdateReservationStatus = async (
  client: CoreApiClientLike,
  payload: { reservationId: string; status: 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const reservation = await findReservationById(client, payload.reservationId);
  if (!reservation) return errorResult('RESERVATION_NOT_FOUND', 'Reservation does not exist.');
  if (reservation.createdByStaffId !== actor.staffId && actor.role !== 'ADMIN') {
    return errorResult('ORDER_NOT_OWNED', 'Reservation belongs to another staff member.');
  }
  if (reservation.status !== 'ACTIVE' && reservation.status !== payload.status) {
    return errorResult('RESERVATION_STATUS_INVALID', 'Reservation is no longer active.');
  }
  const existing = await findReservationByIdempotencyKey(client, payload.idempotencyKey);
  if (existing && existing.id !== reservation.id) return idempotencyConflict('The idempotency key belongs to another reservation.');
  try {
    await client.mutation({
      updatePosReservation: {
        __args: { id: reservation.id, data: { status: payload.status } },
        id: true,
        tableId: true,
        orderId: true,
        status: true,
        scheduledAt: true,
        guestName: true,
        phone: true,
        createdByStaffId: true,
      },
    });
  } catch {
    return errorResult('CONFLICT', 'Reservation status could not be updated.');
  }
  return reservationResponse({ ...reservation, status: payload.status }, 200);
};

export const executeCreatePrepayment = async (
  client: CoreApiClientLike,
  payload: { reservationId: string; paymentMethodId?: string; amountMicros: number; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  if (!Number.isSafeInteger(payload.amountMicros) || payload.amountMicros <= 0) {
    return errorResult('PREPAYMENT_AMOUNT_INVALID', 'Prepayment amount must be a positive safe integer.');
  }
  const reservation = await findReservationById(client, payload.reservationId);
  if (!reservation) return errorResult('RESERVATION_NOT_FOUND', 'Reservation does not exist.');
  const existing = await findPrepaymentByIdempotencyKey(client, payload.idempotencyKey);
  if (existing) {
    if (existing.reservationId !== payload.reservationId || existing.createdByStaffId !== actor.staffId || normalizeCurrency(existing.amount).amountMicros !== payload.amountMicros) {
      return idempotencyConflict('The idempotency key belongs to another prepayment context.');
    }
    return okResult(200, { prepaymentId: existing.id, status: existing.status ?? 'UNAPPLIED', amount: existing.amount ?? null });
  }
  if (payload.paymentMethodId) {
    const method = await findPaymentMethodById(client, payload.paymentMethodId);
    if (!method) return errorResult('PAYMENT_METHOD_NOT_FOUND', 'Payment method does not exist.');
    if (method.isActive === false) return errorResult('PAYMENT_METHOD_INACTIVE', 'Payment method is inactive.');
  }
  try {
    const result = (await client.mutation({
      createPosPrepayment: {
        __args: {
          data: {
            reservationId: payload.reservationId,
            ...(payload.paymentMethodId ? { paymentMethodId: payload.paymentMethodId } : {}),
            amount: microsToCurrency(payload.amountMicros),
            status: 'UNAPPLIED',
            createdByStaffId: actor.staffId,
            idempotencyKey: payload.idempotencyKey,
            label: `Предоплата ${payload.reservationId.slice(0, 8)}`,
          },
        },
        id: true,
        reservationId: true,
        amount: { amountMicros: true, currencyCode: true },
        status: true,
        createdByStaffId: true,
      },
    })) as { createPosPrepayment?: PrepaymentRecord };
    const prepayment = result.createPosPrepayment;
    if (!prepayment?.id) throw new Error('Prepayment was created but not readable.');
    return okResult(201, { prepaymentId: prepayment.id, status: prepayment.status ?? 'UNAPPLIED', amount: prepayment.amount ?? null });
  } catch {
    const raced = await findPrepaymentByIdempotencyKey(client, payload.idempotencyKey);
    if (raced) return okResult(200, { prepaymentId: raced.id, status: raced.status ?? 'UNAPPLIED', amount: raced.amount ?? null });
    return errorResult('CONFLICT', 'Prepayment could not be created.');
  }
};

const reconcileOrderPrepaidTotal = async (
  client: CoreApiClientLike,
  orderId: string,
): Promise<OrderRecord | null> => {
  const rows = await queryConnection<PrepaymentRecord>(client, 'posPrepayments', { filter: { orderId: { eq: orderId }, status: { eq: 'APPLIED' } }, first: 100 }, PREPAYMENT_FIELDS);
  const total = rows.reduce((sum, row) => sum + normalizeCurrency(row.amount).amountMicros, 0);
  await client.mutation({ updatePosOrder: { __args: { id: orderId, data: { prepaidTotal: microsToCurrency(total) } }, id: true } });
  return findOrderById(client, orderId);
};

export const executeApplyPrepayment = async (
  client: CoreApiClientLike,
  payload: { prepaymentId: string; orderId: string; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const order = await findOrderById(client, payload.orderId);
  if (!order) return errorResult('ORDER_NOT_FOUND', 'Order does not exist.');
  if (order.status === 'CLOSED') return errorResult('ORDER_NOT_EDITABLE', 'Closed order cannot receive a prepayment.');
  const keyReplay = await findPrepaymentByApplyIdempotencyKey(client, payload.idempotencyKey);
  if (keyReplay) {
    if (keyReplay.id !== payload.prepaymentId || keyReplay.appliedByStaffId !== actor.staffId) return idempotencyConflict('The idempotency key belongs to another prepayment context.');
    const refreshed = (await reconcileOrderPrepaidTotal(client, payload.orderId)) ?? order;
    return okResult(200, { prepaymentId: keyReplay.id, orderId: payload.orderId, status: 'APPLIED', prepaidMicros: normalizeCurrency(refreshed.prepaidTotal).amountMicros, remainingMicros: paymentTotals(refreshed).remainingMicros });
  }
  const prepayment = await findPrepaymentById(client, payload.prepaymentId);
  if (!prepayment) return errorResult('PREPAYMENT_NOT_FOUND', 'Prepayment does not exist.');
  const amountMicros = normalizeCurrency(prepayment.amount).amountMicros;
  if (prepayment.status === 'APPLIED') {
    if (prepayment.orderId !== payload.orderId) return errorResult('PREPAYMENT_ALREADY_APPLIED', 'Prepayment is already applied to another order.');
    const refreshed = (await reconcileOrderPrepaidTotal(client, payload.orderId)) ?? order;
    return okResult(200, { prepaymentId: prepayment.id, orderId: payload.orderId, status: 'APPLIED', prepaidMicros: normalizeCurrency(refreshed.prepaidTotal).amountMicros, remainingMicros: paymentTotals(refreshed).remainingMicros });
  }
  if (amountMicros > normalizeCurrency(order.total).amountMicros && normalizeCurrency(order.total).amountMicros > 0) return errorResult('PREPAYMENT_EXCEEDS_ORDER', 'Prepayment exceeds the order total.');
  try {
    const result = await client.mutation({
      updatePosPrepayments: {
        __args: {
          filter: { id: { eq: prepayment.id }, status: { eq: 'UNAPPLIED' } },
          data: { orderId: payload.orderId, status: 'APPLIED', appliedByStaffId: actor.staffId, appliedAt: new Date().toISOString(), applyIdempotencyKey: payload.idempotencyKey },
        },
        id: true,
      },
    });
    if (mutationUpdatedRows(result, 'updatePosPrepayments') === 0) {
      const raced = await findPrepaymentById(client, prepayment.id);
      if (!raced || raced.status !== 'APPLIED') return errorResult('CONFLICT', 'Prepayment could not be applied.');
      if (raced.orderId !== payload.orderId) return errorResult('PREPAYMENT_ALREADY_APPLIED', 'Prepayment is already applied to another order.');
    }
  } catch {
    const raced = await findPrepaymentById(client, prepayment.id);
    if (!raced || raced.status !== 'APPLIED') return errorResult('CONFLICT', 'Prepayment could not be applied.');
    if (raced.orderId !== payload.orderId) return errorResult('PREPAYMENT_ALREADY_APPLIED', 'Prepayment is already applied to another order.');
  }
  const refreshed = (await reconcileOrderPrepaidTotal(client, payload.orderId)) ?? order;
  return okResult(201, { prepaymentId: prepayment.id, orderId: payload.orderId, status: 'APPLIED', prepaidMicros: normalizeCurrency(refreshed.prepaidTotal).amountMicros, remainingMicros: paymentTotals(refreshed).remainingMicros });
};

export const executeAttachReservationToOrder = async (
  client: CoreApiClientLike,
  payload: { reservationId: string; orderId: string; idempotencyKey: string },
  actor: PosActor,
): Promise<CommandResult> => {
  const reservation = await findReservationById(client, payload.reservationId);
  if (!reservation) return errorResult('RESERVATION_NOT_FOUND', 'Reservation does not exist.');
  const order = await findOrderById(client, payload.orderId);
  if (!order) return errorResult('ORDER_NOT_FOUND', 'Order does not exist.');
  if (order.tableId !== reservation.tableId) return errorResult('RESERVATION_TABLE_MISMATCH', 'Reservation and order must use the same table.');
  if (reservation.orderId && reservation.orderId !== payload.orderId) return errorResult('CONFLICT', 'Reservation is already attached to another order.');
  if (order.ownerStaffId !== actor.staffId && actor.role !== 'ADMIN') return errorResult('ORDER_NOT_OWNED', 'Order belongs to another staff member.');
  try {
    await client.mutation({ updatePosReservation: { __args: { id: reservation.id, data: { orderId: payload.orderId } }, id: true } });
  } catch {
    const reread = await findReservationById(client, reservation.id);
    if (reread?.orderId !== payload.orderId) return errorResult('CONFLICT', 'Reservation could not be attached.');
  }
  const prepayments = await findPrepaymentsByReservation(client, reservation.id);
  const applied: string[] = [];
  for (const prepayment of prepayments.filter((row) => row.status === 'UNAPPLIED')) {
    const result = await executeApplyPrepayment(client, { prepaymentId: prepayment.id, orderId: payload.orderId, idempotencyKey: randomUUID() }, actor);
    if (result.status >= 400) return result;
    applied.push(prepayment.id);
  }
  const refreshed = (await reconcileOrderPrepaidTotal(client, payload.orderId)) ?? order;
  return okResult(200, { reservationId: reservation.id, orderId: payload.orderId, appliedPrepaymentIds: applied, prepaidMicros: normalizeCurrency(refreshed.prepaidTotal).amountMicros, remainingMicros: paymentTotals(refreshed).remainingMicros });
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
      return executeOpenShift(
        client,
        { idempotencyKey: payload.idempotencyKey as string },
        actor,
      );
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
    case 'removeUnsentLine':
      return executeRemoveUnsentLine(
        client,
        { lineId: payload.lineId as string },
        actor,
      );
    case 'addStopListEntry':
      return executeAddStopListEntry(
        client,
        {
          menuItemId: payload.menuItemId as string,
          idempotencyKey: payload.idempotencyKey as string,
        },
        actor,
      );
    case 'clearStopListEntry':
      return executeClearStopListEntry(
        client,
        {
          menuItemId: payload.menuItemId as string,
          idempotencyKey: payload.idempotencyKey as string,
        },
        actor,
      );
    case 'printKitchenTicket':
      return executePrintKitchenTicket(
        client,
        {
          orderId: payload.orderId as string,
          idempotencyKey: payload.idempotencyKey as string,
        },
        actor,
      );
    case 'createPrecheck':
      return executeCreatePrecheck(
        client,
        {
          orderId: payload.orderId as string,
          idempotencyKey: payload.idempotencyKey as string,
        },
        actor,
      );
    case 'cancelPrecheck':
      return executeCancelPrecheck(
        client,
        {
          orderId: payload.orderId as string,
          idempotencyKey: payload.idempotencyKey as string,
        },
        actor,
      );
    case 'recordPayment':
      return executeRecordPayment(
        client,
        {
          orderId: payload.orderId as string,
          paymentMethodId: payload.paymentMethodId as string,
          amountMicros: payload.amountMicros as number,
          ...(payload.tenderedAmountMicros !== undefined
            ? { tenderedAmountMicros: payload.tenderedAmountMicros as number }
            : {}),
          idempotencyKey: payload.idempotencyKey as string,
        },
        actor,
      );
    case 'closeOrder':
      return executeCloseOrder(
        client,
        {
          orderId: payload.orderId as string,
          idempotencyKey: payload.idempotencyKey as string,
        },
        actor,
      );
    case 'createReservation':
      return executeCreateReservation(client, {
        tableId: payload.tableId as string,
        scheduledAt: payload.scheduledAt as string | undefined,
        guestName: payload.guestName as string | undefined,
        phone: payload.phone as string | undefined,
        idempotencyKey: payload.idempotencyKey as string,
      }, actor);
    case 'updateReservationStatus':
      return executeUpdateReservationStatus(client, {
        reservationId: payload.reservationId as string,
        status: payload.status as 'COMPLETED' | 'CANCELLED' | 'NO_SHOW',
        idempotencyKey: payload.idempotencyKey as string,
      }, actor);
    case 'createPrepayment':
      return executeCreatePrepayment(client, {
        reservationId: payload.reservationId as string,
        paymentMethodId: payload.paymentMethodId as string | undefined,
        amountMicros: payload.amountMicros as number,
        idempotencyKey: payload.idempotencyKey as string,
      }, actor);
    case 'applyPrepayment':
      return executeApplyPrepayment(client, {
        prepaymentId: payload.prepaymentId as string,
        orderId: payload.orderId as string,
        idempotencyKey: payload.idempotencyKey as string,
      }, actor);
    case 'attachReservationToOrder':
      return executeAttachReservationToOrder(client, {
        reservationId: payload.reservationId as string,
        orderId: payload.orderId as string,
        idempotencyKey: payload.idempotencyKey as string,
      }, actor);
    case 'voidOrderLines':
      return executeVoidOrderLines(client, {
        lineIds: payload.lineIds as string[],
        preparedState: payload.preparedState as 'PREPARED' | 'NOT_PREPARED',
        reason: payload.reason as string | undefined,
        idempotencyKey: payload.idempotencyKey as string,
      }, actor);
    case 'transferOrderToTable':
      return executeTransferOrderToTable(client, {
        orderId: payload.orderId as string,
        targetTableId: payload.targetTableId as string,
        idempotencyKey: payload.idempotencyKey as string,
      }, actor);
    case 'transferOrderToWaiter':
      return executeTransferOrderToWaiter(client, {
        orderId: payload.orderId as string,
        targetStaffId: payload.targetStaffId as string,
        idempotencyKey: payload.idempotencyKey as string,
      }, actor);
    case 'transferOrderLinesToGuest':
      return executeTransferOrderLinesToGuest(client, {
        lineIds: payload.lineIds as string[],
        targetGuestId: payload.targetGuestId as string,
        idempotencyKey: payload.idempotencyKey as string,
      }, actor);
    case 'upsertPrinterDevice':
      return executeUpsertPrinterDevice(client, {
        printerDeviceId: payload.printerDeviceId as string | undefined,
        label: payload.label as string,
        host: payload.host as string,
        port: payload.port as number,
        isActive: payload.isActive as boolean,
        isPrecheckPrinter: payload.isPrecheckPrinter as boolean,
        paperWidth: payload.paperWidth as '58' | '80',
        encodingProfile: payload.encodingProfile as 'CP866' | 'WINDOWS1251' | 'UTF8',
        escPosCodePage: payload.escPosCodePage as number | null | undefined,
        cutSupport: payload.cutSupport as boolean,
      }, actor);
    case 'upsertProductionStation':
      return executeUpsertProductionStation(client, {
        productionStationId: payload.productionStationId as string | undefined,
        label: payload.label as string,
        printerDeviceId: payload.printerDeviceId as string | null | undefined,
        isActive: payload.isActive as boolean,
      }, actor);
    case 'setMenuItemProductionStation':
      return executeSetMenuItemProductionStation(client, {
        menuItemId: payload.menuItemId as string,
        productionStationId: payload.productionStationId as string | null | undefined,
        idempotencyKey: payload.idempotencyKey as string,
      }, actor);
    case 'retryPrintJob':
      return executeRetryPrintJob(client, {
        printJobId: payload.printJobId as string,
        idempotencyKey: payload.idempotencyKey as string,
      }, actor.staffId);
    case 'authenticatePosStaff':
    case 'logoutPosStaff':
    case 'refreshPosSession':
      return errorResult(
        'COMMAND_FORBIDDEN',
        'POS authentication commands are handled before domain dispatch.',
      );
  }
};
