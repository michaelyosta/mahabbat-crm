import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';
import {
  MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME,
  POS_COMMAND_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { asClient } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import { verifyInternalRouteBodySignature } from 'src/logic-functions/utils/mahabbat-internal-route-signature.util';
import {
  authenticatePosStaff,
  getAuthenticatedPosContext,
  refreshPosSessionActivity,
  revokePosSession,
} from 'src/pos/pos-auth';
import type { AuthenticatePosStaffPayload } from 'src/pos/pos-auth';
import {
  parseCommandPayload,
  parsePosCommandEnvelope,
} from 'src/pos/pos-command-input';
import { dispatchPosCommand } from 'src/pos/pos-command.dispatch';
import { POS_PRINTING_COMMANDS } from 'src/pos/pos-permissions';
import type { PosActor } from 'src/pos/pos-permissions';

const crmPrintingActor = async (
  client: ReturnType<typeof asClient>,
): Promise<PosActor | null> => {
  const result = (await client.query({
    posStaffs: {
      __args: { filter: { staffRole: { eq: 'ADMIN' }, isActive: { eq: true } }, first: 1 },
      edges: { node: { id: true, staffRole: true, isActive: true } },
    },
  })) as { posStaffs?: { edges?: Array<{ node?: { id?: string; staffRole?: string; isActive?: boolean } | null } | null> } };
  const staff = result.posStaffs?.edges?.map((edge) => edge?.node).find(
    (node) => node?.id && node.staffRole === 'ADMIN' && node.isActive !== false,
  );
  return staff?.id ? { staffId: staff.id, role: 'ADMIN' } : null;
};

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

  const { command, payload, sessionToken } = envelope.data;
  const crmWorkspaceAuthenticated =
    Boolean(event.body && typeof event.body === 'object' && (event.body as Record<string, unknown>).crmWorkspaceAuthenticated === true);

  const parsedPayload = parseCommandPayload(command, payload);

  if (!parsedPayload.ok) return response(parsedPayload.error, 400);

  const client = asClient();

  if (crmWorkspaceAuthenticated) {
    if (sessionToken !== undefined || !POS_PRINTING_COMMANDS.has(command)) {
      return response({ code: 'COMMAND_FORBIDDEN', message: 'Команда недоступна через CRM.' }, 403);
    }
    const actor = await crmPrintingActor(client);
    if (!actor) return response({ code: 'PRINT_ADMIN_NOT_CONFIGURED', message: 'Администратор печати не настроен.' }, 503);
    const result = await dispatchPosCommand(client, command, parsedPayload.data as Record<string, unknown>, actor);
    return response(result.body, result.status);
  }

  if (command === 'authenticatePosStaff') {
    const result = await authenticatePosStaff(
      client,
      parsedPayload.data as AuthenticatePosStaffPayload,
    );
    return response(result.body, result.status);
  }

  const authenticated = await getAuthenticatedPosContext(client, sessionToken);
  if (!authenticated.ok) return response(authenticated.result.body, authenticated.result.status);

  if (command === 'logoutPosStaff') {
    const result = await revokePosSession(client, authenticated.context);
    return response(result.body, result.status);
  }

  // A valid user command is POS activity. Extend the idle deadline before
  // dispatch so a command made near the old deadline cannot succeed and then
  // immediately eject the employee on the following data refresh. Background
  // REST polling goes through the standalone gateway and does not touch it.
  const activeContext = await refreshPosSessionActivity(
    client,
    authenticated.context,
  );

  if (command === 'refreshPosSession') {
    return response(
      {
        sessionId: activeContext.sessionId,
        expiresAt: activeContext.expiresAt,
      },
      200,
    );
  }

  const result = await dispatchPosCommand(
    client,
    command,
    parsedPayload.data as Record<string, unknown>,
    activeContext,
  );

  return response(result.body, result.status);
};

export default defineLogicFunction({
  universalIdentifier: POS_COMMAND_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'pos-command-resolver',
  description:
    'App-only server resolver enforcing the POS command boundary from a verified internal signature',
  // PIN authentication verifies every active staff hash with scrypt before it
  // can issue a session. Keep the server-route boundary above the measured
  // cold/warm verification window so normal runtime jitter is not returned as
  // SERVER_ROUTE_USER_UNCAUGHT_ERROR.
  timeoutSeconds: 20,
  handler,
  serverRouteTriggerSettings: {
    forwardedRequestHeaders: ['x-mahabbat-signature'],
  },
});
