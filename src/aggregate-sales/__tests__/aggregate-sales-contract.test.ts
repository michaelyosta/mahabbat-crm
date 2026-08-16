import { describe, expect, it } from 'vitest';

import {
  buildAggregateLineIdentityKey,
  decimalTengeToMoney,
  importAggregateSalesLines,
  normalizeAggregateSalesLine,
  normalizeDecimalString,
  normalizeItemKey,
  toSalesSnapshotLinePayload,
  type AggregateSalesLineRepository,
  type NormalizedAggregateSalesLine,
  type AggregateSalesLineRecord,
} from '../aggregate-sales-contract';

const line = (overrides: Partial<Parameters<typeof normalizeAggregateSalesLine>[0]> = {}) => ({
  provider: ' pos ',
  sourceReportId: 'APRIL-2026-BAR',
  periodStart: '2026-04-01',
  periodEnd: '2026-04-30',
  warehouse: ' Bar ',
  sourceRowNumber: 5,
  rawItemName: '  Flatbread   1 pc ',
  quantity: '1715',
  revenue: '560520',
  ...overrides,
});

describe('aggregate sales contract', () => {
  it('preserves the source item name while deriving a safe comparison key', () => {
    const normalized = normalizeAggregateSalesLine(line());
    expect(normalized.provider).toBe('POS');
    expect(normalized.rawItemName).toBe('  Flatbread   1 pc ');
    expect(normalized.normalizedItemKey).toBe(normalizeItemKey('Flatbread 1 pc'));
    expect(buildAggregateLineIdentityKey(line({ rawItemName: 'Flatbread 1 pc' }))).toBe(normalized.externalIdentityKey);
    expect(buildAggregateLineIdentityKey(line({ rawItemName: 'Flatbread 2 pc' }))).not.toBe(normalized.externalIdentityKey);
  });

  it('preserves decimal quantity and zero revenue', () => {
    const normalized = normalizeAggregateSalesLine(line({ quantity: '24.25', revenue: '0' }));
    expect(normalized.quantity).toBe('24.25');
    expect(normalized.revenue).toBe('0');
  });

  it('rejects malformed identity and decimal input', () => {
    expect(() => normalizeAggregateSalesLine(line({ rawItemName: '   ' }))).toThrow();
    expect(() => normalizeAggregateSalesLine(line({ quantity: '1,25' }))).toThrow();
    expect(() => normalizeDecimalString('01.2.3', 'quantity')).toThrow();
  });

  it('converts decimal tenge to exact KZT micros', () => {
    expect(decimalTengeToMoney('24.25')).toEqual({ amountMicros: '24250000', currencyCode: 'KZT' });
    expect(decimalTengeToMoney('0')).toEqual({ amountMicros: '0', currencyCode: 'KZT' });
    expect(decimalTengeToMoney('-1.5')).toEqual({ amountMicros: '-1500000', currencyCode: 'KZT' });
  });

  it('maps source decimals and money to the Twenty transport shape', () => {
    const payload = toSalesSnapshotLinePayload(normalizeAggregateSalesLine(line({ quantity: '24.25', revenue: '3000.50' })));
    expect(payload.quantity).toBe(24.25);
    expect(payload.revenue).toEqual({ amountMicros: '3000500000', currencyCode: 'KZT' });
    expect(payload.matchStatus).toBe('UNMATCHED');
  });

  it('is retry-safe and updates source-owned metrics without overwriting raw names', async () => {
    const records = new Map<string, AggregateSalesLineRecord>();
    const repository: AggregateSalesLineRepository = {
      findByExternalIdentityKey: async (key: string) => records.get(key) ?? null,
      create: async (value: NormalizedAggregateSalesLine) => {
        const record: AggregateSalesLineRecord = { ...value, id: `id-${records.size + 1}` };
        records.set(record.externalIdentityKey, record);
        return record;
      },
      update: async (id: string, patch: Partial<NormalizedAggregateSalesLine>) => {
        const record = [...records.values()].find((candidate) => candidate.id === id)!;
        const updated = { ...record, ...patch };
        records.set(updated.externalIdentityKey, updated);
        return updated;
      },
    };

    const first = await importAggregateSalesLines([line()], repository);
    const second = await importAggregateSalesLines([line()], repository);
    const changed = await importAggregateSalesLines([line({ quantity: '1800' })], repository);

    expect(first.created).toBe(1);
    expect(second.skipped).toBe(1);
    expect(changed.updated).toBe(1);
    expect(records.size).toBe(1);
    expect([...records.values()][0].rawItemName).toBe('  Flatbread   1 pc ');
    expect([...records.values()][0].quantity).toBe('1800');
  });
});
