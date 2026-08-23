import {
  POS_COMMANDS,
  type PosCommand,
} from 'src/pos/pos-permissions';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QUANTITY = 10_000;

type ErrorCode =
  | 'INVALID_BODY'
  | 'INVALID_ACTOR'
  | 'INVALID_COMMAND'
  | 'UNKNOWN_COMMAND'
  | 'INVALID_PAYLOAD';

type ParseResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: ErrorCode; message: string };
    };

const invalid = (code: ErrorCode, message: string): ParseResult<never> => ({
  ok: false,
  error: { code, message },
});

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

export type PosCommandEnvelope = {
  command: PosCommand;
  sessionToken?: string;
  payload: Record<string, unknown>;
};

export type OpenShiftPayload = {
  idempotencyKey: string;
};

export type AuthenticatePosStaffPayload = {
  pin?: string;
  cardIdentifier?: string;
  terminalId?: string;
};

export type CloseShiftPayload = {
  shiftId: string;
};

export type OpenOrderPayload = {
  tableId: string;
  idempotencyKey: string;
};

export type AddGuestPayload = {
  orderId: string;
  idempotencyKey: string;
  name?: string;
};

export type AddLinePayload = {
  orderId: string;
  guestId: string;
  menuItemId: string;
  quantity: number;
  idempotencyKey: string;
};

export type ChangeLineQuantityPayload = {
  lineId: string;
  quantity: number;
};

export type StopListPayload = {
  menuItemId: string;
  idempotencyKey: string;
};

export type PrintKitchenTicketPayload = {
  orderId: string;
  idempotencyKey: string;
};

export type PrecheckPayload = {
  orderId: string;
  idempotencyKey: string;
};

export type RecordPaymentPayload = {
  orderId: string;
  paymentMethodId: string;
  amountMicros: number;
  tenderedAmountMicros?: number;
  idempotencyKey: string;
};

export type CloseOrderPayload = {
  orderId: string;
  idempotencyKey: string;
};

export type CreateReservationPayload = {
  tableId: string;
  scheduledAt?: string;
  guestName?: string;
  phone?: string;
  idempotencyKey: string;
};

export type UpdateReservationStatusPayload = {
  reservationId: string;
  status: 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  idempotencyKey: string;
};

export type CreatePrepaymentPayload = {
  reservationId: string;
  paymentMethodId?: string;
  amountMicros: number;
  idempotencyKey: string;
};

export type ApplyPrepaymentPayload = {
  prepaymentId: string;
  orderId: string;
  idempotencyKey: string;
};

export type AttachReservationToOrderPayload = {
  reservationId: string;
  orderId: string;
  idempotencyKey: string;
};

export type VoidOrderLinesPayload = {
  lineIds: string[];
  preparedState: 'PREPARED' | 'NOT_PREPARED';
  reason?: string;
  idempotencyKey: string;
};

export type TransferOrderToTablePayload = {
  orderId: string;
  targetTableId: string;
  idempotencyKey: string;
};

export type TransferOrderToWaiterPayload = {
  orderId: string;
  targetStaffId: string;
  idempotencyKey: string;
};

export type TransferOrderLinesToGuestPayload = {
  lineIds: string[];
  targetGuestId: string;
  idempotencyKey: string;
};

const parseIdempotencyKey = (value: unknown): ParseResult<string> => {
  if (!isUuid(value)) {
    return invalid('INVALID_PAYLOAD', 'idempotencyKey must be a UUID');
  }

  return { ok: true, data: value };
};

const parseQuantity = (value: unknown): ParseResult<number> => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_QUANTITY
  ) {
    return invalid(
      'INVALID_PAYLOAD',
      `quantity must be a safe integer between 1 and ${MAX_QUANTITY}`,
    );
  }

  return { ok: true, data: value };
};

const parseOpenShift = (payload: unknown): ParseResult<OpenShiftPayload> => {
  if (typeof payload !== 'object' || payload === null) {
    return invalid('INVALID_PAYLOAD', 'payload must be an object');
  }

  const { idempotencyKey } = payload as Record<string, unknown>;

  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;

  return {
    ok: true,
    data: { idempotencyKey: parsedKey.data },
  };
};

const parseAuthenticatePosStaff = (
  payload: unknown,
): ParseResult<AuthenticatePosStaffPayload> => {
  if (typeof payload !== 'object' || payload === null) {
    return invalid('INVALID_PAYLOAD', 'payload must be an object');
  }

  const { pin, cardIdentifier, terminalId } = payload as Record<string, unknown>;

  if (pin !== undefined && typeof pin !== 'string') {
    return invalid('INVALID_PAYLOAD', 'pin must be a string');
  }

  if (cardIdentifier !== undefined && typeof cardIdentifier !== 'string') {
    return invalid('INVALID_PAYLOAD', 'cardIdentifier must be a string');
  }

  if (terminalId !== undefined && typeof terminalId !== 'string') {
    return invalid('INVALID_PAYLOAD', 'terminalId must be a string');
  }

  const hasPin = typeof pin === 'string';
  const hasCard = typeof cardIdentifier === 'string';
  if (hasPin === hasCard) {
    return invalid('INVALID_PAYLOAD', 'provide exactly one of pin or cardIdentifier');
  }
  if (hasPin && !/^\d{4,8}$/.test(pin as string)) {
    return invalid('INVALID_PAYLOAD', 'pin must contain 4 to 8 digits');
  }
  if (hasCard && !(cardIdentifier as string).trim()) {
    return invalid('INVALID_PAYLOAD', 'cardIdentifier must not be blank');
  }
  if (typeof terminalId === 'string' && terminalId.length > 128) {
    return invalid('INVALID_PAYLOAD', 'terminalId is too long');
  }

  return { ok: true, data: { pin, cardIdentifier, terminalId } };
};

const parseCloseShift = (payload: unknown): ParseResult<CloseShiftPayload> => {
  if (typeof payload !== 'object' || payload === null) {
    return invalid('INVALID_PAYLOAD', 'payload must be an object');
  }

  const { shiftId } = payload as Record<string, unknown>;

  if (!isUuid(shiftId)) {
    return invalid('INVALID_PAYLOAD', 'shiftId must be a UUID');
  }

  return { ok: true, data: { shiftId } };
};

const parseOpenOrder = (payload: unknown): ParseResult<OpenOrderPayload> => {
  if (typeof payload !== 'object' || payload === null) {
    return invalid('INVALID_PAYLOAD', 'payload must be an object');
  }

  const { tableId, idempotencyKey } = payload as Record<string, unknown>;

  if (!isUuid(tableId)) {
    return invalid('INVALID_PAYLOAD', 'tableId must be a UUID');
  }

  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;

  return {
    ok: true,
    data: { tableId, idempotencyKey: parsedKey.data },
  };
};

const parseAddGuest = (payload: unknown): ParseResult<AddGuestPayload> => {
  if (typeof payload !== 'object' || payload === null) {
    return invalid('INVALID_PAYLOAD', 'payload must be an object');
  }

  const { orderId, idempotencyKey, name } = payload as Record<string, unknown>;

  if (!isUuid(orderId)) {
    return invalid('INVALID_PAYLOAD', 'orderId must be a UUID');
  }

  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return invalid('INVALID_PAYLOAD', 'name must be a non-empty string');
  }

  return {
    ok: true,
    data: {
      orderId,
      idempotencyKey: parsedKey.data,
      name: name === undefined ? undefined : name.trim(),
    },
  };
};

const parseAddLine = (payload: unknown): ParseResult<AddLinePayload> => {
  if (typeof payload !== 'object' || payload === null) {
    return invalid('INVALID_PAYLOAD', 'payload must be an object');
  }

  const { orderId, guestId, menuItemId, quantity, idempotencyKey } =
    payload as Record<string, unknown>;

  if (!isUuid(orderId)) {
    return invalid('INVALID_PAYLOAD', 'orderId must be a UUID');
  }

  if (!isUuid(guestId)) {
    return invalid('INVALID_PAYLOAD', 'guestId must be a UUID');
  }

  if (!isUuid(menuItemId)) {
    return invalid('INVALID_PAYLOAD', 'menuItemId must be a UUID');
  }

  const parsedQuantity = parseQuantity(quantity);
  if (!parsedQuantity.ok) return parsedQuantity;

  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;

  return {
    ok: true,
    data: {
      orderId,
      guestId,
      menuItemId,
      quantity: parsedQuantity.data,
      idempotencyKey: parsedKey.data,
    },
  };
};

const parseChangeLineQuantity = (
  payload: unknown,
): ParseResult<ChangeLineQuantityPayload> => {
  if (typeof payload !== 'object' || payload === null) {
    return invalid('INVALID_PAYLOAD', 'payload must be an object');
  }

  const { lineId, quantity } = payload as Record<string, unknown>;

  if (!isUuid(lineId)) {
    return invalid('INVALID_PAYLOAD', 'lineId must be a UUID');
  }

  const parsedQuantity = parseQuantity(quantity);
  if (!parsedQuantity.ok) return parsedQuantity;

  return { ok: true, data: { lineId, quantity: parsedQuantity.data } };
};

const parseStopListPayload = (payload: unknown): ParseResult<StopListPayload> => {
  if (typeof payload !== 'object' || payload === null) {
    return invalid('INVALID_PAYLOAD', 'payload must be an object');
  }

  const { menuItemId, idempotencyKey } = payload as Record<string, unknown>;
  if (!isUuid(menuItemId)) {
    return invalid('INVALID_PAYLOAD', 'menuItemId must be a UUID');
  }

  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;

  return { ok: true, data: { menuItemId, idempotencyKey: parsedKey.data } };
};

const parsePrintKitchenTicket = (
  payload: unknown,
): ParseResult<PrintKitchenTicketPayload> => {
  if (typeof payload !== 'object' || payload === null) {
    return invalid('INVALID_PAYLOAD', 'payload must be an object');
  }

  const { orderId, idempotencyKey } = payload as Record<string, unknown>;
  if (!isUuid(orderId)) {
    return invalid('INVALID_PAYLOAD', 'orderId must be a UUID');
  }

  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;

  return { ok: true, data: { orderId, idempotencyKey: parsedKey.data } };
};

const parsePrecheckPayload = (payload: unknown): ParseResult<PrecheckPayload> => {
  if (typeof payload !== 'object' || payload === null) {
    return invalid('INVALID_PAYLOAD', 'payload must be an object');
  }
  const { orderId, idempotencyKey } = payload as Record<string, unknown>;
  if (!isUuid(orderId)) return invalid('INVALID_PAYLOAD', 'orderId must be a UUID');
  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;
  return { ok: true, data: { orderId, idempotencyKey: parsedKey.data } };
};

const parseRecordPaymentPayload = (
  payload: unknown,
): ParseResult<RecordPaymentPayload> => {
  if (typeof payload !== 'object' || payload === null) {
    return invalid('INVALID_PAYLOAD', 'payload must be an object');
  }
  const {
    orderId,
    paymentMethodId,
    amountMicros,
    tenderedAmountMicros,
    idempotencyKey,
  } = payload as Record<string, unknown>;
  if (!isUuid(orderId) || !isUuid(paymentMethodId)) {
    return invalid('INVALID_PAYLOAD', 'orderId and paymentMethodId must be UUIDs');
  }
  if (
    typeof amountMicros !== 'number' ||
    !Number.isSafeInteger(amountMicros) ||
    amountMicros <= 0
  ) {
    return invalid('INVALID_PAYLOAD', 'amountMicros must be a positive safe integer');
  }
  if (
    tenderedAmountMicros !== undefined &&
    (typeof tenderedAmountMicros !== 'number' ||
      !Number.isSafeInteger(tenderedAmountMicros) ||
      tenderedAmountMicros <= 0)
  ) {
    return invalid('INVALID_PAYLOAD', 'tenderedAmountMicros must be a positive safe integer');
  }
  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;
  return {
    ok: true,
    data: {
      orderId,
      paymentMethodId,
      amountMicros,
      ...(tenderedAmountMicros !== undefined ? { tenderedAmountMicros } : {}),
      idempotencyKey: parsedKey.data,
    },
  };
};

const parseOptionalDateTime = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
};

const parseCreateReservationPayload = (
  payload: unknown,
): ParseResult<CreateReservationPayload> => {
  if (typeof payload !== 'object' || payload === null) {
    return invalid('INVALID_PAYLOAD', 'payload must be an object');
  }
  const { tableId, scheduledAt, guestName, phone, idempotencyKey } =
    payload as Record<string, unknown>;
  if (!isUuid(tableId)) return invalid('INVALID_PAYLOAD', 'tableId must be a UUID');
  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;
  if (scheduledAt !== undefined && parseOptionalDateTime(scheduledAt) === undefined) {
    return invalid('INVALID_PAYLOAD', 'scheduledAt must be a valid ISO date');
  }
  if (guestName !== undefined && guestName !== null && typeof guestName !== 'string') {
    return invalid('INVALID_PAYLOAD', 'guestName must be a string');
  }
  if (phone !== undefined && phone !== null && typeof phone !== 'string') {
    return invalid('INVALID_PAYLOAD', 'phone must be a string');
  }
  return {
    ok: true,
    data: {
      tableId,
      idempotencyKey: parsedKey.data,
      ...(parseOptionalDateTime(scheduledAt) ? { scheduledAt: parseOptionalDateTime(scheduledAt) } : {}),
      ...(typeof guestName === 'string' && guestName.trim() ? { guestName: guestName.trim() } : {}),
      ...(typeof phone === 'string' && phone.trim() ? { phone: phone.trim() } : {}),
    },
  };
};

const parseUpdateReservationStatusPayload = (
  payload: unknown,
): ParseResult<UpdateReservationStatusPayload> => {
  if (typeof payload !== 'object' || payload === null) return invalid('INVALID_PAYLOAD', 'payload must be an object');
  const { reservationId, status, idempotencyKey } = payload as Record<string, unknown>;
  if (!isUuid(reservationId) || !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status as string)) {
    return invalid('INVALID_PAYLOAD', 'reservationId/status are invalid');
  }
  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;
  return { ok: true, data: { reservationId, status: status as UpdateReservationStatusPayload['status'], idempotencyKey: parsedKey.data } };
};

const parseCreatePrepaymentPayload = (
  payload: unknown,
): ParseResult<CreatePrepaymentPayload> => {
  if (typeof payload !== 'object' || payload === null) return invalid('INVALID_PAYLOAD', 'payload must be an object');
  const { reservationId, paymentMethodId, amountMicros, idempotencyKey } = payload as Record<string, unknown>;
  if (!isUuid(reservationId) || (paymentMethodId !== undefined && !isUuid(paymentMethodId))) return invalid('INVALID_PAYLOAD', 'reservationId/paymentMethodId must be UUIDs');
  if (typeof amountMicros !== 'number' || !Number.isSafeInteger(amountMicros) || amountMicros <= 0) return invalid('INVALID_PAYLOAD', 'amountMicros must be a positive safe integer');
  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;
  return { ok: true, data: { reservationId, amountMicros, idempotencyKey: parsedKey.data, ...(typeof paymentMethodId === 'string' ? { paymentMethodId } : {}) } };
};

const parseApplyPrepaymentPayload = (payload: unknown): ParseResult<ApplyPrepaymentPayload> => {
  if (typeof payload !== 'object' || payload === null) return invalid('INVALID_PAYLOAD', 'payload must be an object');
  const { prepaymentId, orderId, idempotencyKey } = payload as Record<string, unknown>;
  if (!isUuid(prepaymentId) || !isUuid(orderId)) return invalid('INVALID_PAYLOAD', 'prepaymentId/orderId must be UUIDs');
  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;
  return { ok: true, data: { prepaymentId, orderId, idempotencyKey: parsedKey.data } };
};

const parseAttachReservationToOrderPayload = (payload: unknown): ParseResult<AttachReservationToOrderPayload> => {
  if (typeof payload !== 'object' || payload === null) return invalid('INVALID_PAYLOAD', 'payload must be an object');
  const { reservationId, orderId, idempotencyKey } = payload as Record<string, unknown>;
  if (!isUuid(reservationId) || !isUuid(orderId)) return invalid('INVALID_PAYLOAD', 'reservationId/orderId must be UUIDs');
  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;
  return { ok: true, data: { reservationId, orderId, idempotencyKey: parsedKey.data } };
};

const parseUuidArray = (value: unknown, field: string): ParseResult<string[]> => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
    return invalid('INVALID_PAYLOAD', `${field} must contain 1 to 100 UUIDs`);
  }
  const ids = value.filter(isUuid);
  if (ids.length !== value.length || new Set(ids).size !== ids.length) {
    return invalid('INVALID_PAYLOAD', `${field} must contain unique UUIDs`);
  }
  return { ok: true, data: ids };
};

const parseVoidOrderLinesPayload = (payload: unknown): ParseResult<VoidOrderLinesPayload> => {
  if (typeof payload !== 'object' || payload === null) return invalid('INVALID_PAYLOAD', 'payload must be an object');
  const { lineIds, preparedState, reason, idempotencyKey } = payload as Record<string, unknown>;
  const parsedIds = parseUuidArray(lineIds, 'lineIds');
  if (!parsedIds.ok) return parsedIds;
  if (preparedState !== 'PREPARED' && preparedState !== 'NOT_PREPARED') {
    return invalid('INVALID_PAYLOAD', 'preparedState must be PREPARED or NOT_PREPARED');
  }
  if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
    return invalid('INVALID_PAYLOAD', 'reason must be at most 500 characters');
  }
  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;
  return {
    ok: true,
    data: {
      lineIds: parsedIds.data,
      preparedState,
      idempotencyKey: parsedKey.data,
      ...(typeof reason === 'string' && reason.trim() ? { reason: reason.trim() } : {}),
    },
  };
};

const parseTransferOrderToTablePayload = (payload: unknown): ParseResult<TransferOrderToTablePayload> => {
  if (typeof payload !== 'object' || payload === null) return invalid('INVALID_PAYLOAD', 'payload must be an object');
  const { orderId, targetTableId, idempotencyKey } = payload as Record<string, unknown>;
  if (!isUuid(orderId) || !isUuid(targetTableId)) return invalid('INVALID_PAYLOAD', 'orderId and targetTableId must be UUIDs');
  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;
  return { ok: true, data: { orderId, targetTableId, idempotencyKey: parsedKey.data } };
};

const parseTransferOrderToWaiterPayload = (payload: unknown): ParseResult<TransferOrderToWaiterPayload> => {
  if (typeof payload !== 'object' || payload === null) return invalid('INVALID_PAYLOAD', 'payload must be an object');
  const { orderId, targetStaffId, idempotencyKey } = payload as Record<string, unknown>;
  if (!isUuid(orderId) || !isUuid(targetStaffId)) return invalid('INVALID_PAYLOAD', 'orderId and targetStaffId must be UUIDs');
  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;
  return { ok: true, data: { orderId, targetStaffId, idempotencyKey: parsedKey.data } };
};

const parseTransferOrderLinesToGuestPayload = (payload: unknown): ParseResult<TransferOrderLinesToGuestPayload> => {
  if (typeof payload !== 'object' || payload === null) return invalid('INVALID_PAYLOAD', 'payload must be an object');
  const { lineIds, targetGuestId, idempotencyKey } = payload as Record<string, unknown>;
  const parsedIds = parseUuidArray(lineIds, 'lineIds');
  if (!parsedIds.ok) return parsedIds;
  if (!isUuid(targetGuestId)) return invalid('INVALID_PAYLOAD', 'targetGuestId must be a UUID');
  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;
  return { ok: true, data: { lineIds: parsedIds.data, targetGuestId, idempotencyKey: parsedKey.data } };
};

export const parsePosCommandEnvelope = (
  body: unknown,
): ParseResult<PosCommandEnvelope> => {
  if (typeof body !== 'object' || body === null) {
    return invalid('INVALID_BODY', 'Request body must be a JSON object');
  }

  const { command, actor, payload, sessionToken, staffId, actorStaffId, role } =
    body as Record<string, unknown>;

  if (
    typeof command !== 'string' ||
    !POS_COMMANDS.includes(command as PosCommand)
  ) {
    if (typeof command === 'string') {
      return invalid('UNKNOWN_COMMAND', `Unknown command: ${command}`);
    }

    return invalid('INVALID_COMMAND', 'command must be a string');
  }

  if (
    actor !== undefined ||
    staffId !== undefined ||
    actorStaffId !== undefined ||
    role !== undefined
  ) {
    return invalid(
      'INVALID_ACTOR',
      'actor is server-derived; authenticate a POS session instead.',
    );
  }

  if (sessionToken !== undefined && typeof sessionToken !== 'string') {
    return invalid('INVALID_ACTOR', 'sessionToken must be a string');
  }

  return {
    ok: true,
    data: {
      command: command as PosCommand,
      ...(typeof sessionToken === 'string' ? { sessionToken } : {}),
      payload:
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : {},
    },
  };
};

export const parseCommandPayload = <T>(
  command: PosCommand,
  payload: unknown,
): ParseResult<T> => {
  if (typeof payload === 'object' && payload !== null) {
    const suppliedIdentityField = [
      'actor',
      'staffId',
      'actorStaffId',
      'ownerStaffId',
      'openedByStaffId',
      'role',
    ].find((field) => field in (payload as Record<string, unknown>));

    if (suppliedIdentityField) {
      return invalid(
        'INVALID_ACTOR',
        `${suppliedIdentityField} is server-derived and cannot be supplied by the client.`,
      ) as ParseResult<T>;
    }
  }

  switch (command) {
    case 'authenticatePosStaff':
      return parseAuthenticatePosStaff(payload) as unknown as ParseResult<T>;
    case 'logoutPosStaff':
    case 'refreshPosSession':
      if (typeof payload !== 'object' || payload === null) {
        return invalid('INVALID_PAYLOAD', 'payload must be an object');
      }
      return { ok: true, data: {} as T };
    case 'openShift':
      return parseOpenShift(payload) as unknown as ParseResult<T>;
    case 'closeShift':
      return parseCloseShift(payload) as unknown as ParseResult<T>;
    case 'openOrder':
      return parseOpenOrder(payload) as unknown as ParseResult<T>;
    case 'addGuest':
      return parseAddGuest(payload) as unknown as ParseResult<T>;
    case 'addLine':
      return parseAddLine(payload) as unknown as ParseResult<T>;
    case 'changeLineQuantity':
      return parseChangeLineQuantity(payload) as unknown as ParseResult<T>;
    case 'addStopListEntry':
    case 'clearStopListEntry':
      return parseStopListPayload(payload) as unknown as ParseResult<T>;
    case 'printKitchenTicket':
      return parsePrintKitchenTicket(payload) as unknown as ParseResult<T>;
    case 'createPrecheck':
    case 'cancelPrecheck':
      return parsePrecheckPayload(payload) as unknown as ParseResult<T>;
    case 'recordPayment':
      return parseRecordPaymentPayload(payload) as unknown as ParseResult<T>;
    case 'closeOrder':
      return parsePrecheckPayload(payload) as unknown as ParseResult<T>;
    case 'createReservation':
      return parseCreateReservationPayload(payload) as unknown as ParseResult<T>;
    case 'updateReservationStatus':
      return parseUpdateReservationStatusPayload(payload) as unknown as ParseResult<T>;
    case 'createPrepayment':
      return parseCreatePrepaymentPayload(payload) as unknown as ParseResult<T>;
    case 'applyPrepayment':
      return parseApplyPrepaymentPayload(payload) as unknown as ParseResult<T>;
    case 'attachReservationToOrder':
      return parseAttachReservationToOrderPayload(payload) as unknown as ParseResult<T>;
    case 'voidOrderLines':
      return parseVoidOrderLinesPayload(payload) as unknown as ParseResult<T>;
    case 'transferOrderToTable':
      return parseTransferOrderToTablePayload(payload) as unknown as ParseResult<T>;
    case 'transferOrderToWaiter':
      return parseTransferOrderToWaiterPayload(payload) as unknown as ParseResult<T>;
    case 'transferOrderLinesToGuest':
      return parseTransferOrderLinesToGuestPayload(payload) as unknown as ParseResult<T>;
  }
};
