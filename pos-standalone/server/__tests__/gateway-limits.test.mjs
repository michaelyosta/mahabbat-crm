// Mahabbat P1: gateway limits — CORS allowlist, 32KB body cap, token-bucket.
// Runs against the real gateway.mjs with a stub upstream. No HMAC assertions
// (FixP1LoyPrint owns signBody + gateway.test.mjs:77).
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { test, before, after } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const GATEWAY = join(ROOT, 'pos-standalone', 'server', 'gateway.mjs');

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

let upstream;
let upstreamUrl;
let gateway;
let gatewayUrl;
let staticDir;

const spawnGateway = async (extraEnv) =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => {
        const child = spawn(process.execPath, [GATEWAY], {
          cwd: ROOT,
          env: {
            ...process.env,
            POS_GATEWAY_PORT: String(port),
            POS_GATEWAY_HOST: '127.0.0.1',
            POS_STATIC_DIR: staticDir,
            TWENTY_API_URL: upstreamUrl,
            TWENTY_API_KEY: 'test-service-key',
            MAHABBAT_INTERNAL_ROUTE_SECRET: 'test-internal-secret',
            ...extraEnv,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        const timer = setTimeout(
          () => reject(new Error('gateway did not start')),
          5_000,
        );
        const onData = (chunk) => {
          if (chunk.includes('pos-gateway listening')) {
            clearTimeout(timer);
            child.stdout.off('data', onData);
            resolve({ child, url: `http://127.0.0.1:${port}` });
          }
        };
        child.stdout.on('data', onData);
        child.once('exit', (code) => {
          clearTimeout(timer);
          reject(new Error(`gateway exited with ${code}`));
        });
      });
    });
  });

before(async () => {
  staticDir = await mkdtemp(join(tmpdir(), 'mahabbat-pos-gateway-limits-'));
  await writeFile(
    join(staticDir, 'index.html'),
    '<!doctype html><title>Mahabbat POS</title><div id="root"></div>',
  );
  upstream = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
  const port = await listen(upstream);
  upstreamUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (gateway) gateway.kill();
  await close(upstream);
  await rm(staticDir, { recursive: true, force: true });
});

test('same-origin default sends no ACAO; allowlisted origin is reflected', async () => {
  ({ child: gateway, url: gatewayUrl } = await spawnGateway({
    POS_CORS_ORIGIN: 'https://pos.venue.local',
    POS_GATEWAY_BUCKET_CAPACITY: '1000',
  }));
  try {
    const same = await fetch(`${gatewayUrl}/health`);
    assert.equal(same.status, 200);
    assert.equal(same.headers.get('access-control-allow-origin'), null);

    const allowed = await fetch(`${gatewayUrl}/health`, {
      headers: { origin: 'https://pos.venue.local' },
    });
    assert.equal(
      allowed.headers.get('access-control-allow-origin'),
      'https://pos.venue.local',
    );

    const foreign = await fetch(`${gatewayUrl}/health`, {
      headers: { origin: 'https://evil.example' },
    });
    assert.equal(foreign.headers.get('access-control-allow-origin'), null);
  } finally {
    gateway.kill();
    gateway = null;
  }
});

test('POST body beyond 32KB is rejected with 413 before the resolver', async () => {
  ({ child: gateway, url: gatewayUrl } = await spawnGateway({
    POS_CORS_ORIGIN: 'https://pos.venue.local',
    POS_GATEWAY_BUCKET_CAPACITY: '1000',
  }));
  try {
    const big = await fetch(`${gatewayUrl}/api/pos/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin: '1'.repeat(40 * 1024) }),
    });
    assert.equal(big.status, 413);
    assert.equal((await big.json()).code, 'BODY_TOO_LARGE');
  } finally {
    gateway.kill();
    gateway = null;
  }
});

test('token bucket per IP+terminal rate-limits POST floods with 429', async () => {
  ({ child: gateway, url: gatewayUrl } = await spawnGateway({
    POS_CORS_ORIGIN: 'https://pos.venue.local',
    POS_GATEWAY_BUCKET_CAPACITY: '3',
    POS_GATEWAY_BUCKET_WINDOW_MS: '60000',
  }));
  try {
    const statuses = [];
    for (let i = 0; i < 5; i += 1) {
      const r = await fetch(`${gatewayUrl}/api/pos/command`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-pos-terminal': 'till-1',
        },
        body: JSON.stringify({}),
      });
      statuses.push(r.status);
      await r.text();
    }
    // First 3 pass the prefilter (401 = no session, from downstream logic);
    // the rest are cut by the bucket with 429 before any forward.
    assert.deepEqual(statuses.slice(0, 3), [401, 401, 401]);
    assert.deepEqual(statuses.slice(3), [429, 429]);
  } finally {
    gateway.kill();
    gateway = null;
  }
});
