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
  }
};
