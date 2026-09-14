import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';

const ROOT = process.cwd();
const GATEWAY = join(ROOT, 'pos-standalone', 'server', 'print-gateway.mjs');
const INTERNAL_SECRET = 'remote-gateway-test-secret';
const ACCESS_CLIENT_ID = 'remote-access-client-id';
const ACCESS_CLIENT_SECRET = 'remote-access-client-secret';

const listen = async (server) => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
};

const close = async (server) => {
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
};

const freePort = async () => {
  const probe = createServer();
  const port = await listen(probe);
  await close(probe);
  return port;
};

test('remote print gateway polls the home resolver with HMAC and optional Access headers', async () => {
  const requests = [];
  const upstream = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString('utf8');
    const body = bodyText ? JSON.parse(bodyText) : null;
    requests.push({ req, body, signature: req.headers['x-mahabbat-signature'] });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ jobs: [] }));
  });
  const upstreamPort = await listen(upstream);
  const gatewayPort = await freePort();
  const gateway = spawn(process.env.MAHABBAT_NODE_BINARY ?? process.execPath, [GATEWAY], {
    cwd: ROOT,
    env: {
      ...process.env,
      PRINT_GATEWAY_MODE: 'REMOTE',
      PRINT_GATEWAY_HOST: '127.0.0.1',
      PRINT_GATEWAY_PORT: String(gatewayPort),
      PRINT_GATEWAY_POLL_MS: '500',
      PRINT_GATEWAY_ID: 'restaurant-gateway-test',
      TWENTY_API_URL: `http://127.0.0.1:${upstreamPort}`,
      MAHABBAT_INTERNAL_ROUTE_SECRET: INTERNAL_SECRET,
      CLOUDFLARE_ACCESS_CLIENT_ID: ACCESS_CLIENT_ID,
      CLOUDFLARE_ACCESS_CLIENT_SECRET: ACCESS_CLIENT_SECRET,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let errorOutput = '';
  gateway.stdout.setEncoding('utf8');
  gateway.stderr.setEncoding('utf8');
  gateway.stdout.on('data', (chunk) => { output += chunk; });
  gateway.stderr.on('data', (chunk) => { errorOutput += chunk; });

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`gateway did not start\n${errorOutput}`)), 5_000);
      const onData = (chunk) => {
        if (chunk.includes('print-gateway listening')) {
          clearTimeout(timer);
          gateway.stdout.off('data', onData);
          resolve();
        }
      };
      gateway.stdout.on('data', onData);
      gateway.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`gateway exited with ${code}\n${errorOutput}`));
      });
    });

    const deadline = Date.now() + 5_000;
    while (requests.length === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(requests.length > 0, `no resolver request observed; output=${output}; error=${errorOutput}`);
    const request = requests[0];
    const expectedSignature = createHmac('sha256', INTERNAL_SECRET).update(JSON.stringify(request.body), 'utf8').digest('hex');
    assert.equal(request.body.command, 'claim');
    assert.equal(request.body.gatewayId, 'restaurant-gateway-test');
    assert.equal(request.signature, expectedSignature);
    assert.equal(request.req.headers['cf-access-client-id'], ACCESS_CLIENT_ID);
    assert.equal(request.req.headers['cf-access-client-secret'], ACCESS_CLIENT_SECRET);

    const health = await fetch(`http://127.0.0.1:${gatewayPort}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).mode, 'REMOTE');
  } finally {
    gateway.kill();
    await close(upstream);
  }
});
