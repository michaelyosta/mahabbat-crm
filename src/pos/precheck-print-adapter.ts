export type PrecheckPrintable = {
  precheckId: string;
  orderId: string;
  subtotalMicros: number;
  totalMicros: number;
  guestTotals: Array<{ displayNumber: string; amountMicros: number }>;
};

export interface PrecheckPrintAdapter {
  print(precheck: PrecheckPrintable): Promise<{ status: 'PRINTED' }>;
}

export class MockPrecheckPrintAdapter implements PrecheckPrintAdapter {
  async print(_precheck: PrecheckPrintable): Promise<{ status: 'PRINTED' }> {
    return { status: 'PRINTED' };
  }
}

export const precheckPrintAdapter: PrecheckPrintAdapter =
  new MockPrecheckPrintAdapter();
