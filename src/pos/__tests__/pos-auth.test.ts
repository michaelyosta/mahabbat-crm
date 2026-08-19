import { beforeEach, describe, expect, it } from 'vitest';

import {
  authenticatePosStaff,
  getAuthenticatedPosContext,
  hashPosPin,
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
  private sequence = 1;

  async query(document: unknown): Promise<unknown> {
    const root = Object.keys(document as Record<string, unknown>)[0];
    const operation = (document as Record<string, Record<string, unknown>>)[root];
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
  role: 'WAITER' | 'ADMIN',
  pin: string,
  extra: Record<string, unknown> = {},
): Promise<Row> => ({
  id,
  displayName,
  role,
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
});
