import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';

import { CREATE_LOYALTY_ADJUSTMENT_REQUEST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { type CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import { MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME, CREATE_LOYALTY_ADJUSTMENT_REQUEST_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { signInternalRouteBody } from 'src/logic-functions/utils/mahabbat-internal-route-signature.util';
import { parseCreateLoyaltyAdjustmentBody, type CreateLoyaltyAdjustmentInput } from 'src/logic-functions/utils/validate-loyalty-adjustment-input.util';

type Connection<T> = { edges?: Array<{ node?: T | null } | null> };

type ExistingRequest = {
  id: string;
  customerId?: string | null;
  amount?: number | null;
  reason?: string | null;
  idempotencyKey?: string | null;
  status?: string | null;
};

const findCustomer = async (
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

const findExistingRequest = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<ExistingRequest | null> => {
  const result = (await client.query({
    loyaltyAdjustmentRequests: {
      __args: { filter: { idempotencyKey: { eq: idempotencyKey } }, first: 1 },
      edges: {
        node: {
          id: true,
          customerId: true,
          amount: true,
          reason: true,
          idempotencyKey: true,
          status: true,
        },
      },
    },
  })) as { loyaltyAdjustmentRequests?: Connection<ExistingRequest> };

  return result.loyaltyAdjustmentRequests?.edges?.[0]?.node ?? null;
};

const response = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const createPendingLoyaltyAdjustment = async (
  client: CoreApiClientLike,
  input: CreateLoyaltyAdjustmentInput,
): Promise<{ body: unknown; status: number }> => {
  const { customerId, amount, reason, idempotencyKey } = input;

  if (!(await findCustomer(client, customerId))) {
    return {
      body: { code: 'INVALID_CUSTOMER', message: 'Customer does not exist.' },
      status: 404,
    };
  }

  const existing = await findExistingRequest(client, idempotencyKey);

  if (existing) {
    const samePayload =
      existing.customerId === customerId &&
      existing.amount === amount &&
      existing.reason === reason;

    if (!samePayload) {
      return {
        body: {
          code: 'IDEMPOTENCY_KEY_REUSE',
          message: 'The idempotency key is already bound to another request.',
        },
        status: 409,
      };
    }

    return {
      body: { id: existing.id, status: existing.status ?? 'PENDING' },
      status: 200,
    };
  }

  try {
    const result = (await client.mutation({
      createLoyaltyAdjustmentRequest: {
        __args: {
          data: { customerId, amount, reason, idempotencyKey },
        },
        id: true,
        status: true,
      },
    })) as { createLoyaltyAdjustmentRequest?: { id?: string; status?: string } };

    const created = result.createLoyaltyAdjustmentRequest;
    if (!created?.id) {
      return {
        body: { code: 'CREATE_FAILED', message: 'Request was not created.' },
        status: 500,
      };
    }

    return {
      body: { id: created.id, status: created.status ?? 'PENDING' },
      status: 201,
    };
  } catch {
    // A concurrent caller may have won the unique idempotency-key race.
    const raced = await findExistingRequest(client, idempotencyKey);
    if (raced) {
      const samePayload =
        raced.customerId === customerId &&
        raced.amount === amount &&
        raced.reason === reason;

      if (samePayload) {
        return {
          body: { id: raced.id, status: raced.status ?? 'PENDING' },
          status: 200,
        };
      }
    }

    return {
      body: { code: 'CREATE_FAILED', message: 'Request could not be created.' },
      status: 409,
    };
  }
};

const handler = async (event: RoutePayload): Promise<Response> => {
  const parsed = parseCreateLoyaltyAdjustmentBody(event.body);

  if (!parsed.ok) return response(parsed.error, 400);

  const secret = process.env[MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME];
  const apiUrl = process.env.TWENTY_API_URL?.replace(/\/+$/, '');

  if (!secret || !apiUrl) {
    return response(
      { code: 'ROUTE_NOT_CONFIGURED', message: 'Adjustment route is not configured.' },
      500,
    );
  }

  const payload = parsed.data;

  try {
    const delegated = await fetch(
      `${apiUrl}/webhooks/server/${CREATE_LOYALTY_ADJUSTMENT_REQUEST_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-mahabbat-signature': signInternalRouteBody(payload, secret),
        },
        body: JSON.stringify(payload),
      },
    );

    const text = await delegated.text();

    return new Response(text, {
      status: delegated.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return response(
      { code: 'ROUTE_UNAVAILABLE', message: 'Adjustment writer is unavailable.' },
      503,
    );
  }
};

export default defineLogicFunction({
  universalIdentifier:
    CREATE_LOYALTY_ADJUSTMENT_REQUEST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'create-loyalty-adjustment-request',
  description:
    'Validates and creates a pending loyalty adjustment request through the app write boundary',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/loyalty/adjustments',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
