import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import { processInventoryRequest } from 'src/logic-functions/apply-inventory-consumption-request.logic-function';
import { recoverInventory } from 'src/inventory/inventory-recovery';
import type { CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';

export default defineLogicFunction({
  universalIdentifier: 'e5e8a7c2-bbbb-4aaa-8000-000000001502',
  name: 'reconcile-pending-inventory-consumptions',
  description: 'Durable cursor recovery of missing and pending inventory consumption requests',
  timeoutSeconds: 30,
  handler: async () => {
    const client = new CoreApiClient() as unknown as CoreApiClientLike;
    await recoverInventory(client, orderId => processInventoryRequest(client, orderId));
  },
  cronTriggerSettings: { pattern: '*/5 * * * *' },
});
