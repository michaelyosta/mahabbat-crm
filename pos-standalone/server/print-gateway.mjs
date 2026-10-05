#!/usr/bin/env node
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

import { EscPosRenderer } from './escpos.mjs';
import { RawTcpPrinterTransport } from './printer-transport.mjs';
import { listWindowsPrinters, WindowsSpoolerPrinterTransport } from './windows-printer-provider.mjs';

const PORT = Number(process.env.PRINT_GATEWAY_PORT ?? 3110);
const HOST = process.env.PRINT_GATEWAY_HOST ?? '127.0.0.1';
const TWENTY_API_URL = (process.env.TWENTY_API_URL ?? process.env.MAHABBAT_API_URL ?? '').replace(/\/+$/, '');
const INTERNAL_SECRET = process.env.MAHABBAT_INTERNAL_ROUTE_SECRET ?? '';
const PRINT_GATEWAY_MODE = String(process.env.PRINT_GATEWAY_MODE ?? 'LOCAL').trim().toUpperCase();
const ACCESS_CLIENT_ID = process.env.CLOUDFLARE_ACCESS_CLIENT_ID ?? '';
const ACCESS_CLIENT_SECRET = process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET ?? '';
const RESOLVER_ID = process.env.PRINT_GATEWAY_RESOLVER_ID ?? 'd4f3e7fb-8c05-4e26-8d94-5a0b1f3e7d44';
const GATEWAY_ID = (process.env.PRINT_GATEWAY_ID ?? `gateway-${process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? randomUUID()}`).slice(0, 128);
const POLL_MS = Math.max(500, Number(process.env.PRINT_GATEWAY_POLL_MS ?? 1500));
const CONNECT_TIMEOUT_MS = Math.max(500, Number(process.env.PRINT_GATEWAY_CONNECT_TIMEOUT_MS ?? 5000));
const AUTO_RETRY_LIMIT = Math.max(0, Math.min(3, Number(process.env.PRINT_GATEWAY_AUTO_RETRY_LIMIT ?? 2)));

if (!['LOCAL', 'REMOTE'].includes(PRINT_GATEWAY_MODE)) {
  throw new Error('PRINT_GATEWAY_MODE must be LOCAL or REMOTE');
}
if ((ACCESS_CLIENT_ID && !ACCESS_CLIENT_SECRET) || (!ACCESS_CLIENT_ID && ACCESS_CLIENT_SECRET)) {
  throw new Error('CLOUDFLARE_ACCESS_CLIENT_ID and CLOUDFLARE_ACCESS_CLIENT_SECRET must be provided together');
}

const HEARTBEAT_MS = Math.max(500, Math.min(POLL_MS, Number(process.env.PRINT_GATEWAY_HEARTBEAT_MS ?? 15_000)));
const renderer = new EscPosRenderer();
const windowsTransport = new WindowsSpoolerPrinterTransport();
let polling = false;
let lastPollAt = null;
let lastError = null;
let dispatchedCount = 0;
// DISPATCHING jobs whose lease this process owns. Heartbeats renew the lease
// while the gateway is alive; a crash between claim and send stops the
// heartbeat so the job can return to QUEUED, while a crash after send leaves
// the job UNKNOWN (bytes may have reached the printer).
const liveLeases = new Map();

const jsonResponse = (res, status, body) => {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(text);
};

const stableStringify = (value) => {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value;
    const keys = Object.keys(record).filter((key) => {
      const entry = record[key];
      return entry !== undefined && typeof entry !== 'function' && typeof entry !== 'symbol';
    }).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  return JSON.stringify(value) ?? 'null';
};
const hmacHex = (canonical, secret) => createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
const signBody = (body) => `v1=${hmacHex(stableStringify(body), INTERNAL_SECRET)}`;
const signatureCandidates = (body, secrets) => {
  const candidates = [];
  let legacy = null;
  try { legacy = JSON.stringify(body) ?? null; } catch { legacy = null; }
  for (const candidateSecret of secrets.filter((candidate) => typeof candidate === 'string' && candidate.length > 0)) {
    const hex = hmacHex(stableStringify(body), candidateSecret);
    candidates.push(`v1=${hex}`, hex);
    if (legacy !== null) {
      const legacyHex = hmacHex(legacy, candidateSecret);
      candidates.push(`v1=${legacyHex}`, legacyHex);
    }
  }
  return candidates;
};
// Rotation without downtime: MAHABBAT_INTERNAL_ROUTE_SECRET_PREVIOUS holds the
// outgoing secret during the grace window; verifiers accept either, signers
// always emit the primary (v1=<hex>).
const secondarySecrets = () => {
  const raw = process.env.MAHABBAT_INTERNAL_ROUTE_SECRET_PREVIOUS;
  return typeof raw === 'string' && raw.length > 0 ? [raw] : [];
};
const sameSignature = (left, right) => {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};
const verifyAgentRequest = ({ method, path, body, signature }) => {
  if (!INTERNAL_SECRET || typeof signature !== 'string') return false;
  return signatureCandidates({ method, path, body }, [INTERNAL_SECRET, ...secondarySecrets()]).some((candidate) => sameSignature(signature, candidate));
};
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_SYSTEM_PRINTERS = 30;
const rateBuckets = new Map();
const checkDiscoveryRate = (req) => {
  const now = Date.now();
  const ip = req.socket?.remoteAddress ?? 'unknown';
  const slot = rateBuckets.get(ip) ?? { count: 0, reset: now + RATE_WINDOW_MS };
  if (now > slot.reset) {
    slot.count = 0;
    slot.reset = now + RATE_WINDOW_MS;
  }
  slot.count += 1;
  rateBuckets.set(ip, slot);
  return slot.count <= RATE_MAX_SYSTEM_PRINTERS;
};

const resolverCall = async (body) => {
  if (!TWENTY_API_URL || !INTERNAL_SECRET) throw new Error('print gateway is not configured');
  const headers = {
    'content-type': 'application/json',
    'x-mahabbat-signature': signBody(body),
  };
  // Optional Cloudflare Access service-token headers are only used by the
  // restaurant-side remote gateway. They never enter a browser response.
  if (ACCESS_CLIENT_ID && ACCESS_CLIENT_SECRET) {
    headers['CF-Access-Client-Id'] = ACCESS_CLIENT_ID;
    headers['CF-Access-Client-Secret'] = ACCESS_CLIENT_SECRET;
  }
  const response = await fetch(`${TWENTY_API_URL}/webhooks/server/${RESOLVER_ID}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text }; }
  if (!response.ok) {
    const error = new Error(String(payload.message ?? payload.code ?? `resolver returned ${response.status}`));
    error.status = response.status;
    error.body = payload;
    throw error;
  }
  return payload;
};

const reportPrinter = async (printerDeviceId, status, error) => {
  if (!printerDeviceId) return;
  try {
    await resolverCall({
      command: 'printerStatus',
      gatewayId: GATEWAY_ID,
      printerDeviceId,
      outcome: status,
      errorCode: error?.code ?? null,
      errorMessage: status === 'REACHABLE' ? null : String(error?.message ?? 'Нет связи').slice(0, 512),
    });
  } catch (reportError) {
    lastError = String(reportError?.message ?? reportError).slice(0, 512);
  }
};

const reportJob = async (job, outcome, error, transportAttempts) => {
  const body = {
    command: 'report',
    gatewayId: GATEWAY_ID,
    jobId: job.id,
    claimToken: job.claimToken,
    outcome,
    errorCode: error?.code ?? null,
    errorMessage: error ? String(error.message ?? error).slice(0, 512) : null,
    ...(Number.isSafeInteger(transportAttempts) ? { transportAttempts } : {}),
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await resolverCall(body); } catch (reportError) {
      lastError = String(reportError?.message ?? reportError).slice(0, 512);
    }
  }
  return null;
};

// Renew the DISPATCHING lease for jobs this process is actively printing.
// A crashed gateway stops heartbeating; the resolver can then tell a
// never-sent job (back to QUEUED) from a possibly-sent one (UNKNOWN).
const heartbeatOnce = async () => {
  if (liveLeases.size === 0) return;
  for (const [jobId, lease] of [...liveLeases]) {
    try {
      await resolverCall({ command: 'heartbeat', gatewayId: GATEWAY_ID, jobId, claimToken: lease.claimToken });
    } catch (error) {
      lastError = String(error?.message ?? error).slice(0, 512);
    }
  }
};

const trackLease = (job) => {
  if (job?.id && job?.claimToken) liveLeases.set(job.id, { claimToken: job.claimToken, sent: false });
};

const markLeaseSent = (job) => {
  const lease = liveLeases.get(job?.id);
  if (lease) lease.sent = true;
};

const releaseLease = (job) => {
  liveLeases.delete(job?.id);
};

const printJob = async (job) => {
  const printer = job.printer;
  // Crash before send: the job never left this process, so report FAILED with
  // a retryable code instead of leaving it in DISPATCHING forever.
  const preSendFailure = async (message, code) => {
    const error = new Error(message);
    error.code = code;
    error.outcome = 'FAILED';
    error.retryable = true;
    releaseLease(job);
    await reportJob(job, 'FAILED', error);
  };
  if (!printer || printer.isActive === false) {
    await preSendFailure('printer is not configured or inactive', 'PRINTER_NOT_CONFIGURED');
    return;
  }

  let bytes;
  try {
    bytes = renderer.render({ ...job, profile: printer });
  } catch (error) {
    const renderError = error instanceof Error ? error : new Error(String(error));
    renderError.code = 'PAYLOAD_INVALID';
    renderError.outcome = 'FAILED';
    renderError.retryable = false;
    releaseLease(job);
    await reportJob(job, 'FAILED', renderError);
    return;
  }

  trackLease(job);
  const transport = printer.connectionType === 'WINDOWS_SPOOLER'
    ? windowsTransport
    : new RawTcpPrinterTransport({ connectTimeoutMs: CONNECT_TIMEOUT_MS });
  let lastTransportError = null;
  for (let attempt = 0; attempt <= AUTO_RETRY_LIMIT; attempt += 1) {
    // attemptCount = claim/lease generations (resolver-owned). transportAttempts
    // counts physical bytes-on-wire tries and travels with the report so the
    // CRM row distinguishes "claimed 3 times" from "sent 3 times".
    const transportAttempts = (Number(job.transportAttempts) || 0) + attempt + 1;
    try {
      await transport.send(bytes, printer);
      markLeaseSent(job);
      await reportPrinter(printer.id, 'REACHABLE');
      releaseLease(job);
      await reportJob(job, 'SENT', null, transportAttempts);
      dispatchedCount += 1;
      return;
    } catch (error) {
      lastTransportError = error;
      await reportPrinter(printer.id, error?.outcome === 'OUTCOME_UNKNOWN' ? 'UNKNOWN' : 'UNREACHABLE', error);
      const outcome = error?.outcome ?? 'FAILED';
      if (!error?.retryable || outcome === 'OUTCOME_UNKNOWN') {
        releaseLease(job);
        await reportJob(job, outcome === 'OUTCOME_UNKNOWN' ? 'OUTCOME_UNKNOWN' : 'FAILED', error, transportAttempts);
        return;
      }
    }
  }
  releaseLease(job);
  await reportJob(job, 'FAILED', lastTransportError ?? Object.assign(new Error('printer connection failed before send'), { code: 'CONNECTION_FAILED_BEFORE_SEND', outcome: 'FAILED', retryable: true }), (Number(job.transportAttempts) || 0) + AUTO_RETRY_LIMIT + 1);
};
const pollOnce = async () => {
  if (polling) return;
  polling = true;
  lastPollAt = new Date().toISOString();
  try {
    const payload = await resolverCall({ command: 'claim', gatewayId: GATEWAY_ID, limit: 8 });
    for (const job of payload.jobs ?? []) await printJob(job);
  } catch (error) {
    lastError = String(error?.message ?? error).slice(0, 512);
  } finally {
    polling = false;
  }
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    // Trimmed: presence only. Poll timestamps, error text and dispatch
    // counters stay in process logs, never on an unauthenticated GET.
    jsonResponse(res, 200, { status: 'ok', service: 'print-gateway', mode: PRINT_GATEWAY_MODE });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/system-printers') {
    if (!checkDiscoveryRate(req)) {
      jsonResponse(res, 429, { code: 'RATE_LIMITED', message: 'Too many discovery requests.' });
      return;
    }
    const body = null;
    if (!verifyAgentRequest({ method: req.method, path: url.pathname, body, signature: req.headers['x-mahabbat-signature'] })) {
      jsonResponse(res, 403, { code: 'INVALID_SIGNATURE', message: 'Invalid print gateway signature.' });
      return;
    }
    try {
      const printers = await listWindowsPrinters();
      jsonResponse(res, 200, { provider: 'WINDOWS_SPOOLER', discoveredAt: new Date().toISOString(), printers });
    } catch (error) {
      jsonResponse(res, 503, { code: error?.code ?? 'WINDOWS_SPOOLER_UNAVAILABLE', message: 'Windows printer discovery is unavailable.' });
    }
    return;
  }
  if (req.method !== 'GET') {
    jsonResponse(res, 405, { code: 'METHOD_NOT_ALLOWED' });
    return;
  }
  jsonResponse(res, 404, { code: 'NOT_FOUND' });
});

server.listen(PORT, HOST, () => {
  console.log(JSON.stringify({ msg: 'print-gateway listening', mode: PRINT_GATEWAY_MODE, host: HOST, port: PORT, gatewayId: GATEWAY_ID, apiUrl: TWENTY_API_URL || '(missing)' }));
  void pollOnce();
  setInterval(() => void pollOnce(), POLL_MS);
  setInterval(() => void heartbeatOnce(), HEARTBEAT_MS).unref?.();
});

const stop = () => server.close(() => process.exit(0));
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

export const _internal = { heartbeatOnce, liveLeases, trackLease, markLeaseSent, releaseLease };
