import { describe, expect, it } from 'vitest';

import { aggregatePrintStatus, type PrintJobRecord } from 'src/printing/print-queue';

const jobs = (...statuses: string[]): PrintJobRecord[] =>
  statuses.map((status, index) => ({ id: `job-${index}`, status }));

describe('durable print job status aggregation', () => {
  it('prioritizes unknown outcomes over failed and queued jobs', () => {
    expect(aggregatePrintStatus(jobs('SENT', 'FAILED', 'OUTCOME_UNKNOWN'))).toBe('OUTCOME_UNKNOWN');
    expect(aggregatePrintStatus(jobs('SENT', 'FAILED', 'QUEUED'))).toBe('FAILED');
    expect(aggregatePrintStatus(jobs('SENT', 'QUEUED'))).toBe('QUEUED');
  });

  it('only reports confirmed when every delivery is confirmed', () => {
    expect(aggregatePrintStatus(jobs('CONFIRMED', 'CONFIRMED'))).toBe('CONFIRMED');
    expect(aggregatePrintStatus(jobs('CONFIRMED', 'SENT'))).toBe('SENT');
    expect(aggregatePrintStatus([])).toBeNull();
  });
});
