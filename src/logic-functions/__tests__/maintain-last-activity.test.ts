import { describe, expect, it } from 'vitest';

import { maintainLastActivity } from 'src/logic-functions/maintain-last-activity.logic-function';

type Person = { id: string; lastActivityAt?: string | null };

type FakeClient = {
  people: Person[] | null;
  queries: number;
  mutations: Array<{ id: string; data: { lastActivityAt: string } }>;
  query: (query: unknown) => Promise<unknown>;
  mutation: (query: unknown) => Promise<unknown>;
};

const makeClient = (contact: Person | null): FakeClient => {
  const client: FakeClient = {
    people: contact ? [contact] : null,
    queries: 0,
    mutations: [],
    query: async (query) => {
      client.queries += 1;
      if (!client.people) {
        return {
          people: { edges: [] },
        };
      }
      const args = (query as {
        people?: { __args?: { filter?: { id?: { eq?: string } } } };
      }).people?.__args;
      const requestedId = args?.filter?.id?.eq;
      if (requestedId !== undefined && client.people[0].id !== requestedId) {
        return {
          people: { edges: [] },
        };
      }
      return {
        people: {
          edges: [{ node: client.people[0] }],
        },
      };
    },
    mutation: async (query) => {
      const args = (query as { updatePerson?: { __args?: { id: string; data: { lastActivityAt: string } } } })
        .updatePerson?.__args;
      if (!args) return { updatePerson: { id: undefined } };
      client.mutations.push({ id: args.id, data: args.data });
      return { updatePerson: { id: args.id } };
    },
  };
  return client;
};

describe('maintainLastActivity', () => {
  it('does not write when the customer does not exist', async () => {
    const client = makeClient(null);
    const result = await maintainLastActivity(
      client,
      'missing-customer',
      '2026-08-10T10:00:00.000Z',
    );

    expect(result).toEqual({ updated: false, lastActivityAt: null });
    expect(client.mutations).toHaveLength(0);
  });

  it('writes the activity timestamp when a customer has none', async () => {
    const client = makeClient({ id: 'customer-1', lastActivityAt: null });
    const result = await maintainLastActivity(
      client,
      'customer-1',
      '2026-08-10T10:00:00.000Z',
    );

    expect(result).toEqual({
      updated: true,
      lastActivityAt: '2026-08-10T10:00:00.000Z',
    });
    expect(client.mutations).toEqual([
      {
        id: 'customer-1',
        data: { lastActivityAt: '2026-08-10T10:00:00.000Z' },
      },
    ]);
  });

  it('does not regress an existing activity timestamp', async () => {
    const client = makeClient({
      id: 'customer-1',
      lastActivityAt: '2026-08-10T10:00:00.000Z',
    });
    const result = await maintainLastActivity(
      client,
      'customer-1',
      '2026-08-01T10:00:00.000Z',
    );

    expect(result).toEqual({
      updated: false,
      lastActivityAt: '2026-08-10T10:00:00.000Z',
    });
    expect(client.mutations).toHaveLength(0);
  });

  it('advances when the activity timestamp is strictly later', async () => {
    const client = makeClient({
      id: 'customer-1',
      lastActivityAt: '2026-08-10T10:00:00.000Z',
    });
    const result = await maintainLastActivity(
      client,
      'customer-1',
      '2026-08-12T10:00:00.000Z',
    );

    expect(result).toEqual({
      updated: true,
      lastActivityAt: '2026-08-12T10:00:00.000Z',
    });
    expect(client.mutations).toEqual([
      {
        id: 'customer-1',
        data: { lastActivityAt: '2026-08-12T10:00:00.000Z' },
      },
    ]);
  });

  it('does not write on an equal timestamp', async () => {
    const client = makeClient({
      id: 'customer-1',
      lastActivityAt: '2026-08-10T10:00:00.000Z',
    });
    const result = await maintainLastActivity(
      client,
      'customer-1',
      '2026-08-10T10:00:00.000Z',
    );

    expect(result).toEqual({
      updated: false,
      lastActivityAt: '2026-08-10T10:00:00.000Z',
    });
    expect(client.mutations).toHaveLength(0);
  });

  it('repairs an invalid stored timestamp with a valid candidate', async () => {
    const client = makeClient({ id: 'customer-1', lastActivityAt: 'garbage' });
    const result = await maintainLastActivity(
      client,
      'customer-1',
      '2026-08-10T10:00:00.000Z',
    );

    expect(result).toEqual({
      updated: true,
      lastActivityAt: '2026-08-10T10:00:00.000Z',
    });
    expect(client.mutations).toEqual([
      {
        id: 'customer-1',
        data: { lastActivityAt: '2026-08-10T10:00:00.000Z' },
      },
    ]);
  });

  it('does not clamp a null customer id', async () => {
    const client = makeClient({ id: 'customer-1', lastActivityAt: null });

    await expect(
      maintainLastActivity(client, '', '2026-08-10T10:00:00.000Z'),
    ).resolves.toEqual({ updated: false, lastActivityAt: null });
    expect(client.queries).toBe(1);
  });
});