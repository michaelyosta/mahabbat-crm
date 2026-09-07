import type { CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import { readRuntimeState, compareAndSetRuntimeState } from 'src/server/runtime-state';

type RecoveryRow = { id: string; orderId?: string };
type Page = { edges?: Array<{ cursor: string; node: RecoveryRow }>; pageInfo?: { hasNextPage: boolean } };

// Small durable round-robin batches. Advancing BEFORE processing means a poison
// record or executor timeout cannot permanently starve the rest of the history.
// A failed record is retried on the next sweep; pending keys remain idempotent.
export const recoverInventory = async (
  client: CoreApiClientLike,
  processOrder: (orderId: string) => Promise<unknown>,
  now: () => number = Date.now,
): Promise<void> => {
  const deadline = now() + 20_000;
  for (const root of ['posOrders', 'inventoryConsumptionRequests']) {
    const key = `inventory-recovery:${root}`;
    let state = await readRuntimeState(client, key, { after: null });
    const { after } = JSON.parse(state.value) as { after: string | null };
    const result = await client.query({ [root]: {
      __args: { filter: { status: { eq: root === 'posOrders' ? 'CLOSED' : 'PENDING' } }, first: 10, ...(after ? { after } : {}) },
      edges: { cursor: true, node: root === 'posOrders' ? { id: true } : { id: true, orderId: true } },
      pageInfo: { hasNextPage: true },
    } }) as Record<string, Page>;
    const page = result[root];
    if (!page) throw new Error(`MISSING_CONNECTION:${root}`);
    const edges = page.edges ?? [];
    if (edges.length === 0) {
      await compareAndSetRuntimeState(client, state, { after: null });
      continue;
    }
    for (let i = 0; i < edges.length; i += 1) {
      if (now() >= deadline) return;
      const { cursor, node } = edges[i];
      if (!cursor || cursor === after) throw new Error(`INVALID_RECOVERY_CURSOR:${root}`);
      const next = i === edges.length - 1 && !page.pageInfo?.hasNextPage ? null : cursor;
      if (!await compareAndSetRuntimeState(client, state, { after: next })) break;
      state = { ...state, version: state.version + 1, value: JSON.stringify({ after: next }) };
      try {
        if (root === 'inventoryConsumptionRequests') {
          if (node.orderId) await processOrder(node.orderId);
        } else {
          const existing = await client.query({ inventoryConsumptionRequests: {
            __args: { filter: { orderId: { eq: node.id } }, first: 1 }, edges: { node: { id: true } },
          } }) as { inventoryConsumptionRequests?: { edges?: unknown[] } };
          if (!existing.inventoryConsumptionRequests) throw new Error('MISSING_REQUEST_CONNECTION');
          if (!existing.inventoryConsumptionRequests.edges?.length) {
            await client.mutation({ createInventoryConsumptionRequest: {
              __args: { data: { orderId: node.id, status: 'PENDING', idempotencyKey: node.id, attemptCount: 0 } }, id: true,
            } });
          }
        }
      } catch {
        // No credentials/customer contents in logs. Cursor guarantees later retry.
        console.warn('INVENTORY_RECOVERY_RETRY', root, node.id);
      }
    }
  }
};
