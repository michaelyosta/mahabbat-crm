import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';
import type {
  DatabaseEventPayload,
  ObjectRecordCreateEvent,
  ObjectRecordUpdateEvent,
} from 'twenty-sdk/logic-function';

import { APPLY_LOYALTY_ADJUSTMENT_REQUEST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { parseCreateLoyaltyAdjustmentBody } from 'src/logic-functions/utils/validate-loyalty-adjustment-input.util';

type LoyaltyAdjustmentRequestRecord = {
  id?: string;
  customerId?: unknown;
  amount?: unknown;
  reason?: unknown;
  idempotencyKey?: unknown;
  status?: unknown;
  processedAt?: unknown;
  error?: unknown;
};

type LoyaltyAdjustmentRequestEvent = DatabaseEventPayload<
  | ObjectRecordCreateEvent<LoyaltyAdjustmentRequestRecord>
  | ObjectRecordUpdateEvent<LoyaltyAdjustmentRequestRecord>
>;

type LoyaltyLedgerEntryRecord = {
  id: string;
  sourceRequestId?: string | null;
  customerId?: string | null;
  amount?: number | null;
  reason?: string | null;
  idempotencyKey?: string | null;
  occurredAt?: string | null;
};

export type CoreApiClientLike = {
  query: (query: unknown) => Promise<unknown>;
  mutation: (mutation: unknown) => Promise<unknown>;
};

type Connection<T> = {
  edges?: Array<{ node?: T | null } | null>;
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } | null;
};

export const asClient = (): CoreApiClientLike =>
  new CoreApiClient() as unknown as CoreApiClientLike;

const findLedgerEntry = async (
  client: CoreApiClientLike,
  filter: Record<string, unknown>,
): Promise<LoyaltyLedgerEntryRecord | null> => {
  const result = (await client.query({
    loyaltyLedgerEntries: {
      __args: { filter, first: 1 },
      edges: {
        node: {
          id: true,
          sourceRequestId: true,
          customerId: true,
          amount: true,
          reason: true,
          idempotencyKey: true,
          occurredAt: true,
        },
      },
    },
  })) as { loyaltyLedgerEntries?: Connection<LoyaltyLedgerEntryRecord> };

  return result.loyaltyLedgerEntries?.edges?.[0]?.node ?? null;
};

const findLedgerBySourceRequestId = (client: CoreApiClientLike, requestId: string) =>
  findLedgerEntry(client, { sourceRequestId: { eq: requestId } });

const findLedgerByIdempotencyKey = (
  client: CoreApiClientLike,
  idempotencyKey: string,
) => findLedgerEntry(client, { idempotencyKey: { eq: idempotencyKey } });

const requestFields = {
  id: true,
  customerId: true,
  amount: true,
  reason: true,
  idempotencyKey: true,
  status: true,
  processedAt: true,
  error: true,
};

const findRequest = async (
  client: CoreApiClientLike,
  requestId: string,
): Promise<LoyaltyAdjustmentRequestRecord | null> => {
  const filteredResult = (await client.query({
    loyaltyAdjustmentRequests: {
      __args: { filter: { id: { eq: requestId } }, first: 1 },
      edges: { node: requestFields },
    },
  })) as { loyaltyAdjustmentRequests?: Connection<LoyaltyAdjustmentRequestRecord> };

  const filteredRequest = filteredResult.loyaltyAdjustmentRequests?.edges?.[0]?.node;

  if (filteredRequest) return filteredRequest;

  // Keep a bounded cursor fallback for transient filter/index inconsistencies.
  // This prevents recovery from silently depending on the first 100 records.
  let after: string | undefined;

  for (;;) {
    const result = (await client.query({
      loyaltyAdjustmentRequests: {
        __args: { first: 100, ...(after ? { after } : {}) },
        edges: { node: requestFields },
        pageInfo: { hasNextPage: true, endCursor: true },
      },
    })) as { loyaltyAdjustmentRequests?: Connection<LoyaltyAdjustmentRequestRecord> };

    const request = result.loyaltyAdjustmentRequests?.edges
      ?.map((edge) => edge?.node)
      .find((node) => node?.id === requestId);

    if (request) return request;

    const pageInfo = result.loyaltyAdjustmentRequests?.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) return null;
    after = pageInfo.endCursor;
  }
};

const customerExists = async (
  client: CoreApiClientLike,
  customerId: string,
): Promise<boolean> => {
  const result = (await client.query({
    people: {
      __args: { filter: { id: { eq: customerId } }, first: 1 },
      edges: { node: { id: true } },
    },
  })) as { people?: Connection<{ id: string }> };

  return Boolean(result.people?.edges?.[0]?.node?.id);
};

const updateRequest = async (
  client: CoreApiClientLike,
  requestId: string,
  data: Record<string, unknown>,
) => {
  await client.mutation({
    updateLoyaltyAdjustmentRequest: {
      __args: { id: requestId, data },
      id: true,
    },
  });
};

const rejectRequest = async (
  client: CoreApiClientLike,
  requestId: string,
  error: string,
) => {
  await updateRequest(client, requestId, {
    status: 'REJECTED',
    processedAt: new Date().toISOString(),
    error,
  });
};

const reconcileRequestWithLedger = async (
  client: CoreApiClientLike,
  requestId: string,
  request: LoyaltyAdjustmentRequestRecord,
  ledger: LoyaltyLedgerEntryRecord,
) => {
  if (ledger.sourceRequestId !== requestId) {
    throw new Error('Ledger entry is not owned by this adjustment request.');
  }

  const processedAt = ledger.occurredAt ?? new Date().toISOString();
  const data = {
    customerId: ledger.customerId,
    amount: ledger.amount,
    reason: ledger.reason,
    idempotencyKey: ledger.idempotencyKey,
    status: 'APPLIED',
    processedAt,
    error: null,
  };

  const alreadyReconciled =
    request.customerId === data.customerId &&
    request.amount === data.amount &&
    request.reason === data.reason &&
    request.idempotencyKey === data.idempotencyKey &&
    request.status === data.status &&
    request.error == null &&
    request.processedAt === data.processedAt;

  if (!alreadyReconciled) {
    await updateRequest(client, requestId, data);
  }
};

export const processLoyaltyAdjustmentRequest = async (
  client: CoreApiClientLike,
  requestId: string,
  requestSnapshot?: LoyaltyAdjustmentRequestRecord,
  actorSource?: string,
): Promise<void> => {
  const after = requestSnapshot ?? (await findRequest(client, requestId)) ?? undefined;
  if (!after) return;

  const sourceLedger = await findLedgerBySourceRequestId(client, requestId);

  // This is the retry/crash recovery branch. The unique sourceRequestId index
  // makes this lookup the authoritative exactly-once boundary; request status
  // is only a projection and can safely be repaired from the ledger snapshot.
  if (sourceLedger) {
    await reconcileRequestWithLedger(client, requestId, after, sourceLedger);
    return;
  }

  if (after.status !== 'PENDING') {
    // Terminal request updates are projections and must not recursively emit
    // more rejection updates. A malformed create is rejected by the route
    // boundary before a request is persisted.
    return;
  }

  const parsed = parseCreateLoyaltyAdjustmentBody(after);

  if (!parsed.ok) {
    await rejectRequest(client, requestId, parsed.error.message);
    return;
  }

  const { customerId, amount, reason, idempotencyKey } = parsed.data;

  if (!(await customerExists(client, customerId))) {
    await rejectRequest(client, requestId, 'Customer does not exist.');
    return;
  }

  const idempotencyLedger = await findLedgerByIdempotencyKey(
    client,
    idempotencyKey,
  );

  if (idempotencyLedger) {
    if (idempotencyLedger.sourceRequestId === requestId) {
      await reconcileRequestWithLedger(
        client,
        requestId,
        after,
        idempotencyLedger,
      );
      return;
    }

    await rejectRequest(
      client,
      requestId,
      'The idempotency key is already bound to another ledger entry.',
    );
    return;
  }

  try {
    await client.mutation({
      createLoyaltyLedgerEntry: {
        __args: {
          data: {
            customerId,
            sourceRequestId: requestId,
            entryType: 'ADJUSTMENT',
            amount,
            occurredAt: new Date().toISOString(),
            reason,
            // Database-event jobs may be emitted by an API key and therefore
            // have no userWorkspaceId. The processor, not the UI, owns this
            // audit value in either case.
            actorSource: actorSource ?? 'workspace:app',
            source: 'MANUAL',
            idempotencyKey,
          },
        },
        id: true,
      },
    });
  } catch (error) {
    // A parallel worker may have won the unique sourceRequestId race. An
    // idempotency-key conflict owned by another request is not safe to
    // reconcile into this request, so reject it instead of copying foreign
    // history into the projection.
    const racedLedger =
      (await findLedgerBySourceRequestId(client, requestId)) ??
      (await findLedgerByIdempotencyKey(client, idempotencyKey));

    if (!racedLedger) throw error;

    if (racedLedger.sourceRequestId !== requestId) {
      await rejectRequest(
        client,
        requestId,
        'The idempotency key is already bound to another ledger entry.',
      );
      return;
    }

    await reconcileRequestWithLedger(client, requestId, after, racedLedger);
    return;
  }

  const createdLedger = await findLedgerBySourceRequestId(client, requestId);

  if (!createdLedger) {
    throw new Error('Ledger entry was created but could not be re-read.');
  }

  await reconcileRequestWithLedger(client, requestId, after, createdLedger);
};

const handler = async (event: LoyaltyAdjustmentRequestEvent): Promise<void> => {
  const client = asClient();

  // Destroy events do not contain an `after` snapshot. There is no ledger
  // write to perform for those events, and the staff role cannot destroy a
  // request in the first place.
  if (!event.properties?.after && event.name.endsWith('.destroyed')) return;

  await processLoyaltyAdjustmentRequest(
    client,
    event.recordId,
    event.properties?.after,
    event.userWorkspaceId ?? `workspace:${event.workspaceId}`,
  );
};

export default defineLogicFunction({
  universalIdentifier:
    APPLY_LOYALTY_ADJUSTMENT_REQUEST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'apply-loyalty-adjustment-request',
  description:
    'Creates an append-only loyalty ledger adjustment from a validated internal request',
  timeoutSeconds: 10,
  handler,
  databaseEventTriggerSettings: {
    // Created and updated events share the same idempotent processor. An
    // update is useful for recovering a request left PENDING after a crash and
    // for repairing an attempted post-APPLIED rewrite from the ledger snapshot.
    eventName: 'loyaltyAdjustmentRequest.*',
  },
});
