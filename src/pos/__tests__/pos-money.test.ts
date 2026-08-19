import { describe, expect, it } from 'vitest';

import {
  lineAmountMicros,
  microsToCurrency,
  normalizeCurrency,
  sumActiveLinesMicros,
  zeroCurrency,
} from 'src/pos/pos-money';

describe('pos-money', () => {
  it('normalizes object currency values', () => {
    expect(normalizeCurrency({ amountMicros: 42, currencyCode: 'KZT' })).toEqual({
      amountMicros: 42,
      currencyCode: 'KZT',
    });
  });

  it('normalizes plain integer micros values with KZT default', () => {
    expect(normalizeCurrency(42)).toEqual({ amountMicros: 42, currencyCode: 'KZT' });
  });

  it('falls back to zero currency for malformed values', () => {
    expect(normalizeCurrency(null)).toEqual(zeroCurrency());
    expect(normalizeCurrency('nope')).toEqual(zeroCurrency());
    expect(normalizeCurrency({ amountMicros: 'x' })).toEqual(zeroCurrency());
  });

  it('computes per-line amounts in micros', () => {
    expect(
      lineAmountMicros({
        unitPrice: { amountMicros: 1_500_000_000, currencyCode: 'KZT' },
        quantity: 2,
      }),
    ).toBe(3_000_000_000);
  });

  it('clamps negative quantities to zero', () => {
    expect(
      lineAmountMicros({
        unitPrice: { amountMicros: 100, currencyCode: 'KZT' },
        quantity: -1,
      }),
    ).toBe(0);
  });

  it('sums only active lines', () => {
    const total = sumActiveLinesMicros([
      { unitPrice: { amountMicros: 100, currencyCode: 'KZT' }, quantity: 2, status: 'ACTIVE' },
      { unitPrice: { amountMicros: 50, currencyCode: 'KZT' }, quantity: 3, status: 'VOIDED' },
      { unitPrice: { amountMicros: 10, currencyCode: 'KZT' }, quantity: 1, status: null },
    ]);

    expect(total).toBe(210);
  });

  it('builds currency objects from micros', () => {
    expect(microsToCurrency(1)).toEqual({ amountMicros: 1, currencyCode: 'KZT' });
  });
});