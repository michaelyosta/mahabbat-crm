import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { DatabaseEventPayload, ObjectRecordCreateEvent, ObjectRecordUpdateEvent } from 'twenty-sdk/logic-function';
import { processConsumptionRequest } from 'src/inventory/inventory-dispatch';

type RequestRecord = { id?: string; orderId?: string; status?: string; idempotencyKey?: string };
type Event = DatabaseEventPayload<ObjectRecordCreateEvent<RequestRecord> | ObjectRecordUpdateEvent<RequestRecord>>;

type OrderLineForConsumption = { id: string; menuItemId: string; quantity: number; status: string; voidPreparedState?: string | null; createdAt?: string };

const MAX_ORDER_LINE_PAGES = 200;

const findLinesForOrder = async (client: { query: (q: unknown) => Promise<unknown> }, orderId: string): Promise<OrderLineForConsumption[]> => {
  const rows: OrderLineForConsumption[] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_ORDER_LINE_PAGES; page += 1) {
    const res = (await client.query({
      posOrderLines: {
        __args: { filter: { orderId: { eq: orderId } }, first: 100, ...(after ? { after } : {}) },
        edges: { node: { id: true, menuItemId: true, quantity: true, status: true, voidPreparedState: true, createdAt: true } },
        pageInfo: { hasNextPage: true, endCursor: true },
      },
    })) as { posOrderLines?: { edges?: Array<{ node?: OrderLineForConsumption | null }>; pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } | null } };
    const connection = res.posOrderLines;
    rows.push(...(connection?.edges ?? []).map(e => e?.node).filter((n): n is OrderLineForConsumption => Boolean(n)));
    if (!connection?.pageInfo?.hasNextPage || !connection.pageInfo.endCursor) break;
    after = connection.pageInfo.endCursor;
  }
  return rows;
};

export const processInventoryRequest = async (client: InstanceType<typeof CoreApiClient> | { query: (q: unknown)=>Promise<unknown>; mutation: (m: unknown)=>Promise<unknown> }, orderId: string) => {
  const lines = await findLinesForOrder(client as never, orderId);
  await processConsumptionRequest(client as never, orderId, lines);
};

const handler = async (event: Event): Promise<void> => {
  const client = new CoreApiClient() as unknown as { query: (q: unknown)=>Promise<unknown>; mutation: (m: unknown)=>Promise<unknown> };
  // Destroyed events carry no snapshot and require no work.
  if (!event.properties?.after && event.name.endsWith('.destroyed')) return;
  // React only to freshly created requests. The processor never triggers itself
  // through its own status/attempt updates; retries of non-terminal requests
  // are driven by the reconcile cron. This removes the self-trigger class
  // entirely rather than relying on a status guard.
  if (!event.name.endsWith('.created')) return;
  const after = event.properties?.after as RequestRecord | undefined;
  if (after?.status && after.status !== 'PENDING') return;
  // Resolve actual orderId from request record
  let targetOrderId: string | null = null;
  if (event.properties?.after?.orderId) targetOrderId = event.properties.after.orderId as string;
  else {
    // fallback: fetch request
    const res = (await client.query({ inventoryConsumptionRequests: { __args: { filter: { id: { eq: event.recordId } }, first: 1 }, edges: { node: { orderId: true, status: true } } } })) as { inventoryConsumptionRequests?: { edges?: Array<{ node?: { orderId?: string; status?: string } }> } };
    const node = res.inventoryConsumptionRequests?.edges?.[0]?.node;
    if (node?.status && node.status !== 'PENDING') return;
    targetOrderId = node?.orderId ?? null;
  }
  if (!targetOrderId) return;
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
