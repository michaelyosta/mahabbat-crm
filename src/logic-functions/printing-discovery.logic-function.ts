import { defineLogicFunction } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';

import {
  MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME,
  PRINTING_DISCOVERY_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { signInternalRouteBody } from 'src/logic-functions/utils/mahabbat-internal-route-signature.util';

const response = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const handler = async (): Promise<Response> => {
  const secret = process.env[MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME];
  const gatewayUrl = (process.env.MAHABBAT_PRINT_GATEWAY_URL ?? 'http://host.docker.internal:3110').replace(/\/+$/, '');
  if (!secret) return response({ code: 'PRINT_GATEWAY_NOT_CONFIGURED', message: 'Печатный шлюз не настроен.' }, 503);

  const body = null;
  try {
    const delegated = await fetch(`${gatewayUrl}/system-printers`, {
      method: 'GET',
      headers: { 'x-mahabbat-signature': signInternalRouteBody({ method: 'GET', path: '/system-printers', body }, secret) },
    });
    const text = await delegated.text();
    let payload: unknown = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
    if (!delegated.ok) return response({ code: 'PRINT_DISCOVERY_UNAVAILABLE', message: 'Список системных принтеров недоступен.' }, 503);
    return response(payload, 200);
  } catch {
    return response({ code: 'PRINT_DISCOVERY_UNAVAILABLE', message: 'Список системных принтеров недоступен.' }, 503);
  }
};

export default defineLogicFunction({
  universalIdentifier: PRINTING_DISCOVERY_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'printing-system-discovery',
  description: 'Authenticated backend proxy for host Windows printer discovery',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/printing/system-printers',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
