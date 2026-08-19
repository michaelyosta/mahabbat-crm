import {
  POS_ACTOR_ROLES,
  POS_COMMANDS,
  type PosActor,
  type PosActorRole,
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
  actor: PosActor;
  payload: Record<string, unknown>;
};

export type OpenShiftPayload = {
  staffId: string;
  idempotencyKey: string;
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

const parseActor = (value: unknown): ParseResult<PosActor> => {
  if (typeof value !== 'object' || value === null) {
    return invalid('INVALID_ACTOR', 'actor must be an object');
  }

  const { staffId, role } = value as Record<string, unknown>;

  if (!isUuid(staffId)) {
    return invalid('INVALID_ACTOR', 'actor.staffId must be a UUID');
  }

  if (
    typeof role !== 'string' ||
    !POS_ACTOR_ROLES.includes(role as PosActorRole)
  ) {
    return invalid('INVALID_ACTOR', 'actor.role must be ADMIN or WAITER');
  }

  return { ok: true, data: { staffId, role: role as PosActorRole } };
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

  const { staffId, idempotencyKey } = payload as Record<string, unknown>;

  if (!isUuid(staffId)) {
    return invalid('INVALID_PAYLOAD', 'staffId must be a UUID');
  }

  const parsedKey = parseIdempotencyKey(idempotencyKey);
  if (!parsedKey.ok) return parsedKey;

  return {
    ok: true,
    data: { staffId, idempotencyKey: parsedKey.data },
  };
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

export const parsePosCommandEnvelope = (
  body: unknown,
): ParseResult<PosCommandEnvelope> => {
  if (typeof body !== 'object' || body === null) {
    return invalid('INVALID_BODY', 'Request body must be a JSON object');
  }

  const { command, actor, payload } = body as Record<string, unknown>;

  if (
    typeof command !== 'string' ||
    !POS_COMMANDS.includes(command as PosCommand)
  ) {
    if (typeof command === 'string') {
      return invalid('UNKNOWN_COMMAND', `Unknown command: ${command}`);
    }

    return invalid('INVALID_COMMAND', 'command must be a string');
  }

  const parsedActor = parseActor(actor);
  if (!parsedActor.ok) return parsedActor;

  return {
    ok: true,
    data: {
      command: command as PosCommand,
      actor: parsedActor.data,
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
  switch (command) {
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
  }
};