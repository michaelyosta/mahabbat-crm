import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';

import {
  MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME,
  POS_COMMAND_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { asClient } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import { verifyInternalRouteBodySignature } from 'src/logic-functions/utils/mahabbat-internal-route-signature.util';
import {
  parseCommandPayload,
  parsePosCommandEnvelope,
} from 'src/pos/pos-command-input';
import { dispatchPosCommand } from 'src/pos/pos-command.dispatch';

const response = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

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
    return response(
      { code: 'INVALID_SIGNATURE', message: 'Invalid internal signature.' },
      403,
    );
  }

  const envelope = parsePosCommandEnvelope(event.body);

  if (!envelope.ok) return response(envelope.error, 400);

  const { command, actor, payload } = envelope.data;

  const parsedPayload = parseCommandPayload(command, payload);

  if (!parsedPayload.ok) return response(parsedPayload.error, 400);

  const result = await dispatchPosCommand(
    asClient(),
    command,
    parsedPayload.data as Record<string, unknown>,
    actor,
  );

  return response(result.body, result.status);
};

export default defineLogicFunction({
  universalIdentifier: POS_COMMAND_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'pos-command-resolver',
  description:
    'App-only server resolver enforcing the POS command boundary from a verified internal signature',
  timeoutSeconds: 10,
  handler,
  serverRouteTriggerSettings: {
    forwardedRequestHeaders: ['x-mahabbat-signature'],
  },
});