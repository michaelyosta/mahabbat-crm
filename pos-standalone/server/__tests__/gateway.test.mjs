import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { test, before, after } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const GATEWAY = join(ROOT, 'pos-standalone', 'server', 'gateway.mjs');
const INTERNAL_SECRET = 'test-internal-secret';
const SERVICE_KEY = 'test-service-key';
const SESSION_TOKEN = 'session-token-for-gateway-test-1234567890';

const json = (res, status, body) => {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(text);
};
const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
};

const canonicalForTest = (value) => {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => canonicalForTest(item)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value;
    const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalForTest(record[key])}`).join(',')}}`;
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  return JSON.stringify(value) ?? 'null';
};

const listen = async (server) => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
};

const close = async (server) => {
  if (!server || !server.listening) return;
  server.close();
  await once(server, 'close');
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
};

let upstream;
let upstreamUrl;
let gateway;
let gatewayUrl;
let staticDir;
let gatewayOutput = '';
let gatewayError = '';
const state = {
  session: 'valid',
  role: 'WAITER',
  resolverCalls: [],
  graphqlCalls: 0,
  staffCalls: 0,
  restCalls: 0,
  handlerErrors: [],
};

before(async () => {
  staticDir = await mkdtemp(join(tmpdir(), 'mahabbat-pos-gateway-'));
  await writeFile(
    join(staticDir, 'index.html'),
    '<!doctype html><title>Mahabbat POS</title><div id="root"></div>',
  );

  upstream = createServer(async (req, res) => {
    try {
      const body = req.method === 'POST' ? await readBody(req) : null;

      if (req.url.startsWith('/webhooks/server/')) {
        const expected = `v1=${createHmac('sha256', INTERNAL_SECRET)
          .update(canonicalForTest(body), 'utf8')
          .digest('hex')}`;
        assert.equal(req.headers['x-mahabbat-signature'], expected);
        state.resolverCalls.push(body);

        if (body.command === 'authenticatePosStaff') {
          json(res, 201, {
            sessionId: 'session-record-1',
            sessionToken: SESSION_TOKEN,
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
            staff: { id: 'staff-a', displayName: 'Официант A', role: 'WAITER' },
          });
        } else {
          json(res, 200, { ok: true, command: body.command });
        }
        return;
      }

      if (req.url === '/graphql') {
        state.graphqlCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        const tokenHash = /tokenHash:\s*\{\s*eq:\s*"([a-f0-9]+)"/.exec(
          body.query,
        )?.[1];
        const node = state.session === 'missing'
          ? null
          : {
              id: 'session-record-1',
              sessionId: 'session-1',
              staffId: 'staff-a',
              staffRole: state.role,
              tokenHash,
              expiresAt:
                state.session === 'expired'
                  ? new Date(Date.now() - 1_000).toISOString()
                  : new Date(Date.now() + 900_000).toISOString(),
              revokedAt: state.session === 'revoked' ? new Date().toISOString() : null,
            };
        json(res, 200, { data: { posSessions: { edges: node ? [{ node }] : [] } } });
        return;
      }

      if (req.url.startsWith('/rest/posStaffs/')) {
        state.staffCalls += 1;
        json(res, 200, {
          data: { posStaff: { id: 'staff-a', staffRole: state.role, isActive: true } },
        });
        return;
      }

      if (req.url.startsWith('/rest/')) {
        state.restCalls += 1;
        assert.equal(req.headers.authorization, `Bearer ${SERVICE_KEY}`);
        const collection = req.url.split('/')[2].split('?')[0];
        const row = collection === 'posStaffs'
          ? { id: 'staff-1', displayName: 'Официант', pinHash: 'scrypt$leak', pinLookup: 'lookup-leak' }
          : { id: `${collection}-1` };
        json(res, 200, { data: { [collection]: [row] } });
        return;
      }

      json(res, 404, { code: 'NOT_FOUND' });
    } catch (error) {
      state.handlerErrors.push(error);
      json(res, 500, { code: 'TEST_UPSTREAM_FAILURE' });
    }
  });
  const upstreamPort = await listen(upstream);
  upstreamUrl = `http://127.0.0.1:${upstreamPort}`;

  const gatewayPort = await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });

  gateway = spawn(process.execPath, [GATEWAY], {
    cwd: ROOT,
    env: {
      ...process.env,
      POS_GATEWAY_PORT: String(gatewayPort),
      POS_GATEWAY_HOST: '127.0.0.1',
      POS_STATIC_DIR: staticDir,
      TWENTY_API_URL: upstreamUrl,
      TWENTY_API_KEY: SERVICE_KEY,
      MAHABBAT_INTERNAL_ROUTE_SECRET: INTERNAL_SECRET,
      POS_CORS_ORIGIN: '*',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  gateway.stdout.setEncoding('utf8');
  gateway.stderr.setEncoding('utf8');
  gateway.stdout.on('data', (chunk) => { gatewayOutput += chunk; });
  gateway.stderr.on('data', (chunk) => { gatewayError += chunk; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`gateway did not start\n${gatewayError}`)), 5_000);
    const onData = (chunk) => {
      if (chunk.includes('pos-gateway listening')) {
        clearTimeout(timer);
        gateway.stdout.off('data', onData);
        resolve();
      }
    };
    gateway.stdout.on('data', onData);
    gateway.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`gateway exited with ${code}\n${gatewayError}`));
    });
  });
  gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
});

after(async () => {
  if (gateway && !gateway.killed) gateway.kill();
  await close(upstream);
  await rm(staticDir, { recursive: true, force: true });
});

test('serves standalone root and health without CRM login', async () => {
  const root = await fetch(`${gatewayUrl}/`);
  assert.equal(root.status, 200);
  assert.match(await root.text(), /Mahabbat POS/);

  const health = await requestJson(`${gatewayUrl}/health`, {
    headers: { origin: 'http://terminal.test' },
  });
  assert.equal(health.response.status, 200);
  assert.deepEqual(health.body, { status: 'ok', service: 'pos-gateway' });
  assert.equal(health.response.headers.get('access-control-allow-origin'), '*');
  assert.equal(health.response.headers.get('cache-control'), 'no-store');
});

test('protects commands and rejects client identity fields', async () => {
  const noSession = await requestJson(`${gatewayUrl}/api/pos/command`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command: 'openShift', payload: {} }),
  });
  assert.equal(noSession.response.status, 401);
  assert.equal(noSession.body.code, 'POS_SESSION_REQUIRED');

  const spoof = await requestJson(`${gatewayUrl}/api/pos/command`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${SESSION_TOKEN}`,
    },
    body: JSON.stringify({
      command: 'openShift',
      payload: { staffId: 'staff-b', role: 'ADMIN' },
    }),
  });
  assert.equal(spoof.response.status, 400);
  assert.equal(spoof.body.code, 'INVALID_ACTOR');
});

test('authenticates by PIN and delegates the same command envelope', async () => {
  const auth = await requestJson(`${gatewayUrl}/api/pos/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '1234', terminalId: 'terminal-a', role: 'ADMIN' }),
  });
  assert.equal(auth.response.status, 201);
  assert.equal(auth.body.sessionToken, SESSION_TOKEN);
  assert.equal(state.resolverCalls.at(-1).payload.pin, '1234');
  assert.equal('role' in state.resolverCalls.at(-1).payload, false);

  const command = await requestJson(`${gatewayUrl}/api/pos/command`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${SESSION_TOKEN}`,
    },
    body: JSON.stringify({ command: 'openShift', payload: {} }),
  });
  assert.equal(command.response.status, 200);
  assert.equal(state.resolverCalls.at(-1).sessionToken, SESSION_TOKEN);
});

test('deduplicates concurrent session validation while proxying allowed REST data', async () => {
  const beforeGraphql = state.graphqlCalls;
  const beforeStaff = state.staffCalls;
  const responses = await Promise.all(
    Array.from({ length: 10 }, () => fetch(
      `${gatewayUrl}/api/pos/rest/posZones?limit=200`,
      { headers: { authorization: `Bearer ${SESSION_TOKEN}` } },
    )),
  );
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal(state.graphqlCalls - beforeGraphql, 1);
  assert.equal(state.staffCalls - beforeStaff, 1);
  assert.equal(state.restCalls >= 10, true);
});

test('denies malformed, expired, and revoked sessions', async () => {
  const malformed = await requestJson(`${gatewayUrl}/api/pos/rest/posZones`, {
    headers: { authorization: 'Bearer malformed' },
  });
  assert.equal(malformed.response.status, 401);
  assert.equal(malformed.body.code, 'POS_SESSION_REQUIRED');

  state.session = 'expired';
  const expired = await requestJson(`${gatewayUrl}/api/pos/rest/posZones`, {
    headers: { authorization: `Bearer ${SESSION_TOKEN}` },
  });
  assert.equal(expired.response.status, 401);
  assert.equal(expired.body.code, 'POS_SESSION_EXPIRED');

  state.session = 'revoked';
  const revoked = await requestJson(`${gatewayUrl}/api/pos/rest/posZones`, {
    headers: { authorization: `Bearer ${SESSION_TOKEN}` },
  });
  assert.equal(revoked.response.status, 401);
  assert.equal(revoked.body.code, 'POS_SESSION_EXPIRED');
  state.session = 'valid';
});

test('never exposes pinHash or pinLookup to an ADMIN POS client', async () => {
  state.role = 'ADMIN';
  const result = await requestJson(`${gatewayUrl}/api/pos/rest/posStaffs`, {
    headers: { authorization: `Bearer ${SESSION_TOKEN}` },
  });
  assert.equal(result.response.status, 200);
  const rows = result.body.data.posStaffs;
  assert.ok(Array.isArray(rows) && rows.length > 0);
  for (const row of rows) {
    assert.equal('pinHash' in row, false);
    assert.equal('pinLookup' in row, false);
  }
  state.role = 'WAITER';
});

test('does not log PIN or reusable session token', async () => {
  assert.equal(gatewayOutput.includes('1234'), false);
  assert.equal(gatewayOutput.includes(SESSION_TOKEN), false);
  assert.equal(gatewayOutput.includes(SERVICE_KEY), false);
});

test('returns an operational error when the backend is unavailable', async () => {
  await close(upstream);
  const auth = await requestJson(`${gatewayUrl}/api/pos/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '1234' }),
  });
  assert.equal(auth.response.status, 503);
  assert.equal(auth.body.message, 'Нет связи с сервером. Проверьте сеть и попробуйте снова.');
});
