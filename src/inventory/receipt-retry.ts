export type ReceiptDraft = {
  locationId: string;
  lines: Array<{ stockItemId: string; quantityMicros: number; unitCostMicros: number }>;
  comment: string;
};
export type PendingReceipt = { payload: ReceiptDraft & { idempotencyKey: string }; displayLines: Array<{ stockItemId: string; quantity: string; unitCost: string }> };
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// No session tokens or PINs. Keep the exact pending document through lost
// responses/reloads, scoped to the authenticated staff identity.
export class ReceiptRetry {
  private memory = new Map<string, PendingReceipt>();
  constructor(private storage?: Store) {}
  read(staffId: string): PendingReceipt | null {
    const cached = this.memory.get(staffId);
    if (cached) return cached;
    const raw = this.storage?.getItem(`mahabbat:pending-receipt:${staffId}`);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingReceipt;
    if (!pending.payload?.idempotencyKey || !Array.isArray(pending.payload.lines) || !Array.isArray(pending.displayLines)) throw new Error('Не удалось восстановить приход. Проверьте историю операций.');
    this.memory.set(staffId, pending);
    return pending;
  }
  begin(staffId: string, payload: ReceiptDraft, displayLines: PendingReceipt['displayLines'], key: () => string): PendingReceipt {
    const existing = this.read(staffId);
    if (existing) return existing;
    const pending = { payload: { ...payload, idempotencyKey: key() }, displayLines: displayLines.map(line => ({ ...line })) };
    this.storage?.setItem(`mahabbat:pending-receipt:${staffId}`, JSON.stringify(pending));
    this.memory.set(staffId, pending);
    return pending;
  }
  complete(staffId: string): void {
    this.storage?.removeItem(`mahabbat:pending-receipt:${staffId}`);
    this.memory.delete(staffId);
  }
}
