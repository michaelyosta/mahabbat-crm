#!/usr/bin/env node
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

import { EscPosRenderer } from './escpos.mjs';
import { RawTcpPrinterTransport } from './printer-transport.mjs';

const PORT = Number(process.env.PRINT_GATEWAY_PORT ?? 3110);
const HOST = process.env.PRINT_GATEWAY_HOST ?? '127.0.0.1';
const TWENTY_API_URL = (process.env.TWENTY_API_URL ?? process.env.MAHABBAT_API_URL ?? '').replace(/\/+$/, '');
const INTERNAL_SECRET = process.env.MAHABBAT_INTERNAL_ROUTE_SECRET ?? '';
const RESOLVER_ID = process.env.PRINT_GATEWAY_RESOLVER_ID ?? 'd4f3e7fb-8c05-4e26-8d94-5a0b1f3e7d44';
const GATEWAY_ID = (process.env.PRINT_GATEWAY_ID ?? `gateway-${process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? randomUUID()}`).slice(0, 128);
const POLL_MS = Math.max(500, Number(process.env.PRINT_GATEWAY_POLL_MS ?? 1500));
const CONNECT_TIMEOUT_MS = Math.max(500, Number(process.env.PRINT_GATEWAY_CONNECT_TIMEOUT_MS ?? 5000));
const AUTO_RETRY_LIMIT = Math.max(0, Math.min(3, Number(process.env.PRINT_GATEWAY_AUTO_RETRY_LIMIT ?? 2)));

const renderer = new EscPosRenderer();
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

const resolverCall = async (body) => {
  if (!TWENTY_API_URL || !INTERNAL_SECRET) throw new Error('print gateway is not configured');
  const response = await fetch(`${TWENTY_API_URL}/webhooks/server/${RESOLVER_ID}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mahabbat-signature': signBody(body) },
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

  const transport = new RawTcpPrinterTransport({ connectTimeoutMs: CONNECT_TIMEOUT_MS });
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
    jsonResponse(res, 200, { status: 'ok', service: 'print-gateway', gatewayId: GATEWAY_ID, lastPollAt, dispatchedCount, lastError });
    return;
  }
  if (req.method !== 'GET') {
    jsonResponse(res, 405, { code: 'METHOD_NOT_ALLOWED' });
    return;
  }
  jsonResponse(res, 404, { code: 'NOT_FOUND' });
});

server.listen(PORT, HOST, () => {
  console.log(JSON.stringify({ msg: 'print-gateway listening', host: HOST, port: PORT, gatewayId: GATEWAY_ID, apiUrl: TWENTY_API_URL || '(missing)' }));
  void pollOnce();
  setInterval(() => void pollOnce(), POLL_MS);
});

const stop = () => server.close(() => process.exit(0));
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
