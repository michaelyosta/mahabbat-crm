import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import {
  INVENTORY_COMMAND_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME,
} from 'src/constants/universal-identifiers';
import { asClient } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import { verifyInternalRouteBodySignature } from 'src/logic-functions/utils/mahabbat-internal-route-signature.util';
import { getAuthenticatedPosContext } from 'src/pos/pos-auth';
import { parseInventoryCommandEnvelope } from 'src/inventory/inventory-command-input';
import { dispatchInventoryCommand } from 'src/inventory/inventory-dispatch';

const response = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type RuntimeCoreClientOptions = { url?: string; headers: Record<string, string> };
const createRuntimeCoreClient = (options: RuntimeCoreClientOptions) =>
  new (CoreApiClient as unknown as new (options: RuntimeCoreClientOptions) => CoreApiClient)(options);

export const handler = async (event: RoutePayload): Promise<Response> => {
  const secret = process.env[MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME];
  if (
    !secret ||
    !verifyInternalRouteBodySignature({
      body: event.body,
      signature: event.headers['x-mahabbat-signature'],
      secret,
    })
  ) {
    return response({ code: 'INVALID_SIGNATURE', message: 'Invalid internal signature.' }, 403);
  }

  const envelope = parseInventoryCommandEnvelope(event.body);
  if (!envelope.ok) return response(envelope.error, 400);
  if (!envelope.data.sessionToken) return response({ code: 'POS_SESSION_REQUIRED', message: 'Войдите в склад по PIN администратора.' }, 401);

  const authorization = event.headers.authorization
    ?? (process.env.TWENTY_API_KEY ? `Bearer ${process.env.TWENTY_API_KEY}` : undefined);
  const apiUrl = (process.env.TWENTY_API_URL ?? process.env.SERVER_URL)
    ?.replace(/localhost|127\.0\.0\.1/g, 'host.docker.internal')
    .replace(/\/+$/, '');
  const client = authorization
    ? createRuntimeCoreClient({ url: apiUrl ? `${apiUrl}/graphql` : undefined, headers: { Authorization: authorization } })
    : asClient();
  const authenticated = await getAuthenticatedPosContext(client, envelope.data.sessionToken);
  if (!authenticated.ok) return response(authenticated.result.body, authenticated.result.status);

  try {
    const result = await dispatchInventoryCommand(
      client,
      envelope.data.command,
      envelope.data.payload,
      authenticated.context,
    );
    return response(result.body, result.status);
  } catch {
    return response({ code: 'INVENTORY_COMMAND_FAILED', message: 'Операция склада не проведена. Повторите попытку.' }, 409);
  }
};

export default defineLogicFunction({
  universalIdentifier: INVENTORY_COMMAND_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'inventory-command-resolver',
  description: 'App-only inventory command writer with server-owned staff context',
  timeoutSeconds: 15,
  handler,
  serverRouteTriggerSettings: {
    forwardedRequestHeaders: ['x-mahabbat-signature', 'authorization'],
  },
});
