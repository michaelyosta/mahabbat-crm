import { describe, expect, it } from 'vitest';

import { processLoyaltyAdjustmentRequest, type CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';

type LedgerRecord = {
  id: string;
  sourceRequestId?: string | null;
  customerId?: string | null;
  amount?: number | null;
  reason?: string | null;
  idempotencyKey?: string | null;
  occurredAt?: string | null;
  entryType?: string | null;
  actorSource?: string | null;
  source?: string | null;
};

type RequestRecord = {
  id: string;
  customerId?: string | null;
  amount?: number | null;
  reason?: string | null;
  idempotencyKey?: string | null;
  status?: string | null;
  processedAt?: string | null;
  error?: string | null;
};

type NodeRecord = Record<string, unknown> & { id: string };

const CUSTOMER_ID = 'c3f7a2b1-0000-4000-8000-000000000001';
const REQUEST_ID = 'e1f7a2b1-0000-4000-8000-000000000001';
const IDEMPOTENCY_KEY = 'd4f7a2b1-0000-4000-8000-000000000002';

const pendingRequest = (overrides: Partial<RequestRecord> = {}): RequestRecord => ({
  id: REQUEST_ID,
  customerId: CUSTOMER_ID,
  amount: 500,
  reason: 'Бонус за отзыв',
  idempotencyKey: IDEMPOTENCY_KEY,
  status: 'PENDING',
  processedAt: null,
  error: null,
  ...overrides,
});

class FakeCoreClient {
  people: Map<string, NodeRecord>;
  ledger: Map<string, LedgerRecord>;
  requests: Map<string, RequestRecord>;
  createAttempts = 0;
  transientFilterFailure = false;
  createdIds: string[] = [];

  constructor() {
    this.people = new Map([[CUSTOMER_ID, { id: CUSTOMER_ID }]]);
    this.ledger = new Map();
    this.requests = new Map();
  }

  query = async (selection: Record<string, { __args?: Record<string, unknown> }>): Promise<Record<string, unknown>> => {
    const rootKey = Object.keys(selection)[0];
    const __args = selection[rootKey].__args ?? {};
    const filter = (__args.filter ?? {}) as Record<string, { eq?: unknown; in?: unknown[] }>;
    const after = __args.after as string | undefined;

    if (rootKey === 'loyaltyLedgerEntries') {
      return { [rootKey]: this.filterLedger(filter, after) };
    }
    if (rootKey === 'loyaltyAdjustmentRequests') {
      return { [rootKey]: this.filterRequests(filter, after) };
    }
    if (rootKey === 'people') {
      const edges = [...this.people.values()]
        .filter((node) => (filter.id?.eq ?? null) === null || node.id === filter.id?.eq)
        .slice(0, Number(__args.first) ?? 1)
        .map((node) => ({ node }));
      return { [rootKey]: { edges } };
    }
    return { [rootKey]: null };
  };

  mutation = async (selection: Record<string, { __args?: { data?: Record<string, unknown>; id?: string } }>): Promise<Record<string, unknown>> => {
    const rootKey = Object.keys(selection)[0];
    const __args = selection[rootKey].__args ?? {};
    const data = (__args.data ?? {}) as Record<string, unknown>;

    if (rootKey === 'createLoyaltyLedgerEntry') {
      this.createAttempts += 1;
      this.enforceLedgerConstraints(data);
      const record: LedgerRecord = { id: `ledger-${this.createAttempts}`, ...data };
      this.ledger.set(record.id, record);
      this.createdIds.push(record.id);
      return { [rootKey]: { id: record.id } };
    }

    if (rootKey === 'updateLoyaltyAdjustmentRequest') {
      const existing = this.requests.get(String(__args.id));
      if (existing) {
        this.requests.set(String(__args.id), { ...existing, ...(data as Partial<RequestRecord>) });
      }
      return { [rootKey]: { id: __args.id } };
    }

    return { [rootKey]: null };
  };

  private enforceLedgerConstraints(data: Record<string, unknown>) {
    const sourceRequestId = data.sourceRequestId as string | undefined;
    const idempotencyKey = data.idempotencyKey as string | undefined;

    const ownedBySourceRequest = [...this.ledger.values()].find(
      (entry) => sourceRequestId && entry.sourceRequestId === sourceRequestId,
    );

    if (ownedBySourceRequest) {
      throw new Error('duplicate key value violates unique constraint "sourceRequestId"');
    }

    const ownedByIdempotencyKey = [...this.ledger.values()].find(
      (entry) => idempotencyKey && entry.idempotencyKey === idempotencyKey,
    );

    if (ownedByIdempotencyKey) {
      throw new Error('duplicate key value violates unique constraint "idempotencyKey"');
    }
  }

  private filterLedger(filter: Record<string, { eq?: unknown }>, after?: string): unknown {
    const nodes = [...this.ledger.values()]
      .filter((node) => this.matchesFilter(node, filter))
      .sort((a, b) => a.id.localeCompare(b.id));

    const { page, hasNextPage, endCursor } = this.paginate(nodes, after);
    return {
      edges: page.map((node) => ({ node })),
      pageInfo: { hasNextPage, endCursor },
    };
  }

  private filterRequests(filter: Record<string, { eq?: unknown }>, after?: string): unknown {
    if (this.transientFilterFailure && filter.id?.eq) {
      const nodes = [...this.requests.values()]
        .sort((a, b) => a.id.localeCompare(b.id));
      const { page, hasNextPage, endCursor } = this.paginate(nodes, after);
      return {
        edges: page.map((node) => ({ node })),
        pageInfo: { hasNextPage, endCursor },
      };
    }

    const nodes = [...this.requests.values()]
      .filter((node) => this.matchesFilter(node, filter))
      .sort((a, b) => a.id.localeCompare(b.id));

    const { page, hasNextPage, endCursor } = this.paginate(nodes, after);
    return {
      edges: page.map((node) => ({ node })),
      pageInfo: { hasNextPage, endCursor },
    };
  }

  private paginate(nodes: NodeRecord[], after?: string) {
    const pageSize = 100;
    const startIndex = after ? nodes.findIndex((node) => node.id === after) + 1 : 0;
    const page = nodes.slice(startIndex, startIndex + pageSize);
    const hasNextPage = startIndex + pageSize < nodes.length;
    const endCursor = page.length > 0 ? page[page.length - 1].id : null;
    return { page, hasNextPage, endCursor };
  }

  private matchesFilter(node: NodeRecord, filter: Record<string, { eq?: unknown }>) {
    return Object.entries(filter).every(([field, condition]) => {
      if (condition.eq === undefined) return true;
      return node[field] === condition.eq;
    });
  }
}

describe('processLoyaltyAdjustmentRequest', () => {
  describe('happy path', () => {
    it('creates one server-owned ledger entry and marks the request APPLIED', async () => {
      const client = new FakeCoreClient();
      client.requests.set(REQUEST_ID, pendingRequest());

      await processLoyaltyAdjustmentRequest(client as unknown as CoreApiClientLike, REQUEST_ID);

      expect(client.ledger.size).toBe(1);
      const entry = [...client.ledger.values()][0];
      expect(entry).toMatchObject({
        customerId: CUSTOMER_ID,
        sourceRequestId: REQUEST_ID,
        entryType: 'ADJUSTMENT',
        amount: 500,
        reason: 'Бонус за отзыв',
        source: 'MANUAL',
        idempotencyKey: IDEMPOTENCY_KEY,
      });
      expect(entry.occurredAt).toBeTruthy();
      expect(entry.actorSource).toBeTruthy();

      expect(client.requests.get(REQUEST_ID)).toMatchObject({
        status: 'APPLIED',
        error: null,
      });
      expect(client.requests.get(REQUEST_ID)?.processedAt).toBeTruthy();
    });
  });

  describe('retry and exactly-once', () => {
    it('does not create a second entry when the same request is processed again', async () => {
      const client = new FakeCoreClient();
      client.requests.set(REQUEST_ID, pendingRequest());

      await processLoyaltyAdjustmentRequest(client as unknown as CoreApiClientLike, REQUEST_ID);
      await processLoyaltyAdjustmentRequest(client as unknown as CoreApiClientLike, REQUEST_ID);

      expect(client.ledger.size).toBe(1);
      expect(client.createAttempts).toBe(1);
      expect([...client.ledger.values()][0].sourceRequestId).toBe(REQUEST_ID);
    });

    it('reconciles a PENDING snapshot instead of creating a second entry after a crash', async () => {
      const client = new FakeCoreClient();
      const appliedLedger: LedgerRecord = {
        id: 'ledger-existing',
        sourceRequestId: REQUEST_ID,
        customerId: CUSTOMER_ID,
        amount: 500,
        reason: 'Бонус за отзыв',
        idempotencyKey: IDEMPOTENCY_KEY,
        occurredAt: '2026-08-10T10:00:00.000Z',
        entryType: 'ADJUSTMENT',
        actorSource: 'workspace:app',
        source: 'MANUAL',
      };
      client.ledger.set('ledger-existing', appliedLedger);

      // The request was left PENDING by the crash; the ledger is the truth.
      client.requests.set(REQUEST_ID, pendingRequest());

      await processLoyaltyAdjustmentRequest(client as unknown as CoreApiClientLike, REQUEST_ID);

      expect(client.ledger.size).toBe(1);
      expect(client.createAttempts).toBe(0);
      expect(client.requests.get(REQUEST_ID)).toMatchObject({
        status: 'APPLIED',
        customerId: CUSTOMER_ID,
        amount: 500,
        idempotencyKey: IDEMPOTENCY_KEY,
        error: null,
      });
      expect(client.requests.get(REQUEST_ID)?.processedAt).toBe(
        appliedLedger.occurredAt,
      );
    });

    it('repairs a tampered APPLIED request from the ledger snapshot', async () => {
      const client = new FakeCoreClient();
      client.ledger.set('ledger-existing', {
        id: 'ledger-existing',
        sourceRequestId: REQUEST_ID,
        customerId: CUSTOMER_ID,
        amount: 500,
        reason: 'Бонус за отзыв',
        idempotencyKey: IDEMPOTENCY_KEY,
        occurredAt: '2026-08-10T10:00:00.000Z',
        entryType: 'ADJUSTMENT',
        actorSource: 'workspace:app',
        source: 'MANUAL',
      });
      // Someone rewrote the applied projection.
      client.requests.set(REQUEST_ID, pendingRequest({ amount: 999, status: 'APPLIED' }));

      await processLoyaltyAdjustmentRequest(client as unknown as CoreApiClientLike, REQUEST_ID);

      expect(client.ledger.size).toBe(1);
      expect(client.requests.get(REQUEST_ID)).toMatchObject({
        status: 'APPLIED',
        amount: 500,
        error: null,
      });
    });
  });

  describe('concurrency', () => {
    it('converges two parallel creates into exactly one ledger entry', async () => {
      const client = new FakeCoreClient();
      client.requests.set(REQUEST_ID, pendingRequest());

      await Promise.all([
        processLoyaltyAdjustmentRequest(client as unknown as CoreApiClientLike, REQUEST_ID),
        processLoyaltyAdjustmentRequest(client as unknown as CoreApiClientLike, REQUEST_ID),
      ]);

      expect(client.ledger.size).toBe(1);
      expect([...client.ledger.values()][0].sourceRequestId).toBe(REQUEST_ID);
      expect(client.requests.get(REQUEST_ID)?.status).toBe('APPLIED');
    });

    it('rejects a foreign idempotency key race instead of copying foreign history', async () => {
      const client = new FakeCoreClient();
      client.ledger.set('ledger-foreign', {
        id: 'ledger-foreign',
        sourceRequestId: 'another-request',
        customerId: CUSTOMER_ID,
        amount: 777,
        reason: 'Чужой кей',
        idempotencyKey: IDEMPOTENCY_KEY,
        occurredAt: '2026-08-10T10:00:00.000Z',
        entryType: 'ADJUSTMENT',
        actorSource: 'workspace:app',
        source: 'MANUAL',
      });
      client.requests.set(REQUEST_ID, pendingRequest());

      await processLoyaltyAdjustmentRequest(client as unknown as CoreApiClientLike, REQUEST_ID);

      expect(client.ledger.size).toBe(1);
      expect(client.requests.get(REQUEST_ID)).toMatchObject({
        status: 'REJECTED',
      });
      expect(client.requests.get(REQUEST_ID)?.error).toContain('idempotency');
    });
  });

  describe('validation', () => {
    it('rejects an invalid body without creating a ledger entry', async () => {
      const client = new FakeCoreClient();
      client.requests.set(REQUEST_ID, pendingRequest({ amount: 0 }));

      await processLoyaltyAdjustmentRequest(client as unknown as CoreApiClientLike, REQUEST_ID);

      expect(client.ledger.size).toBe(0);
      expect(client.requests.get(REQUEST_ID)?.status).toBe('REJECTED');
    });

    it('rejects a missing customer without creating a ledger entry', async () => {
      const client = new FakeCoreClient();
      client.people.delete(CUSTOMER_ID);
      client.requests.set(REQUEST_ID, pendingRequest());

      await processLoyaltyAdjustmentRequest(client as unknown as CoreApiClientLike, REQUEST_ID);

      expect(client.ledger.size).toBe(0);
      expect(client.requests.get(REQUEST_ID)).toMatchObject({
        status: 'REJECTED',
      });
    });

    it('does nothing for a missing request', async () => {
      const client = new FakeCoreClient();

      await processLoyaltyAdjustmentRequest(client as unknown as CoreApiClientLike, REQUEST_ID);

      expect(client.ledger.size).toBe(0);
      expect(client.createAttempts).toBe(0);
    });

    it('does nothing for a terminal REJECTED request', async () => {
      const client = new FakeCoreClient();
      client.requests.set(REQUEST_ID, pendingRequest({ status: 'REJECTED' }));

      await processLoyaltyAdjustmentRequest(client as unknown as CoreApiClientLike, REQUEST_ID);

      expect(client.ledger.size).toBe(0);
      expect(client.createAttempts).toBe(0);
    });
  });

  describe('recovery cursor fallback', () => {
    it('finds a request beyond the first cursor page when the id filter is inconsistent', async () => {
      const client = new FakeCoreClient();
      for (let index = 0; index < 150; index += 1) {
        client.requests.set(`request-${index}`, pendingRequest({ id: `request-${index}` }));
      }
      // Simulate the transient filter/index inconsistency the fallback guards against.
      client.transientFilterFailure = true;
      const target = client.requests.get('request-147');
      expect(target).toBeTruthy();

      await processLoyaltyAdjustmentRequest(client as unknown as CoreApiClientLike, 'request-147');

      expect(client.ledger.size).toBe(1);
      expect([...client.ledger.values()][0].sourceRequestId).toBe('request-147');
      expect(client.requests.get('request-147')?.status).toBe('APPLIED');
    });
  });
});
