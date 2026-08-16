import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';

import {
  CREATE_LOYALTY_ADJUSTMENT_REQUEST_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME,
} from 'src/constants/universal-identifiers';
import { asClient } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import { createPendingLoyaltyAdjustment } from 'src/logic-functions/create-loyalty-adjustment-request.logic-function';
import { verifyInternalRouteBodySignature } from 'src/logic-functions/utils/mahabbat-internal-route-signature.util';
import {
  parseCreateLoyaltyAdjustmentBody,
  type CreateLoyaltyAdjustmentInput,
} from 'src/logic-functions/utils/validate-loyalty-adjustment-input.util';

const response = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const handler = async (
  event: RoutePayload<CreateLoyaltyAdjustmentInput>,
): Promise<Response> => {
  const secret = process.env[MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME];

  if (
    !secret ||
    !verifyInternalRouteBodySignature({
      body: event.body,
      signature: event.headers['x-mahabbat-signature'],
      secret,
    })
  ) {
    return response(
      { code: 'INVALID_INTERNAL_SIGNATURE', message: 'Invalid internal signature.' },
      403,
    );
  }

  const parsed = parseCreateLoyaltyAdjustmentBody(event.body);

  if (!parsed.ok) return response(parsed.error, 400);

  const result = await createPendingLoyaltyAdjustment(asClient(), parsed.data);

  return response(result.body, result.status);
};

export default defineLogicFunction({
  universalIdentifier:
    CREATE_LOYALTY_ADJUSTMENT_REQUEST_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'create-loyalty-adjustment-request-resolver',
  description:
    'App-only server resolver for the authenticated loyalty adjustment write boundary',
  timeoutSeconds: 10,
  handler,
  serverRouteTriggerSettings: {
    forwardedRequestHeaders: ['x-mahabbat-signature'],
  },
});
