import { FakeRuntimeState } from 'src/server/__tests__/fake-runtime-state';
import { reserveLoginAttempt } from 'src/pos/pos-login-budget';
import { describe, expect, it } from 'vitest';

import {
  authenticatePosStaff,
  getAuthenticatedPosContext,
  hashPosPin,
  posSessionIdleTtlMs,
  refreshPosSessionActivity,
  revokePosSession,
  verifyPosPin,
} from 'src/pos/pos-auth';
import type { CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';

const STAFF = '10000000-0000-4000-8000-000000000001';
const ADMIN = '10000000-0000-4000-8000-000000000002';
const INACTIVE = '10000000-0000-4000-8000-000000000003';

type Row = Record<string, unknown> & { id: string };

class FakeAuthDb implements CoreApiClientLike {
  constructor(readonly runtime = new FakeRuntimeState()) {}
  readonly posStaffs: Row[] = [];
  readonly posSessions: Row[] = [];
  private sequence = 1;

  async query(document: unknown): Promise<unknown> {
    const root = Object.keys(document as Record<string, unknown>)[0];
    const operation = (document as Record<string, Record<string, unknown>>)[root];
    if (root === 'mahabbatRuntimeStates') return this.runtime.query(operation);
    const args = (operation.__args ?? {}) as Record<string, unknown>;
    const filter = (args.filter ?? {}) as Record<string, unknown>;
    const rows = root === 'posStaffs' ? this.posStaffs : this.posSessions;
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
    if (root === 'createMahabbatRuntimeState' || root === 'updateMahabbatRuntimeStates') return this.runtime.mutation(root, operation);
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

    for (let attempt = 0; attempt < 3; attempt += 1) {
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
});


describe('durable login budget', () => {
  it('blocks changed terminals, changed cards and a fresh resolver client', async () => {
    const shared = new FakeRuntimeState();
    for (let i = 0; i < 5; i += 1) {
      const client = new FakeAuthDb(shared);
      expect((await authenticatePosStaff(client, { pin: '9999', terminalId: `terminal-${i}` })).status).toBe(401);
    }
    expect((await authenticatePosStaff(new FakeAuthDb(shared), { pin: '9999', terminalId: 'new' })).status).toBe(429);
    expect((await authenticatePosStaff(new FakeAuthDb(shared), { cardIdentifier: 'new-card' })).status).toBe(429);
  });
  it('reserves at most five concurrent attempts and recovers after the window', async () => {
    const shared = new FakeRuntimeState();
    const results = await Promise.all(Array.from({ length: 12 }, () => reserveLoginAttempt(new FakeAuthDb(shared), 1000)));
    expect(results.filter(r => r.ok)).toHaveLength(5);
    expect((await reserveLoginAttempt(new FakeAuthDb(shared), 60_999)).ok).toBe(false);
    expect((await reserveLoginAttempt(new FakeAuthDb(shared), 61_000)).ok).toBe(true);
  });
  it('fails closed when the shared budget cannot be read', async () => {
    const client = { query: async () => { throw new Error('offline'); }, mutation: async () => ({}) };
    expect((await authenticatePosStaff(client, { pin: '1234' })).status).toBe(503);
  });
  it('successful logins release their own reservations', async () => {
    const db = new FakeAuthDb();
    db.posStaffs.push(await staffRow(STAFF, 'Айжан', 'WAITER', '1234'));
    for (let i = 0; i < 7; i += 1) expect((await authenticatePosStaff(db, { pin: '1234' })).status).toBe(201);
  });
});
