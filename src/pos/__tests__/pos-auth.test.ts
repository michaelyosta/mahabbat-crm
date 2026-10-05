import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authenticatePosStaff,
  computePinLookup,
  getAuthenticatedPosContext,
  hashPosPin,
  refreshPosSessionActivity,
  resetPosAuthRateLimiterForTests,
  revokePosSession,
  verifyPosPin,
} from 'src/pos/pos-auth';
import type { CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';

const STAFF = '10000000-0000-4000-8000-000000000001';
const ADMIN = '10000000-0000-4000-8000-000000000002';
const INACTIVE = '10000000-0000-4000-8000-000000000003';

type Row = Record<string, unknown> & { id: string };

class FakeAuthDb implements CoreApiClientLike {
  readonly posStaffs: Row[] = [];
  readonly posSessions: Row[] = [];
  readonly posLoginThrottles: Row[] = [];
  private sequence = 1;

  async query(document: unknown): Promise<unknown> {
    const root = Object.keys(document as Record<string, unknown>)[0];
    const operation = (document as Record<string, Record<string, unknown>>)[root];
    const args = (operation.__args ?? {}) as Record<string, unknown>;
    const filter = (args.filter ?? {}) as Record<string, unknown>;
    const rows =
      root === 'posStaffs'
        ? this.posStaffs
        : root === 'posLoginThrottles'
          ? this.posLoginThrottles
          : this.posSessions;
    const filtered = rows.filter((row) =>
      Object.entries(filter).every(([field, condition]) => {
        const eq = (condition as Record<string, unknown>)?.eq;
        return eq === undefined || row[field] === eq;
      }),
    );

    return {
      [root]: {
        edges: filtered.slice(0, Number(args.first ?? 100)).map((node) => ({ node })),
      },
    };
  }

  async mutation(document: unknown): Promise<unknown> {
    const root = Object.keys(document as Record<string, unknown>)[0];
    const operation = (document as Record<string, Record<string, unknown>>)[root];
    const args = (operation.__args ?? {}) as Record<string, unknown>;
    const data = (args.data ?? {}) as Row;

    if (root === 'createPosSession') {
      const row = { ...data, id: `session-${this.sequence++}` };
      this.posSessions.push(row);
      return { createPosSession: row };
    }

    if (root === 'updatePosSession') {
      const row = this.posSessions.find((item) => item.id === args.id);
      if (!row) throw new Error('session not found');
      Object.assign(row, data);
      return { updatePosSession: row };
    }

    if (root === 'updatePosStaff') {
      const row = this.posStaffs.find((item) => item.id === args.id);
      if (!row) throw new Error('staff not found');
      Object.assign(row, data);
      return { updatePosStaff: row };
    }

    if (root === 'createPosLoginThrottle') {
      const row = { ...data, id: `throttle-${this.sequence++}` };
      this.posLoginThrottles.push(row);
      return { createPosLoginThrottle: row };
    }

    if (root === 'updatePosLoginThrottle') {
      const row = this.posLoginThrottles.find((item) => item.id === args.id);
      if (!row) throw new Error('throttle not found');
      Object.assign(row, data);
      return { updatePosLoginThrottle: row };
    }

    throw new Error(`unsupported mutation ${root}`);
  }
}

const staffRow = async (
  id: string,
  displayName: string,
  staffRole: 'WAITER' | 'ADMIN',
  pin: string,
  extra: Record<string, unknown> = {},
): Promise<Row> => ({
  id,
  displayName,
  staffRole,
  pinHash: await hashPosPin(pin),
  cardIdentifier: null,
  isActive: true,
  failedLoginCount: 0,
  lockedUntil: null,
  ...extra,
});

describe('POS authentication context', () => {
  // 30+ scrypt trials in the step-up test exceed the default 5s per-file budget.
  vi.setConfig({ testTimeout: 30_000 });
  beforeEach(() => resetPosAuthRateLimiterForTests());

  it('hashes PINs without retaining plaintext and verifies them', async () => {
    const encoded = await hashPosPin('1234');

    expect(encoded).not.toContain('1234');
    expect(await verifyPosPin('1234', encoded)).toBe(true);
    expect(await verifyPosPin('9999', encoded)).toBe(false);
  });

  it('authenticates a waiter and derives the actor from the server session', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));

    const login = await authenticatePosStaff(db, { pin: '1234', terminalId: 'POS-1' });
    expect(login.status).toBe(201);
    const body = login.body as Record<string, unknown>;
    expect(body.sessionToken).toEqual(expect.any(String));
    expect(body).not.toHaveProperty('pinHash');
    expect((body.staff as Record<string, unknown>).role).toBe('WAITER');

    const context = await getAuthenticatedPosContext(db, body.sessionToken);
    expect(context.ok).toBe(true);
    if (context.ok) {
      expect(context.context.staffId).toBe(STAFF);
      expect(context.context.role).toBe('WAITER');
      expect(context.context.terminalId).toBe('POS-1');
    }
  });

  it('caps idle TTL per role (WAITER 15m, ADMIN 5m)', async () => {
    const { posIdleTtlMsForRole } = await import('src/pos/pos-auth');
    expect(posIdleTtlMsForRole('WAITER')).toBe(15 * 60 * 1000);
    expect(posIdleTtlMsForRole('ADMIN')).toBe(5 * 60 * 1000);
    expect(posIdleTtlMsForRole('WAITER', '30')).toBe(15 * 60 * 1000);
  });

  it('expires sessions past the absolute 12h ceiling even when idle is fresh', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));
    const login = await authenticatePosStaff(db, { pin: '1234' });
    const loginBody = login.body as unknown as Record<string, unknown>;
    const token = loginBody.sessionToken as string;
    db.posSessions[0].issuedAt = new Date(Date.now() - 13 * 3600 * 1000).toISOString();
    db.posSessions[0].expiresAt = new Date(Date.now() + 60 * 1000).toISOString();
    const checked = await getAuthenticatedPosContext(db, token);
    expect(checked.ok).toBe(false);
  });

  it('warns 2 minutes before the idle deadline (re-PIN hint)', async () => {
    const { posSessionNeedsRepinWarning } = await import('src/pos/pos-auth');
    expect(posSessionNeedsRepinWarning(new Date(Date.now() + 90 * 1000).toISOString())).toBe(true);
    expect(posSessionNeedsRepinWarning(new Date(Date.now() + 10 * 60 * 1000).toISOString())).toBe(false);
  });

  it('refuses PIN login without a lookup secret outside dev/test (fail-closed)', async () => {
    const saved = process.env.MAHABBAT_PIN_LOOKUP_SECRET;
    const savedNode = process.env.NODE_ENV;
    delete process.env.MAHABBAT_PIN_LOOKUP_SECRET;
    delete process.env.MAHABBAT_INTERNAL_ROUTE_SECRET;
    process.env.NODE_ENV = 'production';
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));
    await expect(authenticatePosStaff(db, { pin: '1234' })).rejects.toThrow('PIN lookup secret is not configured');
    if (saved !== undefined) process.env.MAHABBAT_PIN_LOOKUP_SECRET = saved;
    if (savedNode !== undefined) process.env.NODE_ENV = savedNode;
  });

  it('restarts the idle countdown after an authenticated POS action', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));
    const login = await authenticatePosStaff(db, { pin: '1234' });
    const loginBody = login.body as unknown as Record<string, unknown>;
    const token = loginBody.sessionToken as string;
    const authenticated = await getAuthenticatedPosContext(db, token);
    expect(authenticated.ok).toBe(true);
    if (!authenticated.ok) return;

    const actionAt = new Date('2026-08-22T12:00:00.000Z');
    const refreshed = await refreshPosSessionActivity(
      db,
      authenticated.context,
      actionAt,
      15 * 60 * 1000,
    );

    expect(refreshed.expiresAt).toBe('2026-08-22T12:15:00.000Z');
    expect(db.posSessions[0].expiresAt).toBe(refreshed.expiresAt);
  });

  it('derives ADMIN from PosStaff and never accepts a client role', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(ADMIN, 'Администратор', 'ADMIN', '2468'));

    const login = await authenticatePosStaff(db, {
      pin: '2468',
      terminalId: 'POS-1',
    });
    expect(login.status).toBe(201);
    expect(((login.body as Record<string, unknown>).staff as Record<string, unknown>).role).toBe('ADMIN');
  });

  it('denies wrong PIN, inactive card and applies progressive delay (no ban)', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(
      await staffRow(STAFF, 'Айжан', 'WAITER', '1234', {
        cardIdentifier: 'CARD-A',
      }),
      await staffRow(INACTIVE, 'Уволен', 'WAITER', '9876', {
        cardIdentifier: 'CARD-X',
        isActive: false,
      }),
    );

    expect((await authenticatePosStaff(db, { pin: '9999' })).status).toBe(401);
    expect((await authenticatePosStaff(db, { cardIdentifier: 'CARD-X' })).status).toBe(403);

    // Second attempt on the same credential hits the progressive delay
    // (429 POS_LOGIN_DELAY, retry in 1s) instead of a ban.
    const delayed = await authenticatePosStaff(db, { pin: '9999' });
    expect(delayed.status).toBe(429);
    expect(delayed.body && typeof delayed.body === 'object' && 'code' in delayed.body ? delayed.body.code : undefined).toBe('POS_LOGIN_DELAY');
    expect(delayed.body && typeof delayed.body === 'object' && 'retryAfterSeconds' in delayed.body ? delayed.body.retryAfterSeconds : undefined).toBe(1);
  });

  it('denies expired, revoked and tampered sessions', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));
    const login = await authenticatePosStaff(db, { pin: '1234' });
    const loginBody = login.body as unknown as Record<string, unknown>;
    const token = loginBody.sessionToken as string;

    const active = await getAuthenticatedPosContext(db, token);
    expect(active.ok).toBe(true);

    const session = db.posSessions[0];
    session.expiresAt = new Date(Date.now() - 1000).toISOString();
    expect((await getAuthenticatedPosContext(db, token)).ok).toBe(false);

    session.expiresAt = new Date(Date.now() + 60_000).toISOString();
    session.revokedAt = new Date().toISOString();
    expect((await getAuthenticatedPosContext(db, token)).ok).toBe(false);

    expect((await getAuthenticatedPosContext(db, `${token}tampered`)).ok).toBe(false);
  });

  it('revokes a session on logout', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));
    const login = await authenticatePosStaff(db, { pin: '1234' });
    const loginBody = login.body as unknown as Record<string, unknown>;
    const token = loginBody.sessionToken as string;
    const context = await getAuthenticatedPosContext(db, token);
    expect(context.ok).toBe(true);
    if (!context.ok) return;

    expect((await revokePosSession(db, context.context)).status).toBe(200);
    expect((await getAuthenticatedPosContext(db, token)).ok).toBe(false);
  });

  it('keeps the delay when the client rotates terminalId (per-terminal bucket)', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));

    expect((await authenticatePosStaff(db, { pin: '0000', terminalId: 't-1' })).status).toBe(401);

    // Same wrong PIN from a rotated terminal still hits the credential
    // progressive delay — rotating terminalId does not reset it.
    const rotated = await authenticatePosStaff(db, {
      pin: '0000',
      terminalId: 'a-brand-new-terminal-id',
    });
    expect(rotated.status).toBe(429);
    const rotatedBody = rotated.body as unknown;
    expect((rotatedBody && typeof rotatedBody === 'object' && 'code' in rotatedBody ? rotatedBody.code : undefined)).toBe('POS_LOGIN_DELAY');
  });

  it('steps up to ADMIN PIN instead of locking the whole till (global bound)', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));
    db.posStaffs.push(await staffRow(ADMIN, 'Болат', 'ADMIN', '2468'));

    // Drive the venue-wide counter past the bound. Each wrong PIN records one
    // global failure; per-credential/terminal delays are bypassed with a fresh
    // terminal per attempt so every attempt reaches recordFailure (otherwise
    // the local delay gates absorb attempts 2..30 and global never fills).
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const pin = String(1000 + attempt);
      await authenticatePosStaff(db, { pin, terminalId: `global-test-${attempt}` });
    }

    // WAITER login now asks for ADMIN step-up (403), not a till-wide 429 ban.
    const waiter = await authenticatePosStaff(db, { pin: '1234', terminalId: 'global-test' });
    expect(waiter.status).toBe(403);
    const waiterBody = waiter.body as unknown;
    expect((waiterBody && typeof waiterBody === 'object' && 'code' in waiterBody ? waiterBody.code : undefined)).toBe('POS_ADMIN_STEP_UP_REQUIRED');

    // ADMIN login still proceeds through the step-up.
    const admin = await authenticatePosStaff(db, { pin: '2468', terminalId: 'global-test' });
    expect(admin.status).toBe(201);
  });

  it('rejects a shared PIN even on the lookup fast path', async () => {
    const db = new FakeAuthDb();
    const sharedLookup = computePinLookup('1234');
    db.posStaffs.push(
      await staffRow(STAFF, 'Айжан', 'WAITER', '1234', { pinLookup: sharedLookup }),
      await staffRow(ADMIN, 'Болат', 'WAITER', '1234', { pinLookup: sharedLookup }),
    );

    expect((await authenticatePosStaff(db, { pin: '1234' })).status).toBe(401);
  });

  it('delays repeat failures and recovers after the window resets', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(
      await staffRow(STAFF, 'Айжан', 'WAITER', '1234', { cardIdentifier: 'CARD-A' }),
    );

    expect((await authenticatePosStaff(db, { cardIdentifier: 'CARD-WRONG' })).status).toBe(401);
    const delayed = await authenticatePosStaff(db, { cardIdentifier: 'CARD-WRONG' });
    expect(delayed.status).toBe(429);

    for (const row of db.posLoginThrottles) {
      row.failedCount = 0;
      row.windowStartedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    }

    expect((await authenticatePosStaff(db, { cardIdentifier: 'CARD-WRONG' })).status).toBe(401);
  });
});
