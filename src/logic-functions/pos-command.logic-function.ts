import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';

import {
  MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME,
  POS_COMMAND_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  POS_COMMAND_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { signInternalRouteBody } from 'src/logic-functions/utils/mahabbat-internal-route-signature.util';
import { parsePosCommandEnvelope } from 'src/pos/pos-command-input';
import { POS_PRINTING_COMMANDS } from 'src/pos/pos-permissions';

const response = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const handler = async (event: RoutePayload): Promise<Response> => {
  const parsed = parsePosCommandEnvelope(event.body);

  if (!parsed.ok) return response(parsed.error, 400);

  // `isAuthRequired` has already validated the CRM/ Twenty workspace session
  // before this handler runs. Mark only the printing configuration subset as
  // CRM-authenticated; every other POS command still requires PosSession.
  const crmPrintingRequest =
    event.userWorkspaceId !== null &&
    parsed.data.sessionToken === undefined &&
    POS_PRINTING_COMMANDS.has(parsed.data.command);
  const delegatedEnvelope = crmPrintingRequest
    ? { ...parsed.data, crmWorkspaceAuthenticated: true }
    : parsed.data;

  const secret = process.env[MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME];
  const apiUrl = process.env.TWENTY_API_URL?.replace(/\/+$/, '');

  if (!secret || !apiUrl) {
    return response(
      { code: 'ROUTE_NOT_CONFIGURED', message: 'POS command route is not configured.' },
      500,
    );
  }

  try {
    const delegated = await fetch(
      `${apiUrl}/webhooks/server/${POS_COMMAND_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-mahabbat-signature': signInternalRouteBody(delegatedEnvelope, secret),
        },
        body: JSON.stringify(delegatedEnvelope),
      },
    );

    const text = await delegated.text();

    return new Response(text, {
      status: delegated.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return response(
      { code: 'ROUTE_UNAVAILABLE', message: 'POS command writer is unavailable.' },
      503,
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: POS_COMMAND_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'pos-command',
  description:
    'Authenticated POS command gateway: validates and signs commands for the app-only server resolver',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/pos/command',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
