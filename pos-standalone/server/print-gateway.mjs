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

const renderer = new EscPosRenderer();
const windowsTransport = new WindowsSpoolerPrinterTransport();
let polling = false;
let lastPollAt = null;
let lastError = null;
let dispatchedCount = 0;

const jsonResponse = (res, status, body) => {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(text);
};

const signBody = (body) => createHmac('sha256', INTERNAL_SECRET).update(JSON.stringify(body), 'utf8').digest('hex');

const verifyAgentRequest = ({ method, path, body, signature }) => {
  if (!INTERNAL_SECRET || typeof signature !== 'string') return false;
  const expected = signBody({ method, path, body });
  const provided = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
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

const reportJob = async (job, outcome, error) => {
  const body = {
    command: 'report',
    gatewayId: GATEWAY_ID,
    jobId: job.id,
    claimToken: job.claimToken,
    outcome,
    errorCode: error?.code ?? null,
    errorMessage: error ? String(error.message ?? error).slice(0, 512) : null,
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await resolverCall(body); } catch (reportError) {
      lastError = String(reportError?.message ?? reportError).slice(0, 512);
    }
  }
  return null;
};

const printJob = async (job) => {
  const printer = job.printer;
  if (!printer || printer.isActive === false) {
    const error = new Error('printer is not configured or inactive');
    error.code = 'PRINTER_NOT_CONFIGURED';
    await reportJob(job, 'FAILED', error);
    return;
  }

  let bytes;
  try {
    bytes = renderer.render({ ...job, profile: printer });
  } catch (error) {
    const renderError = error instanceof Error ? error : new Error(String(error));
    renderError.code = 'PAYLOAD_INVALID';
    await reportJob(job, 'FAILED', renderError);
    return;
  }

  const transport = printer.connectionType === 'WINDOWS_SPOOLER'
    ? windowsTransport
    : new RawTcpPrinterTransport({ connectTimeoutMs: CONNECT_TIMEOUT_MS });
  let lastTransportError = null;
  for (let attempt = 0; attempt <= AUTO_RETRY_LIMIT; attempt += 1) {
    try {
      await transport.send(bytes, printer);
      await reportPrinter(printer.id, 'REACHABLE');
      await reportJob(job, 'SENT', null);
      dispatchedCount += 1;
      return;
    } catch (error) {
      lastTransportError = error;
      await reportPrinter(printer.id, error.outcome === 'OUTCOME_UNKNOWN' ? 'UNKNOWN' : 'UNREACHABLE', error);
      if (!error.retryable || error.outcome === 'OUTCOME_UNKNOWN') {
        await reportJob(job, error.outcome, error);
        return;
      }
    }
  }
  await reportJob(job, 'FAILED', lastTransportError ?? new Error('printer connection failed before send'));
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
    jsonResponse(res, 200, { status: 'ok', service: 'print-gateway', mode: PRINT_GATEWAY_MODE, gatewayId: GATEWAY_ID, systemPrinterProvider: 'WINDOWS_SPOOLER', lastPollAt, dispatchedCount, lastError });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/system-printers') {
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
});

const stop = () => server.close(() => process.exit(0));
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
