import { describe, expect, it } from 'vitest';

import { maintainLastActivity } from 'src/logic-functions/maintain-last-activity.logic-function';

type PersonStore = { lastActivityAt: string | null } | null;

type GuardMutationArgs = {
  updatePeople?: {
    __args?: {
      filter?: {
        id?: { eq?: string };
        lastActivityAt?: Record<string, unknown>;
      };
      data?: { lastActivityAt?: string };
    };
  };
};

// Models the server-side guarded conditional update: filter evaluation and the
// value set happen in one synchronous slice (single SQL UPDATE), which is why a
// concurrent older candidate can never overwrite a newer stored value.
const makeClient = (customerId: string, store: PersonStore) => {
  const client = {
    customerId,
    store,
    operations: 0,
    writes: 0,
    mutation: async (mutation: unknown): Promise<unknown> => {
      client.operations += 1;
      const args = (mutation as GuardMutationArgs).updatePeople?.__args;
      if (!args) return { updatePeople: [] };

      const filter = args.filter ?? {};
      const idEq = filter.id?.eq;
      const isNull = filter.lastActivityAt?.is as 'NULL' | undefined;
      const lt = filter.lastActivityAt?.lt as string | undefined;
      const candidate = args.data?.lastActivityAt;

      if (client.store === null) return { updatePeople: [] };
      if (idEq !== undefined && client.customerId !== idEq) {
        return { updatePeople: [] };
      }

      let match = false;
      if (isNull === 'NULL') {
        match = client.store.lastActivityAt === null;
      } else if (typeof lt === 'string') {
        const current = client.store.lastActivityAt;
        match = current !== null && Date.parse(current) < Date.parse(lt);
      }

      if (!match) return { updatePeople: [] };

      client.writes += 1;
      client.store.lastActivityAt = candidate ?? null;
      return { updatePeople: [{ id: client.customerId }] };
    },
  };
  return client;
};

const T = (day: number) =>
  new Date(Date.UTC(2026, 7, day, 10, 0, 0)).toISOString();

describe('maintainLastActivity (guarded conditional update)', () => {
  it('writes the candidate when the stored value is NULL', async () => {
    const client = makeClient('customer-1', { lastActivityAt: null });
    const result = await maintainLastActivity(client, 'customer-1', T(10));

    expect(result).toEqual({ updated: true, lastActivityAt: T(10) });
    expect(client.store?.lastActivityAt).toBe(T(10));
    expect(client.writes).toBe(1);
  });

  it('does not write when the customer does not exist', async () => {
    const client = makeClient('customer-1', null);
    const result = await maintainLastActivity(client, 'customer-1', T(10));

    expect(result).toEqual({ updated: false, lastActivityAt: null });
    expect(client.writes).toBe(0);
  });

  it('never regresses an existing stored value with an earlier candidate', async () => {
    const client = makeClient('customer-1', { lastActivityAt: T(10) });
    const result = await maintainLastActivity(client, 'customer-1', T(1));

    expect(result).toEqual({ updated: false, lastActivityAt: null });
    expect(client.store?.lastActivityAt).toBe(T(10));
    expect(client.writes).toBe(0);
  });

  it('advances when the candidate is strictly later', async () => {
    const client = makeClient('customer-1', { lastActivityAt: T(10) });
    const result = await maintainLastActivity(client, 'customer-1', T(12));

    expect(result).toEqual({ updated: true, lastActivityAt: T(12) });
    expect(client.store?.lastActivityAt).toBe(T(12));
  });

  it('does not write on an equal candidate', async () => {
    const client = makeClient('customer-1', { lastActivityAt: T(10) });
    const result = await maintainLastActivity(client, 'customer-1', T(10));

    expect(result).toEqual({ updated: false, lastActivityAt: null });
    expect(client.store?.lastActivityAt).toBe(T(10));
    expect(client.writes).toBe(0);
  });

  it('never mutates on an invalid candidate', async () => {
    const client = makeClient('customer-1', { lastActivityAt: T(10) });
    const result = await maintainLastActivity(client, 'customer-1', 'garbage');

    expect(result).toEqual({ updated: false, lastActivityAt: null });
    expect(client.operations).toBe(0);
  });

  it('concurrent events converge to the max candidate (no lost update)', async () => {
    const client = makeClient('customer-1', { lastActivityAt: T(1) });
    const candidates = Array.from({ length: 12 }, (_, i) => T(i + 2));

    await Promise.all(
      candidates.map((candidate) => maintainLastActivity(client, 'customer-1', candidate)),
    );

    expect(client.store?.lastActivityAt).toBe(T(13));
  });

  it('older concurrent events cannot beat a newer stored value', async () => {
    const client = makeClient('customer-1', { lastActivityAt: T(7) });
    const candidates = [T(3), T(4), T(5), T(6), T(7), T(8), T(9)];

    await Promise.all(
      candidates.map((candidate) => maintainLastActivity(client, 'customer-1', candidate)),
    );

    expect(client.store?.lastActivityAt).toBe(T(9));
  });
});