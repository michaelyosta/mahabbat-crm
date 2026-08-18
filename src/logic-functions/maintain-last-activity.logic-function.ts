import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type {
  DatabaseEventPayload,
  ObjectRecordCreateEvent,
} from 'twenty-sdk/logic-function';

import { MAINTAIN_LAST_ACTIVITY_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { mergeLastActivityAt } from 'src/utils/last-activity.util';

type OrderRecord = {
  id?: string;
  customerId?: unknown;
  createdAt?: string | null;
};

type OrderEvent = DatabaseEventPayload<ObjectRecordCreateEvent<OrderRecord>>;

type CoreApiClientLike = {
  query: (query: unknown) => Promise<unknown>;
  mutation: (mutation: unknown) => Promise<unknown>;
};

const asClient = (): CoreApiClientLike =>
  new CoreApiClient() as unknown as CoreApiClientLike;

const findCustomer = async (
  client: CoreApiClientLike,
  customerId: string,
): Promise<{ id: string; lastActivityAt?: string | null } | null> => {
  const result = (await client.query({
    people: {
      __args: { filter: { id: { eq: customerId } }, first: 1 },
      edges: { node: { id: true, lastActivityAt: true } },
    },
  })) as {
    people?: {
      edges?: Array<{ node?: { id: string; lastActivityAt?: string | null } | null } | null>;
    };
  };

  return result.people?.edges?.[0]?.node ?? null;
};

export const maintainLastActivity = async (
  client: CoreApiClientLike,
  customerId: string,
  activityAt: string,
): Promise<{ updated: boolean; lastActivityAt: string | null }> => {
  const customer = await findCustomer(client, customerId);

  if (!customer) {
    return { updated: false, lastActivityAt: null };
  }

  const merged = mergeLastActivityAt(customer.lastActivityAt ?? null, activityAt);

  if (merged === (customer.lastActivityAt ?? null)) {
    return { updated: false, lastActivityAt: merged };
  }

  await client.mutation({
    updatePerson: {
      __args: { id: customerId, data: { lastActivityAt: merged } },
      id: true,
    },
  });

  return { updated: true, lastActivityAt: merged };
};

const handler = async (event: OrderEvent): Promise<void> => {
  const after = event.properties?.after;

  if (!after?.customerId || !after.createdAt) {
    // Destroy events have no `after`, and an order without a customer or a
    // creation timestamp carries no maintenance signal.
    return;
  }

  await maintainLastActivity(
    asClient(),
    String(after.customerId),
    after.createdAt,
  );
};

export default defineLogicFunction({
  universalIdentifier: MAINTAIN_LAST_ACTIVITY_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'maintain-last-activity',
  description:
    'Keeps Person.lastActivityAt monotonically current from order activity',
  timeoutSeconds: 10,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'order.*',
    // Only creation (and the rare creation-timestamp repair) should bump
    // activity; unrelated order edits must not re-fire maintenance.
    updatedFields: ['createdAt'],
  },
});