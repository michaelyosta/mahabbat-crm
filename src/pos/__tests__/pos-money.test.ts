import { describe, expect, it } from 'vitest';

import {
  assertSafeMicros,
  isSafeMicros,
  lineAmountMicros,
  microsToCurrency,
  normalizeCurrency,
  requireKztCurrency,
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

  it('throws at the 9e15 safe-integer boundary instead of wrapping', () => {
    const near = 9_000_000_000_000_000;
    expect(() =>
      lineAmountMicros({ unitPrice: { amountMicros: near, currencyCode: 'KZT' }, quantity: 2 }),
    ).toThrow(/overflow/);
    expect(() =>
      sumActiveLinesMicros([
        { unitPrice: { amountMicros: near, currencyCode: 'KZT' }, quantity: 1, status: 'ACTIVE' },
        { unitPrice: { amountMicros: near, currencyCode: 'KZT' }, quantity: 1, status: 'ACTIVE' },
      ]),
    ).toThrow(/overflow/);
    // Just inside the boundary still computes.
    expect(
      lineAmountMicros({ unitPrice: { amountMicros: 4_500_000_000_000_000, currencyCode: 'KZT' }, quantity: 2 }),
    ).toBe(9_000_000_000_000_000);
  });
  it('clamps negative quantities to zero', () => {
    expect(
      lineAmountMicros({
        unitPrice: { amountMicros: 100, currencyCode: 'KZT' },
        quantity: -1,
      }),
    ).toBe(0);
  });

  it('rejects non-KZT currency and unsafe micros', () => {
    expect(() => requireKztCurrency({ amountMicros: 100, currencyCode: 'USD' })).toThrow(/KZT/);
    expect(() => assertSafeMicros(Number.MAX_SAFE_INTEGER + 1)).toThrow(/safe integer/);
    expect(isSafeMicros(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isSafeMicros(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
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