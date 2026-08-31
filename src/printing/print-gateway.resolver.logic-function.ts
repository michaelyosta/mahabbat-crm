import { randomUUID } from 'node:crypto';

import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';

import { asClient } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import { verifyInternalRouteBodySignature } from 'src/logic-functions/utils/mahabbat-internal-route-signature.util';
import {
  MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME,
  PRINT_GATEWAY_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import {
  findPrintJobsForGateway,
  markGatewayRestartUnknown,
  refreshSourcePrintStatus,
  updatePrintJob,
  updatePrinterDevice,
  _internal,
  type PrintJobRecord,
} from 'src/printing/print-queue';

const PRINT_GATEWAY_LEASE_MS = 90_000;
const MAX_CLAIM_BATCH = 20;

type GatewayRequest = {
  command?: unknown;
  gatewayId?: unknown;
  limit?: unknown;
  jobId?: unknown;
  claimToken?: unknown;
  printerDeviceId?: unknown;
  outcome?: unknown;
  errorCode?: unknown;
  errorMessage?: unknown;
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const text = (value: unknown, max = 256): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, max) : null;
};

const gatewayId = (value: unknown): string | null => text(value, 128);

const error = (code: string, message: string, status = 400) =>
  response({ code, message }, status);

const asGatewayJob = async (
  client: Parameters<typeof updatePrintJob>[0],
  job: PrintJobRecord,
): Promise<Record<string, unknown>> => ({
  ...job,
  printer: job.printerDeviceId
    ? await _internal.findPrinter(client, job.printerDeviceId)
    : null,
});

const claim = async (
  client: Parameters<typeof updatePrintJob>[0],
  request: GatewayRequest,
) => {
  const id = gatewayId(request.gatewayId);
  if (!id) return error('INVALID_GATEWAY', 'gatewayId is required.');
  const requestedLimit = Number(request.limit ?? 8);
  const limit = Number.isSafeInteger(requestedLimit)
    ? Math.max(1, Math.min(MAX_CLAIM_BATCH, requestedLimit))
    : 8;

  // A process that disappears after claiming has no reliable way to prove
  // whether bytes reached the printer. Conservative recovery keeps the job
  // visible and marks it UNKNOWN instead of silently duplicating paper.
  await markGatewayRestartUnknown(client, PRINT_GATEWAY_LEASE_MS);
  const queued = (await findPrintJobsForGateway(client, 'QUEUED')).slice(0, limit);
  const jobs: Record<string, unknown>[] = [];

  for (const job of queued) {
    const claimToken = randomUUID();
    const attemptCount = (job.attemptCount ?? 0) + 1;
    const claimedAt = new Date().toISOString();
    const result = (await client.mutation({
      updatePosPrintJobs: {
        __args: {
          filter: { id: { eq: job.id }, status: { eq: 'QUEUED' } },
          data: {
            status: 'DISPATCHING',
            attemptCount,
            lastAttemptAt: claimedAt,
            claimToken,
            claimedAt,
            gatewayId: id,
          },
        },
        id: true,
      },
    })) as { updatePosPrintJobs?: Array<{ id?: string }> | { id?: string } | null };
    const raw = result.updatePosPrintJobs;
    const claimed = Array.isArray(raw)
      ? raw.some((row) => row?.id === job.id)
      : raw?.id === job.id;
    if (!claimed) continue;

    jobs.push(await asGatewayJob(client, {
      ...job,
      status: 'DISPATCHING',
      attemptCount,
      lastAttemptAt: claimedAt,
      claimToken,
      claimedAt,
      gatewayId: id,
    }));
  }

  return response({ jobs });
};

const report = async (
  client: Parameters<typeof updatePrintJob>[0],
  request: GatewayRequest,
) => {
  const jobId = text(request.jobId, 64);
  const claimToken = text(request.claimToken, 128);
  const id = gatewayId(request.gatewayId);
  const outcome = text(request.outcome, 32);
  if (!jobId || !claimToken || !id || !outcome) return error('INVALID_REPORT', 'jobId, claimToken, gatewayId and outcome are required.');
  if (!['SENT', 'CONFIRMED', 'FAILED', 'OUTCOME_UNKNOWN'].includes(outcome)) return error('INVALID_REPORT', 'Unsupported print outcome.');

  const job = await _internal.findPrintJob(client, jobId);
  if (!job) return error('PRINT_JOB_NOT_FOUND', 'Print job does not exist.');
  if (job.status !== 'DISPATCHING') {
    return response({ jobId: job.id, status: job.status, stale: true });
  }
  if (job.claimToken !== claimToken || job.gatewayId !== id) return error('CLAIM_MISMATCH', 'Print job is claimed by another gateway.', 409);

  const next = await updatePrintJob(client, job.id, {
    status: outcome,
    lastErrorCode: outcome === 'SENT' || outcome === 'CONFIRMED' ? null : text(request.errorCode, 96),
    lastErrorMessage: outcome === 'SENT' || outcome === 'CONFIRMED' ? null : text(request.errorMessage, 512),
    sentAt: outcome === 'SENT' || outcome === 'CONFIRMED' ? new Date().toISOString() : null,
    confirmedAt: outcome === 'CONFIRMED' ? new Date().toISOString() : null,
  });
  if (!next) return error('CONFLICT', 'Print job could not be updated.', 409);
  if (next.sourceType && next.sourceId) await refreshSourcePrintStatus(client, next.sourceType as 'KITCHEN_TICKET' | 'PRECHECK', next.sourceId);
  return response({ jobId: next.id, status: next.status });
};

const printerStatus = async (
  client: Parameters<typeof updatePrintJob>[0],
  request: GatewayRequest,
) => {
  const printerDeviceId = text(request.printerDeviceId, 64);
  const status = text(request.outcome, 32);
  if (!printerDeviceId || !status || !['CONFIGURED', 'REACHABLE', 'UNREACHABLE', 'UNKNOWN'].includes(status)) return error('INVALID_PRINTER_STATUS', 'printerDeviceId and a valid status are required.');
  const updated = await updatePrinterDevice(client, printerDeviceId, {
    status,
    ...(status === 'REACHABLE' ? { lastSeenAt: new Date().toISOString(), lastErrorCode: null, lastErrorMessage: null } : { lastErrorCode: text(request.errorCode, 96), lastErrorMessage: text(request.errorMessage, 512) }),
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return error('PRINTER_NOT_FOUND', 'Printer does not exist.');
  return response({ printerDeviceId: updated.id, status: updated.status });
};

export const handler = async (event: RoutePayload): Promise<Response> => {
  const secret = process.env[MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME];
  if (!secret || !verifyInternalRouteBodySignature({ body: event.body, signature: event.headers['x-mahabbat-signature'], secret })) {
    return error('INVALID_SIGNATURE', 'Invalid internal signature.', 403);
  }
  const request = (event.body ?? {}) as GatewayRequest;
  const client = asClient();
  switch (request.command) {
    case 'claim': return claim(client, request);
    case 'report': return report(client, request);
    case 'printerStatus': return printerStatus(client, request);
    case 'health': return response({ status: 'ok' });
    default: return error('INVALID_COMMAND', 'Unknown print gateway command.');
  }
};

export default defineLogicFunction({
  universalIdentifier: PRINT_GATEWAY_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'print-gateway-resolver',
  description: 'Authenticated local gateway boundary for durable ESC/POS print jobs',
  timeoutSeconds: 10,
  handler,
  serverRouteTriggerSettings: {
    forwardedRequestHeaders: ['x-mahabbat-signature'],
  },
});
