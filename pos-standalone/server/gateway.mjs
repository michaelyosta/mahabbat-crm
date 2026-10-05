#!/usr/bin/env node
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.POS_GATEWAY_PORT ?? process.env.PORT ?? 3100);
const HOST = process.env.POS_GATEWAY_HOST ?? '0.0.0.0';
const TWENTY_API_URL = (process.env.TWENTY_API_URL ?? process.env.MAHABBAT_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const SERVICE_API_KEY = process.env.TWENTY_API_KEY ?? process.env.MAHABBAT_API_KEY ?? process.env.TWENTY_APP_ACCESS_TOKEN ?? '';
const INTERNAL_SECRET = process.env.MAHABBAT_INTERNAL_ROUTE_SECRET ?? '';
const RESOLVER_ID = process.env.POS_COMMAND_RESOLVER_ID ?? '54be0dfa-2fd6-45bc-be93-6ba4c64a21d9';
const STATIC_DIR = process.env.POS_STATIC_DIR ? path.resolve(process.env.POS_STATIC_DIR) : null;
// Mahabbat P1: CORS allowlist. Empty/unset POS_CORS_ORIGIN = same-origin
// only (no ACAO header). Explicit origins are reflected; '*' is back-compat
// only (warns in logs) — venue setup writes empty, see FixP1Secrets half.
const CORS_ORIGINS = (process.env.POS_CORS_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const ALLOWED_COLLECTIONS = new Set([
  'posZones',
  'posTables',
  'posOrders',
  'posOrderGuests',
  'posOrderLines',
  'posMenuItems',
  'posShifts',
  'posReservations',
  'posStopListEntries',
  'posKitchenTickets',
  'posKitchenTicketLines',
  'posPrechecks',
  'posPayments',
  'posPaymentMethods',
  'posPrepayments',
  'posStaffs',
]);

const hashSessionToken = (token) => createHash('sha256').update(token, 'utf8').digest('hex');
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
const signBody = (body, secret) => `v1=${createHmac('sha256', secret ?? INTERNAL_SECRET).update(stableStringify(body), 'utf8').digest('hex')}`;

// A POS bootstrap loads several collections concurrently. Share only the
// in-flight validation promise, then discard it immediately. This removes
// duplicate GraphQL/staff lookups without making revocation stale.
const sessionValidationInFlight = new Map();

// Mahabbat P1: 32KB body cap on POST (413 beyond). Sized for PIN/auth +
// command envelopes; POS payloads are small by construction.
const GATEWAY_MAX_BODY_BYTES = Number(process.env.POS_GATEWAY_MAX_BODY_BYTES ?? 32 * 1024);

// Mahabbat P1: token-bucket prefilter per IP+terminal, before any resolver
// forward. Failing closed on shape errors; upstream POS throttles remain.
const GATEWAY_BUCKET_CAPACITY = Number(process.env.POS_GATEWAY_BUCKET_CAPACITY ?? 30);
const GATEWAY_BUCKET_WINDOW_MS = Number(process.env.POS_GATEWAY_BUCKET_WINDOW_MS ?? 60 * 1000);
const gatewayBuckets = new Map();
const gatewayPrefilterAllows = (ip, terminalId) => {
  const now = Date.now();
  const key = `${ip ?? 'unknown'}|${String(terminalId ?? '').slice(0, 128) || '-'}`;
  const bucket = gatewayBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= GATEWAY_BUCKET_WINDOW_MS) {
    gatewayBuckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  bucket.count += 1;
  if (bucket.count > GATEWAY_BUCKET_CAPACITY) return false;
  return true;
};
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of gatewayBuckets) {
    if (now - bucket.windowStart >= GATEWAY_BUCKET_WINDOW_MS * 2) gatewayBuckets.delete(key);
  }
}, GATEWAY_BUCKET_WINDOW_MS).unref?.();

const readJsonBody = async (req, { maxBytes = GATEWAY_MAX_BODY_BYTES } = {}) => {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > maxBytes) return { tooLarge: true };
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return null; }
};

// Mahabbat P1: CORS reflector. Same-origin (no/unknown Origin) sends no ACAO.
// Explicit '*' is back-compat only and warns once at startup; venue setup
// writes an explicit allowlist or empty (see FixP1Secrets half).
const corsHeaders = (origin) => {
  if (CORS_ORIGINS.includes('*')) return { 'access-control-allow-origin': '*' };
  if (!origin || !CORS_ORIGINS.includes(origin)) return { vary: 'Origin' };
  return { 'access-control-allow-origin': origin, vary: 'Origin' };
};

const sendJson = (res, status, body, extraHeaders = {}, origin) => {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...corsHeaders(origin),
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    ...extraHeaders,
  });
  res.end(text);
};

const bearerToken = (req) => {
  const auth = req.headers.authorization ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1].trim() : null;
};

const forwardToResolver = async (envelope) => {
  if (!INTERNAL_SECRET) throw new Error('MAHABBAT_INTERNAL_ROUTE_SECRET not configured');
  if (!TWENTY_API_URL) throw new Error('TWENTY_API_URL not configured');
  const sig = signBody(envelope, INTERNAL_SECRET);
  const url = `${TWENTY_API_URL}/webhooks/server/${RESOLVER_ID}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-mahabbat-signature': sig,
    },
    body: JSON.stringify(envelope),
  });
  const text = await r.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  return { status: r.status, body };
};

const GATEWAY_ERROR_MAP = {
  POS_SESSION_REQUIRED: { status: 401, code: 'POS_SESSION_REQUIRED', message: 'Требуется действующая POS-сессия.' },
  POS_SESSION_INVALID: { status: 401, code: 'POS_SESSION_INVALID', message: 'POS-сессия недействительна.' },
  POS_SESSION_EXPIRED: { status: 401, code: 'POS_SESSION_EXPIRED', message: 'POS-сессия истекла или отозвана.' },
  INVALID_COMMAND: { status: 400, code: 'INVALID_COMMAND', message: 'Неизвестная команда.' },
  INVALID_ACTOR: { status: 400, code: 'INVALID_ACTOR', message: 'actor is server-derived' },
  INVALID_COLLECTION: { status: 400, code: 'INVALID_COLLECTION', message: 'Неизвестная коллекция.' },
};
const gatewayError = (code, fallbackMessage) => {
  const mapped = GATEWAY_ERROR_MAP[code];
  if (mapped) return { status: mapped.status, body: { code: mapped.code, message: mapped.message } };
  return { status: 502, body: { code: 'ROUTE_UNAVAILABLE', message: fallbackMessage ?? 'Нет связи с сервером' } };
};

// Validate POS session via service GraphQL: lookup posSessions by tokenHash, then staff.
const validateSessionUncached = async (token) => {
  if (!token || typeof token !== 'string' || token.length < 32 || token.length > 256) return { ok: false, code: 'POS_SESSION_REQUIRED' };
  if (!SERVICE_API_KEY) return { ok: false, code: 'POS_SESSION_REQUIRED', message: 'gateway not configured' };
  const tokenHash = hashSessionToken(token);
  try {
    const gr = await fetch(`${TWENTY_API_URL}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${SERVICE_API_KEY}` },
      body: JSON.stringify({
        query: `query { posSessions(filter: { tokenHash: { eq: "${tokenHash}" } }) { edges { node { id sessionId staffId staffRole tokenHash expiresAt revokedAt } } } }`,
      }),
    });
    if (!gr.ok) return { ok: false, code: 'POS_SESSION_INVALID' };
    const gj = await gr.json();
    const node = gj.data?.posSessions?.edges?.[0]?.node;
    if (!node?.staffId || !node?.sessionId || !node?.expiresAt) return { ok: false, code: 'POS_SESSION_INVALID' };
    if (node.revokedAt || Date.parse(node.expiresAt) <= Date.now()) return { ok: false, code: 'POS_SESSION_EXPIRED' };
    const sr = await fetch(`${TWENTY_API_URL}/rest/posStaffs/${encodeURIComponent(node.staffId)}`, {
      headers: { Authorization: `Bearer ${SERVICE_API_KEY}` },
    });
    if (!sr.ok) return { ok: false, code: 'POS_SESSION_INVALID' };
    const sj = await sr.json();
    const staff = sj.data?.posStaff ?? sj.data;
    if (!staff || staff.isActive === false || staff.staffRole !== node.staffRole) return { ok: false, code: 'POS_SESSION_INVALID' };
    return { ok: true, session: node };
  } catch {
    return { ok: false, code: 'POS_SESSION_INVALID' };
  }
};

const validateSession = async (token) => {
  if (!token || typeof token !== 'string' || token.length < 32 || token.length > 256) {
    return { ok: false, code: 'POS_SESSION_REQUIRED' };
  }

  const tokenHash = hashSessionToken(token);
  const inFlight = sessionValidationInFlight.get(tokenHash);
  if (inFlight) return inFlight;

  const promise = validateSessionUncached(token);
  sessionValidationInFlight.set(tokenHash, promise);
  try {
    return await promise;
  } finally {
    if (sessionValidationInFlight.get(tokenHash) === promise) {
      sessionValidationInFlight.delete(tokenHash);
    }
  }
};

const proxyRest = async (collection, search, token) => {
  const authOk = await validateSession(token);
  if (!authOk.ok) return { status: 401, body: { code: authOk.code ?? 'POS_SESSION_INVALID', message: 'Требуется действующая POS-сессия.' } };
  if (collection === 'posStaffs' && authOk.session?.staffRole !== 'ADMIN') {
    // posStaffs read is ADMIN-only via gateway (matches front's admin guard), but allow read for non-admin as empty to preserve behavior
    // The front expects [] for non-admin; we return empty instead of 403 to keep UX same.
    return { status: 200, body: { data: { posStaffs: [] } } };
  }
  const url = `${TWENTY_API_URL}/rest/${encodeURIComponent(collection)}${search ? `?${search}` : ''}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${SERVICE_API_KEY}` } });
  const text = await r.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  // Authentication verifiers must never reach a browser, not even an ADMIN one.
  if (collection === 'posStaffs' && body && typeof body === 'object' && body.data) {
    const scrub = (row) => {
      if (!row || typeof row !== 'object') return row;
      const { pinHash, pinLookup, ...safe } = row;
      return safe;
    };
    if (Array.isArray(body.data.posStaffs)) body.data.posStaffs = body.data.posStaffs.map(scrub);
    else if (body.data.posStaff) body.data.posStaff = scrub(body.data.posStaff);
  }
  return { status: r.status, body };
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const serveStatic = async (req, res) => {
  if (!STATIC_DIR) return false;
  let p = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (p === '/') p = '/index.html';
  // Never shadow API
  if (p.startsWith('/api/')) return false;
  if (p === '/health') return false;
  const file = path.resolve(STATIC_DIR, path.normalize(p).replace(/^[/\\]+/, ''));
  const relative = path.relative(STATIC_DIR, file);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;
  try {
    const data = await readFile(file);
    const ext = path.extname(file);
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': p === '/index.html' ? 'no-cache' : 'public, max-age=300',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    });
    res.end(data);
    return true;
  } catch {
    // SPA fallback: serve index.html for unknown routes that accept html
    if (req.headers.accept?.includes('text/html')) {
      try {
        const data = await readFile(path.join(STATIC_DIR, 'index.html'));
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
        res.end(data);
        return true;
      } catch {}
    }
    return false;
  }
};

const handler = async (req, res) => {
  const requestId = randomUUID();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const started = Date.now();

  const log = (status, extra = {}) => {
    const entry = JSON.stringify({ requestId, method: req.method, path: url.pathname, status, ms: Date.now() - started, ...extra });
    if (status >= 500) console.error(entry);
    else console.log(entry);
  };
  const send = (status, body, extraHeaders = {}) =>
    sendJson(res, status, body, extraHeaders, req.headers.origin);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      ...corsHeaders(req.headers.origin),
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-max-age': '86400',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    // Trimmed on purpose: gateway presence only. Queue depth, resolver state
    // and printer bindings never leave this host over an unauthenticated GET.
    send(200, { status: 'ok', service: 'pos-gateway' });
    log(200);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/pos/auth') {
    // Mahabbat P1: token-bucket prefilter per IP+terminal, before resolver.
    const preTerminal = req.headers['x-pos-terminal'] ?? undefined;
    if (!gatewayPrefilterAllows(req.socket?.remoteAddress, preTerminal)) {
      send(429, { code: 'GATEWAY_RATE_LIMITED', message: 'Слишком много запросов. Повторите позже.' }, { 'retry-after': '60' });
      log(429, { command: 'authenticatePosStaff', prefilter: true });
      return;
    }
    const body = await readJsonBody(req);
    if (body?.tooLarge) {
      send(413, { code: 'BODY_TOO_LARGE', message: 'Тело запроса превышает 32KB.' });
      log(413, { command: 'authenticatePosStaff' });
      return;
    }
    if (!body || typeof body.pin !== 'string') {
      send(400, { code: 'INVALID_POS_CREDENTIALS', message: 'Введите PIN' });
      log(400, { command: 'authenticatePosStaff' });
      return;
    }
    // Never log raw PIN or token. Log only presence.
    const envelope = { command: 'authenticatePosStaff', payload: { pin: body.pin, terminalId: body.terminalId ?? 'touch-pos' } };
    try {
      const { status, body: respBody } = await forwardToResolver(envelope);
      // Do not log token; strip it before logging
      const hasToken = Boolean(respBody?.sessionToken);
      send(status, respBody);
      log(status, { command: 'authenticatePosStaff', hasToken });
    } catch (e) {
      send(503, { code: 'ROUTE_UNAVAILABLE', message: 'Нет связи с сервером. Проверьте сеть и попробуйте снова.' });
      log(503, { command: 'authenticatePosStaff', error: String(e).slice(0, 200) });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/pos/command') {
    // Mahabbat P1: prefilter BEFORE auth/session logic — floods never reach
    // the resolver or the session validators.
    const cmdTerminal =
      req.headers['x-pos-terminal'] ??
      req.headers['x-terminal-id'] ??
      undefined;
    if (!gatewayPrefilterAllows(req.socket?.remoteAddress, cmdTerminal)) {
      send(429, { code: 'GATEWAY_RATE_LIMITED', message: 'Слишком много запросов. Повторите позже.' }, { 'retry-after': '60' });
      log(429, { prefilter: true });
      return;
    }
    const token = bearerToken(req);
    if (!token) {
      const missing = gatewayError('POS_SESSION_REQUIRED');
      send(missing.status, missing.body);
      log(401, { command: 'unknown' });
      return;
    }
    const body = await readJsonBody(req);
    if (body?.tooLarge) {
      send(413, { code: 'BODY_TOO_LARGE', message: 'Тело запроса превышает 32KB.' });
      log(413);
      return;
    }
    if (!body || typeof body.command !== 'string') {
      const invalid = gatewayError('INVALID_COMMAND');
      send(invalid.status, { ...invalid.body, message: 'command required' });
      log(400);
      return;
    }
    if (['role', 'staffId', 'actorStaffId', 'actor', 'ownerStaffId'].some((k) => body.payload && typeof body.payload === 'object' && k in body.payload)) {
      const invalidActor = gatewayError('INVALID_ACTOR');
      send(invalidActor.status, invalidActor.body);
      log(400, { command: body.command });
      return;
    }
    const envelope = { command: body.command, payload: body.payload ?? {}, sessionToken: token };
    try {
      const { status, body: respBody } = await forwardToResolver(envelope);
      send(status, respBody);
      log(status, { command: body.command });
    } catch (e) {
      send(503, { code: 'ROUTE_UNAVAILABLE', message: 'Нет связи с сервером' });
      log(503, { command: body.command, error: String(e).slice(0, 200) });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/pos/rest/')) {
    const token = bearerToken(req);
    if (!token) {
      const missing = gatewayError('POS_SESSION_REQUIRED');
      send(missing.status, missing.body);
      log(401, { path: url.pathname });
      return;
    }
    const collection = decodeURIComponent(url.pathname.replace('/api/pos/rest/', '').split('/')[0]);
    if (!ALLOWED_COLLECTIONS.has(collection)) {
      const invalid = gatewayError('INVALID_COLLECTION');
      send(invalid.status, { ...invalid.body, message: `Unknown collection ${collection}` });
      log(400);
      return;
    }
    const search = url.searchParams.toString();
    try {
      const { status, body: respBody } = await proxyRest(collection, search, token);
      send(status, respBody);
      log(status, { collection });
    } catch (e) {
      send(503, { code: 'ROUTE_UNAVAILABLE', message: 'Нет связи с сервером' });
      log(503, { collection, error: String(e).slice(0, 200) });
    }
    return;
  }

  // Static
  if (req.method === 'GET') {
    const served = await serveStatic(req, res);
    if (served) {
      log(200, { static: url.pathname });
      return;
    }
    // SPA fallback must never serve index.html to an API-shaped path: an
    // unknown /api/* route is a machine error and stays JSON 404 so the POS
    // front can distinguish "no route" from "offline HTML".
    if (url.pathname.startsWith('/api/')) {
      send(404, { code: 'NOT_FOUND', message: 'Not found' });
      log(404);
      return;
    }
  }

  send(404, { code: 'NOT_FOUND', message: 'Not found' });
  log(404);
};

const server = createServer((req, res) => {
  handler(req, res).catch((e) => {
    console.error(JSON.stringify({ error: String(e).slice(0, 1000) }));
    if (!res.headersSent) sendJson(res, 500, { code: 'INTERNAL', message: 'Internal error' }, {}, req.headers.origin);
  });
});

server.listen(PORT, HOST, () => {
  if (CORS_ORIGINS.includes('*')) {
    console.error(JSON.stringify({ msg: 'pos-gateway CORS wildcard enabled (back-compat only); set POS_CORS_ORIGIN to an explicit allowlist or empty' }));
  }
  console.log(JSON.stringify({ msg: 'pos-gateway listening', host: HOST, port: PORT, apiUrl: TWENTY_API_URL, resolver: RESOLVER_ID, staticDir: STATIC_DIR ?? '(none)' }));
});
