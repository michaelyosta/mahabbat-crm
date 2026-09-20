import { beforeEach, describe, expect, it } from 'vitest';

import {
  authenticatePosStaff,
  computePinLookup,
  getAuthenticatedPosContext,
  hashPosPin,
  posSessionIdleTtlMs,
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
  readonly staffFilters: Record<string, unknown>[] = [];
  readonly staffQueryLimits: number[] = [];
  private sequence = 1;

  async query(document: unknown): Promise<unknown> {
    const root = Object.keys(document as Record<string, unknown>)[0];
    const operation = (document as Record<string, Record<string, unknown>>)[root];
    const args = (operation.__args ?? {}) as Record<string, unknown>;
    const filter = (args.filter ?? {}) as Record<string, unknown>;
    if (root === 'posStaffs') {
      this.staffFilters.push(filter);
      this.staffQueryLimits.push(Number(args.first ?? 100));
    }
    const rows =
      root === 'posStaffs'
        ? this.posStaffs
        : root === 'posLoginThrottles'
          ? this.posLoginThrottles
          : this.posSessions;
    const filtered = rows.filter((row) =>
      Object.entries(filter).every(([field, condition]) => {
        const predicate = condition as Record<string, unknown> | undefined;
        if (predicate && predicate.is === 'NULL') return row[field] == null;
        const eq = predicate?.eq;
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

    if (root === 'updatePosLoginThrottles') {
      const filter = (args.filter ?? {}) as Record<string, unknown>;
      const matches = this.posLoginThrottles.filter((row) =>
        Object.entries(filter).every(([field, condition]) => {
          const predicate = condition as Record<string, unknown> | undefined;
          if (predicate && predicate.is === 'NULL') return row[field] == null;
          const eq = predicate?.eq;
          return eq === undefined || row[field] === eq;
        }),
      );
      for (const row of matches) Object.assign(row, data);
      return { updatePosLoginThrottles: matches };
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

  it('uses a configurable idle timeout and falls back safely', () => {
    expect(posSessionIdleTtlMs()).toBe(15 * 60 * 1000);
    expect(posSessionIdleTtlMs('30')).toBe(30 * 60 * 1000);
    expect(posSessionIdleTtlMs('0')).toBe(15 * 60 * 1000);
    expect(posSessionIdleTtlMs('not-a-number')).toBe(15 * 60 * 1000);
  });

  it('restarts the idle countdown after an authenticated POS action', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));
    const login = await authenticatePosStaff(db, { pin: '1234' });
    const token = (login.body as Record<string, unknown>).sessionToken as string;
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

  it('denies wrong PIN, inactive card and repeated brute-force attempts', async () => {
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

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await authenticatePosStaff(db, { cardIdentifier: 'CARD-WRONG' })).status).toBe(401);
    }
    expect((await authenticatePosStaff(db, { cardIdentifier: 'CARD-WRONG' })).status).toBe(429);
  });

  it('denies expired, revoked and tampered sessions', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));
    const login = await authenticatePosStaff(db, { pin: '1234' });
    const token = (login.body as Record<string, unknown>).sessionToken as string;

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
    const token = (login.body as Record<string, unknown>).sessionToken as string;
    const context = await getAuthenticatedPosContext(db, token);
    expect(context.ok).toBe(true);
    if (!context.ok) return;

    expect((await revokePosSession(db, context.context)).status).toBe(200);
    expect((await getAuthenticatedPosContext(db, token)).ok).toBe(false);
  });

  it('keeps the lockout when the client rotates terminalId', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await authenticatePosStaff(db, {
        pin: '0000',
        terminalId: `terminal-${attempt}`,
      });
      expect(result.status).toBe(401);
    }

    const rotated = await authenticatePosStaff(db, {
      pin: '0000',
      terminalId: 'a-brand-new-terminal-id',
    });
    expect(rotated.status).toBe(429);
    expect((rotated.body as { code: string }).code).toBe('POS_LOGIN_RATE_LIMITED');
  });

  it('applies a durable global bound across credential rotation', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const pin = String(1000 + attempt);
      const result = await authenticatePosStaff(db, { pin, terminalId: 'global-test' });
      expect(result.status).toBe(401);
    }

    const next = await authenticatePosStaff(db, { pin: '9999', terminalId: 'global-test' });
    expect(next.status).toBe(429);
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

  it('rejects while locked and recovers after the durable lock expires', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(
      await staffRow(STAFF, 'Айжан', 'WAITER', '1234', { cardIdentifier: 'CARD-A' }),
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await authenticatePosStaff(db, { cardIdentifier: 'CARD-WRONG' })).status).toBe(401);
    }
    expect((await authenticatePosStaff(db, { cardIdentifier: 'CARD-WRONG' })).status).toBe(429);

    for (const row of db.posLoginThrottles) {
      if (typeof row.lockedUntil === 'string') {
        row.lockedUntil = new Date(Date.now() - 1000).toISOString();
      }
      row.failedCount = 0;
    }

    expect((await authenticatePosStaff(db, { cardIdentifier: 'CARD-WRONG' })).status).toBe(401);
  });

  it('resolves the PIN candidate through the lookup index without a full scan', async () => {
    const db = new FakeAuthDb();
    const total = 60;
    const pins: string[] = [];
    for (let i = 0; i < total; i += 1) {
      const pin = String(100000 + i);
      pins.push(pin);
      const id = `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      db.posStaffs.push(
        await staffRow(id, `Сотрудник ${i}`, 'WAITER', pin, {
          pinLookup: computePinLookup(pin),
        }),
      );
    }

    const login = await authenticatePosStaff(db, { pin: pins[total - 1] });
    expect(login.status).toBe(201);

    const indexQuery = db.staffFilters.some(
      (filter) =>
        (filter.pinLookup as { eq?: string } | undefined)?.eq ===
        computePinLookup(pins[total - 1]),
    );
    expect(indexQuery).toBe(true);
    // No unbounded, unfiltered staff scan is issued.
    expect(db.staffFilters.some((filter) => Object.keys(filter).length === 0)).toBe(false);
  });

  it('rejects a shared PIN split across migrated and legacy rows', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(
      await staffRow(STAFF, 'Айжан', 'WAITER', '1234', {
        pinLookup: computePinLookup('1234'),
      }),
      await staffRow(ADMIN, 'Болат', 'WAITER', '1234'),
    );

    expect((await authenticatePosStaff(db, { pin: '1234' })).status).toBe(401);
  });

  it('locks out after concurrent failures on the same credential', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));

    await Promise.all(
      Array.from({ length: 5 }, () =>
        authenticatePosStaff(db, { pin: '0000', terminalId: 'race' }),
      ),
    );

    expect((await authenticatePosStaff(db, { pin: '0000', terminalId: 'race' })).status).toBe(429);
  });
});
