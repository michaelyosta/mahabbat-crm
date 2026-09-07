import { describe, expect, it } from 'vitest';
import { ReceiptRetry } from 'src/inventory/receipt-retry';

describe('receipt retry after an unknown outcome', () => {
  it('reuses the original payload/key after a reload and allocates a new key only after success', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    const draft = { locationId: 'loc', lines: [{ stockItemId: 'item', quantityMicros: 1000, unitCostMicros: 1000 }], comment: '' };
    const first = new ReceiptRetry(storage).begin('admin', draft, [], () => 'first-key');
    const reloaded = new ReceiptRetry(storage);
    expect(reloaded.begin('admin', { ...draft, locationId: 'other' }, [], () => 'wrong-key')).toEqual(first);
    expect(reloaded.read('other-admin')).toBeNull();
    reloaded.complete('admin');
    expect(new ReceiptRetry(storage).begin('admin', draft, [], () => 'second-key').payload.idempotencyKey).toBe('second-key');
  });
});
