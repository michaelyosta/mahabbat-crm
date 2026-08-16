import { defineLogicFunction } from 'twenty-sdk/define';

import { RECONCILE_PENDING_LOYALTY_ADJUSTMENTS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  asClient,
  processLoyaltyAdjustmentRequest,
  type CoreApiClientLike,
} from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';

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
        first: 100,
        ...(after ? { after } : {}),
      },
      edges: { node: { id: true } },
      pageInfo: { hasNextPage: true, endCursor: true },
    },
  })) as { loyaltyAdjustmentRequests?: Connection<PendingRequest> };

  return result.loyaltyAdjustmentRequests;
};

const handler = async (): Promise<{ reconciled: number; failed: number }> => {
  const client = asClient();
  let after: string | undefined;
  let reconciled = 0;
  let failed = 0;

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
      } catch {
        failed += 1;
      }
    }

    if (!page?.pageInfo?.hasNextPage || !page.pageInfo.endCursor) break;
    after = page.pageInfo.endCursor;
  }

  return { reconciled, failed };
};

export default defineLogicFunction({
  universalIdentifier:
    RECONCILE_PENDING_LOYALTY_ADJUSTMENTS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'reconcile-pending-loyalty-adjustments',
  description:
    'Periodically repairs pending loyalty requests when a database event was missed or a worker crashed',
  timeoutSeconds: 60,
  handler,
  cronTriggerSettings: { pattern: '*/5 * * * *' },
});
