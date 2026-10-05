import { randomUUID } from 'node:crypto';

import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';

import { asClient } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import { readInternalRouteSecondarySecrets, verifyInternalRouteBodySignature } from 'src/logic-functions/utils/mahabbat-internal-route-signature.util';
import {
  MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME,
  PRINT_GATEWAY_RESOLVER_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import {
  findPrintJobsForGateway,
  reconcileDispatchingJobs,
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
  transportAttempts?: unknown;
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

const isCancellationJob = (job: PrintJobRecord): boolean =>
  job.documentType === 'KITCHEN_CANCEL' ||
  (typeof job.payloadSnapshot === 'string' && job.payloadSnapshot.includes('"ticketType":"CANCELLATION"'));

export const compareClaimPriority = (left: PrintJobRecord, right: PrintJobRecord): number => {
  const leftCancel = isCancellationJob(left);
  const rightCancel = isCancellationJob(right);
  if (leftCancel !== rightCancel) return leftCancel ? -1 : 1;

  const time = String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? ''));
  if (time !== 0) return time;

  return String(left.id).localeCompare(String(right.id));
};
const asGatewayJob = async (
  client: Parameters<typeof updatePrintJob>[0],
  job: PrintJobRecord,
): Promise<Record<string, unknown>> => {
  const livePrinter = job.printerDeviceId
    ? await _internal.findPrinter(client, job.printerDeviceId)
    : null;
  let snapshot: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(job.payloadSnapshot ?? '{}') as Record<string, unknown>;
    if (parsed.printerSnapshot && typeof parsed.printerSnapshot === 'object') {
      snapshot = parsed.printerSnapshot as Record<string, unknown>;
    }
  } catch {
    snapshot = null;
  }
  return {
    ...job,
    // New jobs carry an immutable destination/profile snapshot. The live
    // record is only the fallback for historical jobs created before this
    // snapshot existed.
    printer: snapshot && livePrinter ? { ...livePrinter, ...snapshot, id: livePrinter.id } : livePrinter,
  };
};

const claim = async (
  client: Parameters<typeof updatePrintJob>[0],
  request: GatewayRequest,
) => {
  const id = gatewayId(request.gatewayId);
  if (!id) return error('INVALID_GATEWAY', 'Укажите gatewayId.');
  const requestedLimit = Number(request.limit ?? 8);
  const limit = Number.isSafeInteger(requestedLimit)
    ? Math.max(1, Math.min(MAX_CLAIM_BATCH, requestedLimit))
    : 8;

  // Reconcile-before-UNKNOWN: a crashed gateway stops its heartbeat, so a
  // stale DISPATCHING lease means either "never sent" (back to QUEUED) or
  // "bytes may have left" (UNKNOWN, never silently reprinted).
  await reconcileDispatchingJobs(client, PRINT_GATEWAY_LEASE_MS);
  // FIFO by creation: oldest queued jobs go first so a kitchen+bar ticket
  // group prints in order. CANCELLATION documents jump the queue: a voided
  // dish must reach the kitchen before the next NEW_ITEMS ticket for the
  // same table, otherwise the station cooks what the hall just cancelled.
  const queued = (await findPrintJobsForGateway(client, 'QUEUED')).sort(compareClaimPriority).slice(0, limit);
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

const heartbeat = async (
  client: Parameters<typeof updatePrintJob>[0],
  request: GatewayRequest,
) => {
  const jobId = text(request.jobId, 64);
  const claimToken = text(request.claimToken, 128);
  const id = gatewayId(request.gatewayId);
  if (!jobId || !claimToken || !id) return error('INVALID_HEARTBEAT', 'Укажите jobId, claimToken и gatewayId.');
  const job = await _internal.findPrintJob(client, jobId);
  if (!job) return error('PRINT_JOB_NOT_FOUND', 'Задание печати не найдено.');
  if (job.status !== 'DISPATCHING') {
    return response({ jobId: job.id, status: job.status, stale: true });
  }
  if (job.claimToken !== claimToken || job.gatewayId !== id) return error('CLAIM_MISMATCH', 'Задание печати уже захвачено другим шлюзом.', 409);
  const next = await updatePrintJob(client, job.id, { lastAttemptAt: new Date().toISOString() });
  if (!next) return error('CONFLICT', 'Не удалось обновить задание печати.', 409);
  return response({ jobId: next.id, status: next.status });
};

const report = async (
  client: Parameters<typeof updatePrintJob>[0],
  request: GatewayRequest,
) => {
  const jobId = text(request.jobId, 64);
  const claimToken = text(request.claimToken, 128);
  const id = gatewayId(request.gatewayId);
  const outcome = text(request.outcome, 32);
  if (!jobId || !claimToken || !id || !outcome) return error('INVALID_REPORT', 'Укажите jobId, claimToken, gatewayId и outcome.');
  if (!['SENT', 'FAILED', 'OUTCOME_UNKNOWN'].includes(outcome)) return error('INVALID_REPORT', 'Неподдерживаемый результат печати.');

  const job = await _internal.findPrintJob(client, jobId);
  if (!job) return error('PRINT_JOB_NOT_FOUND', 'Задание печати не найдено.');
  if (job.status !== 'DISPATCHING') {
    return response({ jobId: job.id, status: job.status, stale: true });
  }
  if (job.claimToken !== claimToken || job.gatewayId !== id) return error('CLAIM_MISMATCH', 'Задание печати уже захвачено другим шлюзом.', 409);
  const reportedTransportAttempts = Number(request.transportAttempts);
  const transportAttempts = Number.isSafeInteger(reportedTransportAttempts) && reportedTransportAttempts >= 0
    ? Math.max(job.transportAttempts ?? 0, reportedTransportAttempts)
    : (job.transportAttempts ?? 0) + 1;
  const next = await updatePrintJob(client, job.id, {
    status: outcome,
    transportAttempts,
    lastErrorCode: outcome === 'SENT' ? null : text(request.errorCode, 96),
    lastErrorMessage: outcome === 'SENT' ? null : text(request.errorMessage, 512),
    sentAt: outcome === 'SENT' ? new Date().toISOString() : null,
    confirmedAt: null,
  });
  if (!next) return error('CONFLICT', 'Не удалось обновить задание печати.', 409);
  if ((next.sourceType === 'KITCHEN_TICKET' || next.sourceType === 'PRECHECK') && next.sourceId) {
    await refreshSourcePrintStatus(client, next.sourceType, next.sourceId);
  }
  return response({ jobId: next.id, status: next.status });
};

const printerStatus = async (
  client: Parameters<typeof updatePrintJob>[0],
  request: GatewayRequest,
) => {
  const printerDeviceId = text(request.printerDeviceId, 64);
  const status = text(request.outcome, 32);
  if (!printerDeviceId || !status || !['CONFIGURED', 'REACHABLE', 'UNREACHABLE', 'UNKNOWN'].includes(status)) return error('INVALID_PRINTER_STATUS', 'Укажите printerDeviceId и корректный статус.');
  const updated = await updatePrinterDevice(client, printerDeviceId, {
    status,
    ...(status === 'REACHABLE' ? { lastSeenAt: new Date().toISOString(), lastErrorCode: null, lastErrorMessage: null } : { lastErrorCode: text(request.errorCode, 96), lastErrorMessage: text(request.errorMessage, 512) }),
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return error('PRINTER_NOT_FOUND', 'Принтер не найден.');
  return response({ printerDeviceId: updated.id, status: updated.status });
};

export const handler = async (event: RoutePayload): Promise<Response> => {
  const secret = process.env[MAHABBAT_INTERNAL_ROUTE_SECRET_ENV_VAR_NAME];
  const signatureOk = secret ? verifyInternalRouteBodySignature({ body: event.body, signature: event.headers['x-mahabbat-signature'], secret, secondarySecrets: readInternalRouteSecondarySecrets() }) : false;
  if (!secret || !signatureOk) {
    return error('INVALID_SIGNATURE', 'Неверная внутренняя подпись.', 403);
  }
  const request = (event.body ?? {}) as GatewayRequest;
  const client = asClient();
  switch (request.command) {
    case 'claim': return claim(client, request);
    case 'heartbeat': return heartbeat(client, request);
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
