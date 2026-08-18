import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type {
  DatabaseEventPayload,
  ObjectRecordCreateEvent,
  ObjectRecordUpdateEvent,
} from 'twenty-sdk/logic-function';

import { MAINTAIN_LAST_ACTIVITY_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { normalizeActivityTimestamp } from 'src/utils/last-activity.util';

type OrderRecord = {
  id?: string;
  customerId?: unknown;
  createdAt?: string | null;
};

type OrderEvent = DatabaseEventPayload<
  ObjectRecordCreateEvent<OrderRecord> | ObjectRecordUpdateEvent<OrderRecord>
>;

type CoreApiClientLike = {
  mutation: (mutation: unknown) => Promise<unknown>;
};

type MaintainedResult = { updated: boolean; lastActivityAt: string | null };

const asClient = (): CoreApiClientLike =>
  new CoreApiClient() as unknown as CoreApiClientLike;

// Each call is a single guarded conditional mutation: the server evaluates the
// filter as the WHERE clause of one UPDATE statement, so the stored value only
// changes when the guard holds atomically (see the readiness experiment in
// docs/QA.md). Two guards cover the two possible stored states.
const guardedUpdate = async (
  client: CoreApiClientLike,
  filter: Record<string, unknown>,
  candidate: string,
): Promise<number> => {
  const result = (await client.mutation({
    updatePeople: {
      __args: { filter, data: { lastActivityAt: candidate } },
      id: true,
    },
  })) as { updatePeople?: Array<{ id: string }> };

  return result.updatePeople?.length ?? 0;
};

export const maintainLastActivity = async (
  client: CoreApiClientLike,
  customerId: string,
  activityAt: string | Date,
): Promise<MaintainedResult> => {
  const candidate = normalizeActivityTimestamp(activityAt);

  if (candidate === null) {
    return { updated: false, lastActivityAt: null };
  }

  const idFilter = { id: { eq: customerId } };

  // First write: only proceeds while the stored value is still NULL.
  const nullSet = await guardedUpdate(
    client,
    { ...idFilter, lastActivityAt: { is: 'NULL' } },
    candidate,
  );

  if (nullSet > 0) {
    return { updated: true, lastActivityAt: candidate };
  }

  // Bump: only proceeds while the stored value is strictly older.
  const bumped = await guardedUpdate(
    client,
    { ...idFilter, lastActivityAt: { lt: candidate } },
    candidate,
  );

  if (bumped > 0) {
    return { updated: true, lastActivityAt: candidate };
  }

  // The customer is missing or an equal/newer value is already stored; a
  // concurrent newer write must never be overwritten (no lost update).
  return { updated: false, lastActivityAt: null };
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
    // Creation always fires; creation timestamps are immutable, so the only
    // update that carries a maintenance signal is a late customer assignment.
    updatedFields: ['createdAt', 'customerId'],
  },
});