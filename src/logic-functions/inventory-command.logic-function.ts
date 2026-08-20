import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';

import {
  INVENTORY_COMMAND_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME,
  INVENTORY_COMMAND_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { signInternalRouteBody } from 'src/logic-functions/utils/mahabbat-internal-route-signature.util';
import { parseInventoryCommandEnvelope } from 'src/inventory/inventory-command-input';

const response = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const handler = async (event: RoutePayload): Promise<Response> => {
  const parsed = parseInventoryCommandEnvelope(event.body);
  if (!parsed.ok) return response(parsed.error, 400);

  const secret = process.env[MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME];
  const apiUrl = process.env.TWENTY_API_URL?.replace(/\/+$/, '');
  if (!secret || !apiUrl) {
    return response({ code: 'ROUTE_NOT_CONFIGURED', message: 'Inventory command route is not configured.' }, 500);
  }

  try {
    const delegated = await fetch(
      `${apiUrl}/webhooks/server/${INVENTORY_COMMAND_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-mahabbat-signature': signInternalRouteBody(parsed.data, secret),
          ...(event.headers.authorization ? { authorization: event.headers.authorization } : {}),
        },
        body: JSON.stringify(parsed.data),
      },
    );
    const text = await delegated.text();
    return new Response(text, { status: delegated.status, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return response({ code: 'ROUTE_UNAVAILABLE', message: 'Inventory command writer is unavailable.' }, 503);
  }
};

export default defineLogicFunction({
  universalIdentifier: INVENTORY_COMMAND_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'inventory-command',
  description: 'Authenticated inventory backoffice command gateway',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/inventory/command',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: ['authorization'],
  },
});
