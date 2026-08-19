export type KitchenPrintableLine = {
  orderLineId: string;
  guestDisplayNumber: string | null;
  itemNameSnapshot: string;
  quantity: number;
  action: 'ADD' | 'CANCEL';
};

export type KitchenPrintableTicket = {
  ticketId: string;
  orderId: string;
  ticketType: 'NEW_ITEMS' | 'CANCELLATION';
  lines: KitchenPrintableLine[];
};

export interface KitchenPrintAdapter {
  print(ticket: KitchenPrintableTicket): Promise<{ status: 'PRINTED' }>;
}

/**
 * Slice 2 adapter. It deliberately has no printer/Windows dependency: the
 * immutable ticket is the domain output and this adapter only acknowledges it.
 */
export class MockKitchenPrintAdapter implements KitchenPrintAdapter {
  async print(_ticket: KitchenPrintableTicket): Promise<{ status: 'PRINTED' }> {
    return { status: 'PRINTED' };
  }
}

export const kitchenPrintAdapter: KitchenPrintAdapter =
  new MockKitchenPrintAdapter();
