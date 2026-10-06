// Экран «О кассе» (IN#2): GET /api/about отдаёт release/mahabbat-release.json
// строго как UTF-8. Регрессия наблюдения R10: чтение без явной кодировки
// превращает русский changelog в «С„Рё...» — тесты ниже красные на таком коде.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { test, before, after } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const GATEWAY = join(ROOT, 'pos-standalone', 'server', 'gateway.mjs');
const INTERNAL_SECRET = 'test-about-secret';
const SERVICE_KEY = 'test-about-service-key';
const SESSION_TOKEN = 'about-session-token-for-gateway-test-1234567890';

const CHANGELOG =
  '1.1.0-rc.1: финансы (три-state CAS, идемпотентность) + бэкап v2. 1.0.1: новый updater с сохранением данных.';

const MANIFEST = {
  mahabbatVersion: '1.1.0-rc.1',
  windowsFileVersion: '1.1.0.1',
  deploymentSha: '05cdd57',
  crmSha: 'c1252d1e53d8ea1aabde5f59dc09cf35ec394d91',
  backupVersion: 2,
  images: {
    branding: {
      immutableTag: 'sha-08dd2de9e097-branding',
      digest:
        'sha256:3497f4a3bb110876f92b15a44865a41845958eb9d9a2d064b70f72de91364b2e',
    },
    venue: {
      immutableTag: 'sha-08dd2de9e097-venue',
      digest:
        'sha256:204850428783a3e081c40e820fd36275b54f21f2d595f489178db27333cea532',
    },
  },
  changelogSource: CHANGELOG,
};

let dir;
let manifestPath;
let manifestBytes;
let upstream;
let gateway;
let gatewayUrl;

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

const spawnGateway = async (extraEnv) => {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.execPath, [GATEWAY], {
    cwd: ROOT,
    env: {
      ...process.env,
      POS_GATEWAY_PORT: String(port),
      POS_GATEWAY_HOST: '127.0.0.1',
      TWENTY_API_URL: `http://127.0.0.1:${upstream.address().port}`,
      TWENTY_API_KEY: SERVICE_KEY,
      MAHABBAT_INTERNAL_ROUTE_SECRET: INTERNAL_SECRET,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('gateway did not start')),
      5_000,
    );
    const onData = (chunk) => {
      if (chunk.includes('pos-gateway listening')) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`gateway exited with ${code}`));
    });
  });
  return { child, url: `http://127.0.0.1:${port}` };
};

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mahabbat-about-'));
  manifestPath = join(dir, 'mahabbat-release.json');
  // Явно UTF-8 байты: именно их обязан вернуть эндпоинт без искажений.
  await writeFile(manifestPath, JSON.stringify(MANIFEST, null, 2), 'utf8');
  manifestBytes = Buffer.from(JSON.stringify(MANIFEST, null, 2), 'utf8');

  upstream = createServer(async (req, res) => {
    if (req.url === '/graphql') {
      await readBody(req);
      json(res, 200, {
        data: {
          posSessions: {
            edges: [
              {
                node: {
                  id: 'session-record-1',
                  sessionId: 'session-1',
                  staffId: 'staff-a',
                  staffRole: 'WAITER',
                  tokenHash: 'x',
                  expiresAt: new Date(Date.now() + 900_000).toISOString(),
                  revokedAt: null,
                },
              },
            ],
          },
        },
      });
      return;
    }
    if (req.url.startsWith('/rest/')) {
      json(res, 200, {
        data: { posStaff: { id: 'staff-a', staffRole: 'WAITER', isActive: true } },
      });
      return;
    }
    json(res, 404, { code: 'NOT_FOUND' });
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');

  ({ child: gateway, url: gatewayUrl } = await spawnGateway({
    MAHABBAT_RELEASE_MANIFEST: manifestPath,
  }));
});

after(async () => {
  if (gateway && !gateway.killed) gateway.kill();
  if (upstream?.listening) {
    upstream.close();
    await once(upstream, 'close').catch(() => undefined);
  }
  await rm(dir, { recursive: true, force: true });
});

test('requires a session for /api/about', async () => {
  const res = await fetch(`${gatewayUrl}/api/about`);
  assert.equal(res.status, 401);
});

test('returns manifest values byte-for-byte, Cyrillic intact', async () => {
  const res = await fetch(`${gatewayUrl}/api/about`, {
    headers: { authorization: `Bearer ${SESSION_TOKEN}` },
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /charset=utf-8/);
  const body = await res.json();
  assert.equal(body.mahabbatVersion, MANIFEST.mahabbatVersion);
  assert.equal(body.windowsFileVersion, MANIFEST.windowsFileVersion);
  assert.equal(body.deploymentSha, MANIFEST.deploymentSha);
  assert.equal(body.crmSha, MANIFEST.crmSha);
  assert.equal(body.backupVersion, MANIFEST.backupVersion);
  assert.deepEqual(body.images, MANIFEST.images);
  // Побайтовое равенство changelog: любая неверная декодировка
  // (latin1/1251 вместо UTF-8) даёт «С„Рё...» и роняет это сравнение.
  assert.equal(body.changelogSource, CHANGELOG);
  assert.ok(!body.changelogSource.includes('Рё'));
  const expectedSha = createHash('sha256').update(manifestBytes).digest('hex');
  assert.equal(body.manifestSha256, expectedSha);
});

test('503 RELEASE_INFO_UNAVAILABLE when manifest is not configured', async () => {
  const { child, url } = await spawnGateway({});
  try {
    const res = await fetch(`${url}/api/about`, {
      headers: { authorization: `Bearer ${SESSION_TOKEN}` },
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.code, 'RELEASE_INFO_UNAVAILABLE');
  } finally {
    child.kill();
  }
});

test('503 RELEASE_INFO_UNAVAILABLE when manifest is corrupt', async () => {
  const broken = join(dir, 'broken-release.json');
  await writeFile(broken, '{ not json', 'utf8');
  const { child, url } = await spawnGateway({
    MAHABBAT_RELEASE_MANIFEST: broken,
  });
  try {
    const res = await fetch(`${url}/api/about`, {
      headers: { authorization: `Bearer ${SESSION_TOKEN}` },
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.code, 'RELEASE_INFO_UNAVAILABLE');
  } finally {
    child.kill();
  }
});
