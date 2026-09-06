const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const INVENTORY_COMMANDS = [
  'createStockLocation',
  'createStockItem',
  'receiveStock',
  'writeOffStock',
  'transferStock',
  'upsertRecipe',
  'produceSemiFinished',
  'createInventoryCount',
  'startInventoryCount',
  'finalizeInventoryCount',
] as const;

export type InventoryCommand = (typeof INVENTORY_COMMANDS)[number];

export type InventoryCommandEnvelope = {
  command: InventoryCommand;
  sessionToken?: string;
  payload: Record<string, unknown>;
};

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

const invalid = (code: string, message: string): ParseResult<never> => ({
  ok: false,
  error: { code, message },
});

export const isInventoryUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

export const parseInventoryCommandEnvelope = (
  body: unknown,
): ParseResult<InventoryCommandEnvelope> => {
  if (typeof body !== 'object' || body === null) {
    return invalid('INVALID_BODY', 'Request body must be a JSON object');
  }

  const { command, payload, sessionToken, actor, staffId, actorStaffId, role } =
    body as Record<string, unknown>;

  if (typeof command !== 'string' || !INVENTORY_COMMANDS.includes(command as InventoryCommand)) {
    return invalid(
      typeof command === 'string' ? 'UNKNOWN_COMMAND' : 'INVALID_COMMAND',
      typeof command === 'string' ? `Unknown command: ${command}` : 'command must be a string',
    );
  }

  if (actor !== undefined || staffId !== undefined || actorStaffId !== undefined || role !== undefined) {
    return invalid('INVALID_ACTOR', 'actor is server-derived; authenticate a POS session instead.');
  }

  if (sessionToken !== undefined && typeof sessionToken !== 'string') {
    return invalid('INVALID_ACTOR', 'sessionToken must be a string');
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return invalid('INVALID_PAYLOAD', 'payload must be an object');
  }

  const suppliedIdentityField = ['actor', 'staffId', 'actorStaffId', 'role'].find(
    (field) => field in (payload as Record<string, unknown>),
  );
  if (suppliedIdentityField) {
    return invalid('INVALID_ACTOR', `${suppliedIdentityField} is server-derived and cannot be supplied.`);
  }

  return {
    ok: true,
    data: {
      command: command as InventoryCommand,
      ...(typeof sessionToken === 'string' ? { sessionToken } : {}),
      payload: payload as Record<string, unknown>,
    },
  };
};
