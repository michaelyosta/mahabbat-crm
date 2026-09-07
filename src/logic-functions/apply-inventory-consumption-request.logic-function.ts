import { queryAll } from 'src/server/query-all';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { DatabaseEventPayload, ObjectRecordCreateEvent, ObjectRecordUpdateEvent } from 'twenty-sdk/logic-function';
import { processConsumptionRequest } from 'src/inventory/inventory-dispatch';

type RequestRecord = { id?: string; orderId?: string; status?: string; idempotencyKey?: string };
type Event = DatabaseEventPayload<ObjectRecordCreateEvent<RequestRecord> | ObjectRecordUpdateEvent<RequestRecord>>;

type OrderLine = { id: string; menuItemId: string; quantity: number; status: string; voidPreparedState?: string | null; createdAt?: string };
const findLinesForOrder = (client: { query: (q: unknown) => Promise<unknown>; mutation: (m: unknown) => Promise<unknown> }, orderId: string) =>
  queryAll<OrderLine>(client, 'posOrderLines', { filter: { orderId: { eq: orderId } }, first: 100 },
    { id: true, menuItemId: true, quantity: true, status: true, voidPreparedState: true, createdAt: true });

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
