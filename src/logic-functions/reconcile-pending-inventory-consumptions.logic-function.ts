import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import { processInventoryRequest } from 'src/logic-functions/apply-inventory-consumption-request.logic-function';

export default defineLogicFunction({
  universalIdentifier: 'e5e8a7c2-bbbb-4aaa-8000-000000001502',
  name: 'reconcile-pending-inventory-consumptions',
  description: 'Cron backstop: finds PENDING inventory consumption requests and closed POS orders without request',
  timeoutSeconds: 30,
  handler: async () => {
    const client = new CoreApiClient() as unknown as { query: (q: unknown)=>Promise<unknown>; mutation: (m: unknown)=>Promise<unknown> };
    // 1. PENDING and retryable FAILED_MISSING_RECIPE requests. Bounded by the
    // processor's attempt cap, which flips a stuck request to terminal FAILED.
    const pending = (await client.query({
      inventoryConsumptionRequests: { __args: { filter: { status: { in: ['PENDING', 'FAILED_MISSING_RECIPE'] } }, first: 50 }, edges: { node: { id: true, orderId: true } } },
    })) as { inventoryConsumptionRequests?: { edges?: Array<{ node?: { orderId?: string } }> } };
    for (const edge of pending.inventoryConsumptionRequests?.edges ?? []) {
      const orderId = edge?.node?.orderId;
      if (orderId) await processInventoryRequest(client as never, orderId).catch(()=>null);
    }
    // 2. CLOSED orders without request (recovery)
    const closed = (await client.query({
      posOrders: { __args: { filter: { status: { eq: 'CLOSED' } }, first: 50 }, edges: { node: { id: true } } },
    })) as { posOrders?: { edges?: Array<{ node?: { id?: string } }> } };
    for (const edge of closed.posOrders?.edges ?? []) {
      const orderId = edge?.node?.id;
      if (!orderId) continue;
      const existing = (await client.query({
        inventoryConsumptionRequests: { __args: { filter: { orderId: { eq: orderId } }, first: 1 }, edges: { node: { id: true } } },
      })) as { inventoryConsumptionRequests?: { edges?: Array<{ node?: { id?: string } }> } };
      if ((existing.inventoryConsumptionRequests?.edges ?? []).length === 0) {
        try {
          await client.mutation({ createInventoryConsumptionRequest: { __args: { data: { orderId, status: 'PENDING', idempotencyKey: orderId, attemptCount: 0 } }, id: true } });
        } catch {}
        await processInventoryRequest(client as never, orderId).catch(()=>null);
      }
    }
  },
  cronTriggerSettings: { pattern: '*/5 * * * *' },
});
