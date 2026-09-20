import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';

import type { CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import {
  POS_ACTOR_ROLES,
  type PosActorRole,
} from 'src/pos/pos-permissions';

const PIN_SCRYPT_N = 16_384;
const PIN_SCRYPT_R = 8;
const PIN_SCRYPT_P = 1;
const PIN_KEY_LENGTH = 32;
const PIN_SCRYPT_MAX_MEMORY = 32 * 1024 * 1024;
const PIN_SALT_BYTES = 16;
const DEFAULT_SESSION_IDLE_MINUTES = 15;
const MAX_SESSION_IDLE_MINUTES = 24 * 60;
// Absolute cap regardless of activity, so an idle-refreshed terminal session
// cannot live forever.
const MAX_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const LOCKOUT_MS = 60 * 1000;
const MAX_STAFF_ROWS = 1000;
// Server-owned global bound so rotating the credential or the client-supplied
// terminalId cannot bypass brute-force protection. Durable (stored in the
// database) so it survives stateless resolver invocations and process restarts.
const GLOBAL_MAX_FAILURES = 30;
const GLOBAL_WINDOW_MS = 5 * 60 * 1000;
const GLOBAL_LOCKOUT_MS = 60 * 1000;

type Connection<T> = {
  edges?: Array<{ node?: T | null } | null>;
};

export const posSessionIdleTtlMs = (
  configuredMinutes = process.env.MAHABBAT_POS_SESSION_IDLE_MINUTES,
): number => {
  if (configuredMinutes === undefined || configuredMinutes.trim() === '') {
    return DEFAULT_SESSION_IDLE_MINUTES * 60 * 1000;
  }
  const minutes = Number(configuredMinutes);
  if (
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > MAX_SESSION_IDLE_MINUTES
  ) {
    return DEFAULT_SESSION_IDLE_MINUTES * 60 * 1000;
  }
  return minutes * 60 * 1000;
};

type PosStaffRecord = {
  id: string;
  displayName?: string | null;
  staffRole?: string | null;
  pinHash?: string | null;
  pinLookup?: string | null;
  cardIdentifier?: string | null;
  isActive?: boolean | null;
  failedLoginCount?: number | null;
  lockedUntil?: string | null;
};

type PosSessionRecord = {
  id: string;
  sessionId?: string | null;
  staffId?: string | null;
  staffRole?: string | null;
  tokenHash?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  terminalId?: string | null;
};

export type AuthenticatePosStaffPayload = {
  pin?: string;
  cardIdentifier?: string;
  terminalId?: string;
};

export type AuthenticatedPosContext = {
  staffId: string;
  role: PosActorRole;
  sessionId: string;
  sessionRecordId: string;
  expiresAt: string;
  terminalId?: string | null;
};

export type PosAuthResult = {
  status: number;
  body: unknown;
};

const response = (status: number, body: unknown): PosAuthResult => ({
  status,
  body,
});

const invalidCredentials = (): PosAuthResult =>
  response(401, {
    code: 'INVALID_POS_CREDENTIALS',
    message: 'Неверный PIN или идентификатор карты.',
  });

const normalizePin = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const pin = value.trim();
  return /^\d{4,8}$/.test(pin) ? pin : null;
};

export const normalizeCardIdentifier = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const card = value.trim().toUpperCase();
  return card.length > 0 && card.length <= 128 ? card : null;
};

const deriveScryptKey = async (
  pin: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(
      pin,
      salt,
      PIN_KEY_LENGTH,
      { N: n, r, p, maxmem: PIN_SCRYPT_MAX_MEMORY },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey as Buffer);
      },
    );
  });

export const hashPosPin = async (pin: string): Promise<string> => {
  const normalized = normalizePin(pin);
  if (!normalized) throw new Error('PIN must contain 4 to 8 digits.');

  const salt = randomBytes(PIN_SALT_BYTES);
  const derivedKey = await deriveScryptKey(
    normalized,
    salt,
    PIN_SCRYPT_N,
    PIN_SCRYPT_R,
    PIN_SCRYPT_P,
  );

  return [
    'scrypt',
    PIN_SCRYPT_N,
    PIN_SCRYPT_R,
    PIN_SCRYPT_P,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
};

export const verifyPosPin = async (
  pin: string,
  encodedHash: string,
): Promise<boolean> => {
  const normalized = normalizePin(pin);
  const parts = encodedHash.split('$');

  if (
    !normalized ||
    parts.length !== 6 ||
    parts[0] !== 'scrypt' ||
    !/^\d+$/.test(parts[1]) ||
    !/^\d+$/.test(parts[2]) ||
    !/^\d+$/.test(parts[3])
  ) {
    return false;
  }

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);

  if (
    !Number.isSafeInteger(n) ||
    !Number.isSafeInteger(r) ||
    !Number.isSafeInteger(p) ||
    n < 1024 ||
    n > 1_048_576 ||
    r < 1 ||
    r > 32 ||
    p < 1 ||
    p > 8
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    const actual = await deriveScryptKey(normalized, salt, n, r, p);

    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
};

export const hashPosSessionToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

const queryRecords = async <T>(
  client: CoreApiClientLike,
  root: string,
  filter: Record<string, unknown>,
  fields: Record<string, unknown>,
  first = MAX_STAFF_ROWS,
): Promise<T[]> => {
  const result = (await client.query({
    [root]: {
      __args: { filter, first },
      edges: { node: fields },
    },
  })) as Record<string, Connection<T> | undefined>;

  return result[root]?.edges
    ?.map((edge) => edge?.node)
    .filter((node): node is T => Boolean(node)) ?? [];
};

const STAFF_FIELDS = {
  id: true,
  displayName: true,
  staffRole: true,
  pinHash: true,
  pinLookup: true,
  cardIdentifier: true,
  isActive: true,
  failedLoginCount: true,
  lockedUntil: true,
};

const SESSION_FIELDS = {
  id: true,
  sessionId: true,
  staffId: true,
  staffRole: true,
  tokenHash: true,
  issuedAt: true,
  expiresAt: true,
  revokedAt: true,
  terminalId: true,
};

const roleFromValue = (value: unknown): PosActorRole | null =>
  typeof value === 'string' && POS_ACTOR_ROLES.includes(value as PosActorRole)
    ? (value as PosActorRole)
    : null;

const isLocked = (staff: PosStaffRecord, now = Date.now()): boolean => {
  const lockedUntil = staff.lockedUntil
    ? Date.parse(staff.lockedUntil)
    : Number.NaN;
  return Number.isFinite(lockedUntil) && lockedUntil > now;
};

const updateStaffLoginState = async (
  client: CoreApiClientLike,
  staff: PosStaffRecord,
  failedLoginCount: number,
  lockedUntil: string | null,
): Promise<void> => {
  await client.mutation({
    updatePosStaff: {
      __args: {
        id: staff.id,
        data: { failedLoginCount, lockedUntil },
      },
      id: true,
    },
  });
};

type PosLoginThrottleRecord = {
  id: string;
  key?: string | null;
  failedCount?: number | null;
  lockedUntil?: string | null;
  windowStartedAt?: string | null;
};

const THROTTLE_FIELDS = {
  id: true,
  key: true,
  failedCount: true,
  lockedUntil: true,
  windowStartedAt: true,
};

const pinLookupSecret = (): string =>
  process.env.MAHABBAT_PIN_LOOKUP_SECRET ||
  process.env.MAHABBAT_INTERNAL_ROUTE_SECRET ||
  '';

// Deterministic, non-verifying index used only to select the single candidate
// row before running scrypt. It is not a credential and cannot be used to
// authenticate; the scrypt hash remains the verifier.
export const computePinLookup = (pin: string): string => {
  const secret = pinLookupSecret();
  const payload = `mahabbat-pin-lookup:${pin}`;
  return secret
    ? createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
    : createHash('sha256').update(payload, 'utf8').digest('hex');
};

const credentialFingerprint = (kind: 'pin' | 'card', value: string): string => {
  const secret = pinLookupSecret();
  const payload = `mahabbat-login:${kind}:${value}`;
  return secret
    ? createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
    : createHash('sha256').update(payload, 'utf8').digest('hex');
};

const findThrottle = async (
  client: CoreApiClientLike,
  key: string,
): Promise<PosLoginThrottleRecord | null> =>
  (
    await queryRecords<PosLoginThrottleRecord>(
      client,
      'posLoginThrottles',
      { key: { eq: key } },
      THROTTLE_FIELDS,
      1,
    )
  )[0] ?? null;

const throttleRetryAfterSeconds = (
  record: PosLoginThrottleRecord | null,
  now = Date.now(),
): number => {
  const lockedUntil = record?.lockedUntil ? Date.parse(record.lockedUntil) : Number.NaN;
  return Number.isFinite(lockedUntil) && lockedUntil > now
    ? Math.ceil((lockedUntil - now) / 1000)
    : 0;
};

const rateLimitedResponse = (retryAfterSeconds: number): PosAuthResult =>
  response(429, {
    code: 'POS_LOGIN_RATE_LIMITED',
    message: 'Слишком много попыток входа. Повторите позже.',
    retryAfterSeconds,
  });

const mutationUpdatedRows = (result: unknown, root: string): number => {
  const value = (result as Record<string, unknown> | null)?.[root];
  if (Array.isArray(value)) return value.length;
  return value && typeof value === 'object' && 'id' in value ? 1 : 0;
};

const recordThrottleFailure = async (
  client: CoreApiClientLike,
  key: string,
  maxFailures: number,
  windowMs: number,
  lockoutMs: number,
  now = Date.now(),
): Promise<void> => {
  const nowIso = new Date(now).toISOString();

  // Compare-and-swap the counter on its previous value so two concurrent
  // failures cannot read the same count and both write the same result
  // (which would let a parallel attacker stay under the threshold).
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const record = await findThrottle(client, key);

    if (!record?.id) {
      try {
        await client.mutation({
          createPosLoginThrottle: {
            __args: {
              data: {
                key,
                failedCount: 1,
                lockedUntil: null,
                windowStartedAt: nowIso,
              },
            },
            id: true,
          },
        });
        return;
      } catch {
        // A concurrent worker created the row first; re-read and increment.
        continue;
      }
    }

    const windowStartedAt = record.windowStartedAt
      ? Date.parse(record.windowStartedAt)
      : Number.NaN;
    const inWindow =
      Number.isFinite(windowStartedAt) && now - windowStartedAt < windowMs;
    const failedCount = (inWindow ? (record.failedCount ?? 0) : 0) + 1;
    const lockedUntil =
      failedCount >= maxFailures
        ? new Date(now + lockoutMs).toISOString()
        : record.lockedUntil ?? null;

    try {
      const result = await client.mutation({
        updatePosLoginThrottles: {
          __args: {
            filter: {
              id: { eq: record.id },
              failedCount: { eq: record.failedCount ?? 0 },
            },
            data: {
              failedCount,
              lockedUntil,
              windowStartedAt: inWindow ? record.windowStartedAt : nowIso,
            },
          },
          id: true,
        },
      });
      if (mutationUpdatedRows(result, 'updatePosLoginThrottles') > 0) return;
    } catch {
      // Fall through and retry the CAS.
    }
  }
};

const clearThrottle = async (
  client: CoreApiClientLike,
  key: string,
): Promise<void> => {
  const record = await findThrottle(client, key);
  if (!record?.id) return;
  try {
    await client.mutation({
      updatePosLoginThrottle: {
        __args: {
          id: record.id,
          data: { failedCount: 0, lockedUntil: null },
        },
        id: true,
      },
    });
  } catch {
    // Clearing is best-effort; a residual counter only tightens protection.
  }
};

export const resetPosAuthRateLimiterForTests = (): void => {
  // Throttle state is durable (database-backed); this hook is retained for
  // callers and intentionally performs no in-process reset.
};

const staffIsUsable = (staff: PosStaffRecord): PosAuthResult | null => {
  if (staff.isActive === false) {
    return response(403, {
      code: 'POS_STAFF_INACTIVE',
      message: 'Сотрудник POS неактивен.',
    });
  }

  if (isLocked(staff)) {
    return response(429, {
      code: 'POS_STAFF_LOCKED',
      message: 'Вход сотрудника временно заблокирован.',
    });
  }

  return null;
};

export const authenticatePosStaff = async (
  client: CoreApiClientLike,
  payload: AuthenticatePosStaffPayload,
): Promise<PosAuthResult> => {
  const pin = normalizePin(payload.pin);
  const cardIdentifier = normalizeCardIdentifier(payload.cardIdentifier);

  if ((!pin && !cardIdentifier) || (pin && cardIdentifier)) {
    return response(400, {
      code: 'INVALID_POS_CREDENTIALS',
      message: 'Укажите PIN или идентификатор карты.',
    });
  }

  const terminalId = payload.terminalId?.trim() || null;
  if (terminalId && terminalId.length > 128) {
    return response(400, {
      code: 'INVALID_TERMINAL_ID',
      message: 'Идентификатор терминала слишком длинный.',
    });
  }

  // Server-owned throttle keys: the credential fingerprint plus a global key.
  // Neither depends on the client-supplied terminalId, and both are persisted
  // so rotating terminalId or restarting a worker cannot bypass protection.
  const credentialKey = cardIdentifier
    ? `cred:card:${credentialFingerprint('card', cardIdentifier)}`
    : `cred:pin:${credentialFingerprint('pin', pin as string)}`;
  const globalKey = 'global';

  const credentialRetry = throttleRetryAfterSeconds(
    await findThrottle(client, credentialKey),
  );
  if (credentialRetry > 0) return rateLimitedResponse(credentialRetry);
  const globalRetry = throttleRetryAfterSeconds(
    await findThrottle(client, globalKey),
  );
  if (globalRetry > 0) return rateLimitedResponse(globalRetry);

  const recordFailure = async (
    staff?: PosStaffRecord | null,
  ): Promise<void> => {
    await recordThrottleFailure(
      client,
      credentialKey,
      MAX_LOGIN_FAILURES,
      GLOBAL_WINDOW_MS,
      LOCKOUT_MS,
    );
    await recordThrottleFailure(
      client,
      globalKey,
      GLOBAL_MAX_FAILURES,
      GLOBAL_WINDOW_MS,
      GLOBAL_LOCKOUT_MS,
    );
    // Durable per-staff lockout: when the presented credential resolves to a
    // specific staff row, count the failure against that employee too. This is
    // independent of the client-supplied terminalId and of the presented PIN.
    if (staff?.id) {
      const failed = (staff.failedLoginCount ?? 0) + 1;
      const lockedUntil =
        failed >= MAX_LOGIN_FAILURES
          ? new Date(Date.now() + LOCKOUT_MS).toISOString()
          : staff.lockedUntil ?? null;
      await updateStaffLoginState(client, staff, failed, lockedUntil);
    }
  };

  const lookup = pin ? computePinLookup(pin) : null;

  // Fast path: resolve the single candidate through the deterministic lookup
  // index instead of fetching every staff row. `first: 2` is enough to detect
  // an ambiguous (shared) PIN without a full scan.
  const fastMatches = cardIdentifier
    ? await queryRecords<PosStaffRecord>(
        client,
        'posStaffs',
        { cardIdentifier: { eq: cardIdentifier } },
        STAFF_FIELDS,
        2,
      )
    : await queryRecords<PosStaffRecord>(
        client,
        'posStaffs',
        { pinLookup: { eq: lookup } },
        STAFF_FIELDS,
        2,
      );

  let candidate: PosStaffRecord | null = null;
  let inactiveCandidate = false;

  if (cardIdentifier) {
    const cardMatches = fastMatches.filter(
      (row) => row.cardIdentifier === cardIdentifier,
    );
    if (cardMatches.length > 1) {
      await recordFailure(cardMatches[0]);
      return invalidCredentials();
    }
    candidate = cardMatches[0] ?? null;
    if (candidate && isLocked(candidate)) {
      await recordFailure(candidate);
      return response(429, {
        code: 'POS_STAFF_LOCKED',
        message: 'Вход сотрудника временно заблокирован.',
      });
    }
  } else {
    const normalizedPin = pin as string;
    // Preserve the historical "the PIN must identify exactly one staff member"
    // rule on the fast path too: a shared PIN is ambiguous and denied, never
    // silently resolved to whichever row happens to be first.
    const lookupMatches = fastMatches.filter(
      (row) => Boolean(row.pinLookup) && row.pinLookup === lookup,
    );

    if (lookupMatches.length > 1) {
      await recordFailure(lookupMatches[0]);
      return invalidCredentials();
    }

    if (lookupMatches.length === 1) {
      const match = lookupMatches[0];
      if (isLocked(match)) {
        await recordFailure(match);
        return response(429, {
          code: 'POS_STAFF_LOCKED',
          message: 'Вход сотрудника временно заблокирован.',
        });
      }
      // A migrated row can mask a still-legacy duplicate with the same PIN.
      // While any legacy rows remain, confirm none of them share this PIN.
      const legacy = await queryRecords<PosStaffRecord>(
        client,
        'posStaffs',
        { pinLookup: { is: 'NULL' } },
        STAFF_FIELDS,
        MAX_STAFF_ROWS,
      );
      let legacyDuplicate = false;
      for (const row of legacy) {
        if (row.pinLookup) continue;
        if (row.pinHash && (await verifyPosPin(normalizedPin, row.pinHash))) {
          legacyDuplicate = true;
          break;
        }
      }
      if (legacyDuplicate) {
        await recordFailure(match);
        return invalidCredentials();
      }
      if (match.pinHash && (await verifyPosPin(normalizedPin, match.pinHash))) {
        candidate = match;
      } else {
        await recordFailure(match);
        return invalidCredentials();
      }
    } else {
      // Legacy deployment: only rows without a lookup index need the expensive
      // scrypt trial. After migration this set is empty and login is O(1).
      const legacyRows = await queryRecords<PosStaffRecord>(
        client,
        'posStaffs',
        { pinLookup: { is: 'NULL' } },
        STAFF_FIELDS,
        MAX_STAFF_ROWS,
      );
      const matches: PosStaffRecord[] = [];
      for (const row of legacyRows) {
        if (row.pinLookup) continue;
        if (row.pinHash && (await verifyPosPin(normalizedPin, row.pinHash))) {
          matches.push(row);
        }
      }

      if (matches.length > 1) {
        await recordFailure(matches[0]);
        return invalidCredentials();
      }

      if (matches.length === 1) {
        candidate = matches[0];
        inactiveCandidate = candidate.isActive === false;
        if (isLocked(candidate)) {
          await recordFailure(candidate);
          return response(429, {
            code: 'POS_STAFF_LOCKED',
            message: 'Вход сотрудника временно заблокирован.',
          });
        }
        try {
          await client.mutation({
            updatePosStaff: {
              __args: { id: candidate.id, data: { pinLookup: lookup } },
              id: true,
            },
          });
        } catch {
          // Best-effort migration; a failure simply keeps the legacy path.
        }
      }
    }
  }

  if (!candidate) {
    await recordFailure();
    return invalidCredentials();
  }

  if (inactiveCandidate || candidate.isActive === false) {
    return staffIsUsable(candidate) ?? invalidCredentials();
  }

  const unusable = staffIsUsable(candidate);
  if (unusable) return unusable;

  if (cardIdentifier && !candidate.cardIdentifier) {
    await recordFailure();
    return invalidCredentials();
  }

  await clearThrottle(client, credentialKey);
  // A successful login must also lift the shared global window; otherwise an
  // attacker who trips it once keeps every terminal locked out (F-02/A-09).
  await clearThrottle(client, globalKey);
  if ((candidate.failedLoginCount ?? 0) !== 0 || candidate.lockedUntil) {
    await updateStaffLoginState(client, candidate, 0, null);
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + posSessionIdleTtlMs());
  const sessionToken = randomBytes(32).toString('base64url');
  const sessionId = randomUUID();
  const role = roleFromValue(candidate.staffRole);

  if (!role) {
    return response(500, {
      code: 'POS_STAFF_ROLE_INVALID',
      message: 'Роль сотрудника POS настроена некорректно.',
    });
  }

  const created = (await client.mutation({
    createPosSession: {
      __args: {
        data: {
          sessionId,
          staffId: candidate.id,
          staffRole: role,
          tokenHash: hashPosSessionToken(sessionToken),
          issuedAt: issuedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          terminalId,
          revokedAt: null,
        },
      },
      id: true,
    },
  })) as { createPosSession?: { id?: string } };

  if (!created.createPosSession?.id) {
    return response(500, {
      code: 'POS_SESSION_CREATE_FAILED',
      message: 'Не удалось создать POS-сессию.',
    });
  }

  return response(201, {
    sessionId,
    sessionToken,
    expiresAt: expiresAt.toISOString(),
    staff: {
      id: candidate.id,
      displayName: candidate.displayName ?? 'Сотрудник',
      role,
    },
  });
};

export const getAuthenticatedPosContext = async (
  client: CoreApiClientLike,
  sessionToken: unknown,
): Promise<
  | { ok: true; context: AuthenticatedPosContext }
  | { ok: false; result: PosAuthResult }
> => {
  if (typeof sessionToken !== 'string' || sessionToken.length < 32 || sessionToken.length > 256) {
    return {
      ok: false,
      result: response(401, {
        code: 'POS_SESSION_REQUIRED',
        message: 'Требуется действующая POS-сессия.',
      }),
    };
  }

  const sessions = await queryRecords<PosSessionRecord>(
    client,
    'posSessions',
    { tokenHash: { eq: hashPosSessionToken(sessionToken) } },
    SESSION_FIELDS,
    1,
  );
  const session = sessions[0];

  if (!session?.staffId || !session.sessionId || !session.expiresAt) {
    return {
      ok: false,
      result: response(401, {
        code: 'POS_SESSION_INVALID',
        message: 'POS-сессия недействительна.',
      }),
    };
  }

  const expiresAtMs = Date.parse(session.expiresAt);
  const issuedAtMs = session.issuedAt ? Date.parse(session.issuedAt) : Number.NaN;
  const beyondAbsoluteLifetime =
    Number.isFinite(issuedAtMs) &&
    Date.now() - issuedAtMs > MAX_SESSION_LIFETIME_MS;
  if (
    session.revokedAt ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= Date.now() ||
    beyondAbsoluteLifetime
  ) {
    return {
      ok: false,
      result: response(401, {
        code: 'POS_SESSION_EXPIRED',
        message: 'POS-сессия истекла или отозвана.',
      }),
    };
  }

  const staff = (
    await queryRecords<PosStaffRecord>(
      client,
      'posStaffs',
      { id: { eq: session.staffId } },
      STAFF_FIELDS,
      1,
    )
  )[0];
  const role = roleFromValue(staff?.staffRole);

  if (!staff || staff.isActive === false || !role || role !== session.staffRole) {
    return {
      ok: false,
      result: response(401, {
        code: 'POS_SESSION_INVALID',
        message: 'Сотрудник POS недоступен или роль изменилась.',
      }),
    };
  }

  return {
    ok: true,
    context: {
      staffId: staff.id,
      role,
      sessionId: session.sessionId,
      sessionRecordId: session.id,
      expiresAt: session.expiresAt,
      terminalId: session.terminalId,
    },
  };
};

export const refreshPosSessionActivity = async (
  client: CoreApiClientLike,
  context: AuthenticatedPosContext,
  now = new Date(),
  idleTtlMs = posSessionIdleTtlMs(),
): Promise<AuthenticatedPosContext> => {
  const expiresAt = new Date(now.getTime() + idleTtlMs).toISOString();
  await client.mutation({
    updatePosSession: {
      __args: {
        id: context.sessionRecordId,
        data: { expiresAt },
      },
      id: true,
    },
  });

  return { ...context, expiresAt };
};

export const revokePosSession = async (
  client: CoreApiClientLike,
  context: AuthenticatedPosContext,
): Promise<PosAuthResult> => {
  await client.mutation({
    updatePosSession: {
      __args: {
        id: context.sessionRecordId,
        data: { revokedAt: new Date().toISOString() },
      },
      id: true,
    },
  });

  return response(200, { sessionId: context.sessionId, revoked: true });
};
