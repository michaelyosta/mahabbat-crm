import { describe, expect, it } from 'vitest';
import {
  aggregatePrintStatus,
  executeRetryPrintJob,
  markGatewayRestartUnknown,
  type PrintJobRecord,
} from 'src/printing/print-queue';
import { compareClaimPriority } from 'src/printing/print-gateway.resolver.logic-function';
const jobs = (...statuses: string[]): PrintJobRecord[] =>
  statuses.map((status, index) => ({ id: `job-${index}`, status }));
type MemoryMutation = { updatePosPrintJob?: { __args: { id?: string; data?: Record<string, unknown> } } };
const memoryClient = (records: PrintJobRecord[]) => {
  const store = new Map(records.map((job) => [job.id, { ...job }]));
  const calls: Array<{ id: string; data: Record<string, unknown> }> = [];
  return {
    calls,
    client: {
      query: async (query: unknown) => {
        if (!query || typeof query !== 'object' || !('posPrintJobs' in query)) return {};
        const root = (query as { posPrintJobs?: { __args?: { filter?: Record<string, { eq?: unknown }> } } }).posPrintJobs;
        const filter = root?.__args?.filter ?? {};
        const rows = [...store.values()].filter((node) =>
          Object.entries(filter).every(([field, condition]) => {
            if (!condition || typeof condition !== 'object' || !('eq' in condition)) return true;
            return (node as Record<string, unknown>)[field] === (condition as { eq?: unknown }).eq;
          }),
        );
        return { posPrintJobs: { edges: rows.map((node) => ({ node })), pageInfo: { hasNextPage: false, endCursor: null } } };
      },
      mutation: async (mutation: unknown) => {
        if (!mutation || typeof mutation !== 'object' || !('updatePosPrintJob' in mutation)) return { updatePosPrintJob: null };
        const entry = (mutation as MemoryMutation).updatePosPrintJob;
        const args = entry?.__args;
        if (!args?.id) return { updatePosPrintJob: null };
        calls.push({ id: args.id, data: { ...(args.data ?? {}) } });
        const current = store.get(args.id);
        if (!current) return { updatePosPrintJob: null };
        const next = { ...current, ...(args.data ?? {}) };
        store.set(args.id, next);
        return { updatePosPrintJob: next };
      },
    },
  };
};

describe('durable print job status aggregation', () => {
  it('prioritizes unknown outcomes over failed and queued jobs', () => {
    expect(aggregatePrintStatus(jobs('SENT', 'FAILED', 'OUTCOME_UNKNOWN'))).toBe('OUTCOME_UNKNOWN');
    expect(aggregatePrintStatus(jobs('SENT', 'FAILED', 'QUEUED'))).toBe('FAILED');
    expect(aggregatePrintStatus(jobs('SENT', 'QUEUED'))).toBe('QUEUED');
  });

  it('folds unreachable confirmed rows into sent', () => {
    expect(aggregatePrintStatus(jobs('CONFIRMED', 'CONFIRMED'))).toBe('SENT');
    expect(aggregatePrintStatus(jobs('CONFIRMED', 'SENT'))).toBe('SENT');
    expect(aggregatePrintStatus([])).toBeNull();
  });
});

describe('spooler crash recovery', () => {
  it('returns a never-sent job to QUEUED with attemptCount+1', async () => {
    const { client, calls } = memoryClient([{ id: 'job-1', status: 'DISPATCHING', claimedAt: '2026-01-01T00:00:00.000Z', attemptCount: 1 }]);
    const updated = await markGatewayRestartUnknown(client as Parameters<typeof markGatewayRestartUnknown>[0], 60_000, Date.parse('2026-01-01T00:05:00.000Z'));
    expect(updated[0]?.status).toBe('QUEUED');
    expect(calls[0]?.data).toMatchObject({ status: 'QUEUED', attemptCount: 2, claimToken: null });
  });

  it('keeps a possibly-sent job OUTCOME_UNKNOWN', async () => {
    const { client } = memoryClient([{ id: 'job-2', status: 'DISPATCHING', claimedAt: '2026-01-01T00:00:00.000Z', sentAt: '2026-01-01T00:00:30.000Z', lastErrorCode: 'WINDOWS_SPOOLER_PARTIAL_WRITE', attemptCount: 1 }]);
    const updated = await markGatewayRestartUnknown(client as Parameters<typeof markGatewayRestartUnknown>[0], 60_000, Date.parse('2026-01-01T00:05:00.000Z'));
    expect(updated[0]?.status).toBe('OUTCOME_UNKNOWN');
  });

  it('blocks a blind reprint of an UNKNOWN job without the printer name', async () => {
    const { client } = memoryClient([{ id: 'job-3', status: 'OUTCOME_UNKNOWN', payloadSnapshot: '{}' }]);
    const retryClient = client as Parameters<typeof executeRetryPrintJob>[0];
    const blocked = await executeRetryPrintJob(retryClient, { printJobId: 'job-3', idempotencyKey: 'key-1' }, 'staff-1');
    expect(blocked.status).toBe(409);
    const blockedCode = blocked.body && typeof blocked.body === 'object' && 'code' in blocked.body ? (blocked.body as { code?: unknown }).code : undefined;
    expect(blockedCode).toBe('UNKNOWN_REPRINT_NOT_CONFIRMED');
    // Empty snapshot: the guard passes with a printer name, then the payload
    // check rejects — proving the blind-reprint gate no longer short-circuits.
    const confirmed = await executeRetryPrintJob(retryClient, { printJobId: 'job-3', idempotencyKey: 'key-1', confirmedPrinterName: 'Кухня' }, 'staff-1');
    expect(confirmed.status).toBe(400);
    const confirmedCode = confirmed.body && typeof confirmed.body === 'object' && 'code' in confirmed.body ? (confirmed.body as { code?: unknown }).code : undefined;
    expect(confirmedCode).toBe('PRINT_PAYLOAD_INVALID');
  });
});
describe('claim priority', () => {
  const job = (overrides: Partial<PrintJobRecord>): PrintJobRecord => ({ id: 'job', ...overrides });

  it('orders queued jobs by createdAt then id', () => {
    const rows = [
      job({ id: 'b', createdAt: '2026-09-13T00:00:02.000Z' }),
      job({ id: 'a', createdAt: '2026-09-13T00:00:01.000Z' }),
      job({ id: 'c', createdAt: '2026-09-13T00:00:01.000Z' }),
    ];
    expect([...rows].sort(compareClaimPriority).map((row) => row.id)).toEqual(['a', 'c', 'b']);
  });

  it('claims CANCELLATION documents before NEW_ITEMS of the same ticket time', () => {
    const rows = [
      job({ id: 'new', documentType: 'KITCHEN_NEW', createdAt: '2026-09-13T00:00:01.000Z' }),
      job({ id: 'cancel', documentType: 'KITCHEN_CANCEL', createdAt: '2026-09-13T00:00:02.000Z' }),
    ];
    expect([...rows].sort(compareClaimPriority).map((row) => row.id)).toEqual(['cancel', 'new']);
  });
});
