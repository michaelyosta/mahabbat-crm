import { defineLogicFunction } from 'twenty-sdk/define';

import { RECONCILE_PENDING_LOYALTY_ADJUSTMENTS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  asClient,
  processLoyaltyAdjustmentRequest,
  type CoreApiClientLike,
} from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';

export type LoyaltyReconcileMetrics = {
  reconciled: number;
  failed: number;
  failures: Array<{ requestId: string; error: string }>;
};

export const MAX_LOYALTY_RECONCILE_FAILURE_DETAILS = 25;
export const LOYALTY_RECONCILE_OVERLAP_MESSAGE = 'LOYALTY_RECONCILE_ALREADY_RUNNING';

let reconcileInFlight = false;

export const resetLoyaltyReconcileForTest = (): void => {
  reconcileInFlight = false;
};

type PendingRequest = { id: string };
type Connection<T> = {
  edges?: Array<{ node?: T | null } | null>;
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } | null;
};

const listPendingRequests = async (
  client: CoreApiClientLike,
  after?: string,
) => {
  const result = (await client.query({
    loyaltyAdjustmentRequests: {
      __args: {
        filter: { status: { eq: 'PENDING' } },
        // Deterministic cursor: occurredAt is not on the request, so the
        // id tiebreak keeps pages stable under concurrent inserts.
        orderBy: [{ id: 'AscNullsLast' as never }],
        first: 100,
        ...(after ? { after } : {}),
      },
      edges: { node: { id: true } },
      pageInfo: { hasNextPage: true, endCursor: true },
    },
  })) as { loyaltyAdjustmentRequests?: Connection<PendingRequest> };

  return result.loyaltyAdjustmentRequests;
};

export const reconcilePendingLoyaltyAdjustments = async (
  client: CoreApiClientLike,
): Promise<LoyaltyReconcileMetrics> => {
  if (reconcileInFlight) {
    throw new Error(LOYALTY_RECONCILE_OVERLAP_MESSAGE);
  }
  reconcileInFlight = true;

  let after: string | undefined;
  let reconciled = 0;
  let failed = 0;
  const failures: Array<{ requestId: string; error: string }> = [];

  try {
    for (;;) {
      const page = await listPendingRequests(client, after);
      const requests = page?.edges
        ?.map((edge) => edge?.node)
        .filter((request): request is PendingRequest => Boolean(request?.id)) ?? [];

      for (const request of requests) {
        try {
          await processLoyaltyAdjustmentRequest(
            client,
            request.id,
            undefined,
            'workspace:cron',
          );
          reconciled += 1;
        } catch (error) {
          failed += 1;
          failures.push({
            requestId: request.id,
            error: error instanceof Error ? error.message : String(error),
          });
          if (failures.length > MAX_LOYALTY_RECONCILE_FAILURE_DETAILS) {
            failures.shift();
          }
        }
        // Jitter between items so a fleet of workers does not stampede the
        // same hot request rows after a shared outage.
        await new Promise<void>((resolve) => {
          setTimeout(resolve, Math.floor(Math.random() * 25));
        });
      }

      if (!page?.pageInfo?.hasNextPage || !page.pageInfo.endCursor) break;
      after = page.pageInfo.endCursor;
    }

    if (failed > 0) {
      console.error(
        JSON.stringify({
          msg: 'reconcile-pending-loyalty-adjustments failures',
          failed,
          failures,
        }),
      );
    }

    return { reconciled, failed, failures };
  } finally {
    reconcileInFlight = false;
  }
};

const handler = async (): Promise<{ reconciled: number; failed: number }> => {
  const metrics = await reconcilePendingLoyaltyAdjustments(asClient());
  return { reconciled: metrics.reconciled, failed: metrics.failed };
};

export default defineLogicFunction({
  universalIdentifier:
    RECONCILE_PENDING_LOYALTY_ADJUSTMENTS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'reconcile-pending-loyalty-adjustments',
  description:
    'Periodically repairs pending loyalty requests when a database event was missed or a worker crashed',
  timeoutSeconds: 120,
  handler,
  cronTriggerSettings: { pattern: '*/5 * * * *' },
});
