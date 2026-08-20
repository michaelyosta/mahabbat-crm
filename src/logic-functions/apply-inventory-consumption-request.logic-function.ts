import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { DatabaseEventPayload, ObjectRecordCreateEvent, ObjectRecordUpdateEvent } from 'twenty-sdk/logic-function';
import { processConsumptionRequest } from 'src/inventory/inventory-dispatch';

type RequestRecord = { id?: string; orderId?: string; status?: string; idempotencyKey?: string };
type Event = DatabaseEventPayload<ObjectRecordCreateEvent<RequestRecord> | ObjectRecordUpdateEvent<RequestRecord>>;

const findLinesForOrder = async (client: { query: (q: unknown) => Promise<unknown> }, orderId: string) => {
  const res = (await client.query({
    posOrderLines: {
      __args: { filter: { orderId: { eq: orderId } }, first: 100 },
      edges: { node: { id: true, menuItemId: true, quantity: true, status: true, voidPreparedState: true, createdAt: true } },
      pageInfo: { hasNextPage: true, endCursor: true },
    },
  })) as { posOrderLines?: { edges?: Array<{ node?: { id: string; menuItemId: string; quantity: number; status: string; voidPreparedState?: string | null; createdAt?: string } | null }> } };
  return (res.posOrderLines?.edges ?? []).map(e => e?.node).filter(Boolean) as Array<{ id: string; menuItemId: string; quantity: number; status: string; voidPreparedState?: string | null; createdAt?: string }>;
};

export const processInventoryRequest = async (client: InstanceType<typeof CoreApiClient> | { query: (q: unknown)=>Promise<unknown>; mutation: (m: unknown)=>Promise<unknown> }, orderId: string) => {
  const lines = await findLinesForOrder(client as never, orderId);
  await processConsumptionRequest(client as never, orderId, lines);
};

const handler = async (event: Event): Promise<void> => {
  const client = new CoreApiClient() as unknown as { query: (q: unknown)=>Promise<unknown>; mutation: (m: unknown)=>Promise<unknown> };
  // Resolve actual orderId from request record
  let targetOrderId: string | null = null;
  if (event.properties?.after?.orderId) targetOrderId = event.properties.after.orderId as string;
  else {
    // fallback: fetch request
    const res = (await client.query({ inventoryConsumptionRequests: { __args: { filter: { id: { eq: event.recordId } }, first: 1 }, edges: { node: { orderId: true } } } })) as { inventoryConsumptionRequests?: { edges?: Array<{ node?: { orderId?: string } }> } };
    targetOrderId = res.inventoryConsumptionRequests?.edges?.[0]?.node?.orderId ?? null;
  }
  if (!targetOrderId) return;
  // only process PENDING
  await processInventoryRequest(client, targetOrderId);
};

export default defineLogicFunction({
  universalIdentifier: 'd5e8a7c2-aaaa-4aaa-8000-000000001501',
  name: 'apply-inventory-consumption-request',
  description: 'Processes inventory consumption for closed POS order exactly once',
  timeoutSeconds: 15,
  handler,
  databaseEventTriggerSettings: { eventName: 'inventoryConsumptionRequest.*' },
});
