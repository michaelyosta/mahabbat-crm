import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const SCRIPTS_PATH = 'deploy/branding-overlay.mjs';

const INDEX_TEMPLATE = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Twenty</title>
    <meta property="og:title" content="Twenty" />
    <meta name="twitter:title" content="Twenty" />
    <meta property="og:image" content="https://raw.githubusercontent.com/twentyhq/twenty/main/docs/static/img/social-card.png" />
    <meta name="description" content="A modern open-source CRM" />
  </head>
</html>
`;

const MANIFEST_TEMPLATE = JSON.stringify({ short_name: 'Twenty', name: 'Twenty' }, null, 2);

const APP_JS_TEMPLATE = `function getDisplayName() { return "Twenty"; }
const token = "default:return"Twenty"";
`;

const tempDirs: string[] = [];

const makeFixture = (options?: {
  index?: string;
  manifest?: string;
  assets?: Record<string, string>;
}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'branding-'));
  tempDirs.push(dir);

  const front = path.join(dir, 'front');
  fs.mkdirSync(path.join(front, 'assets'), { recursive: true });

  fs.writeFileSync(
    path.join(front, 'index.html'),
    options?.index ?? INDEX_TEMPLATE,
  );
  fs.writeFileSync(
    path.join(front, 'manifest.json'),
    options?.manifest ?? MANIFEST_TEMPLATE,
  );

  for (const [name, content] of Object.entries(
    options?.assets ?? { 'app.abc.js': APP_JS_TEMPLATE },
  )) {
    fs.writeFileSync(path.join(path.join(front, 'assets'), name), content);
  }

  return front;
};

const runOverlay = (frontPath: string) =>
  spawnSync('node', [SCRIPTS_PATH], {
    encoding: 'utf8',
    env: { ...process.env, BRANDING_FRONT_PATH: frontPath },
  });

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('branding-overlay', () => {
  it('brands a complete fixture and exits 0', () => {
    const front = makeFixture();
    const result = runOverlay(front);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('branded 1/1 JS assets');

    const html = fs.readFileSync(path.join(front, 'index.html'), 'utf8');
    expect(html).toContain('<title>MAHABBAT CRM</title>');
    expect(html).toContain(
      '<meta property="og:title" content="MAHABBAT CRM" />',
    );
    expect(html).toContain(
      '<meta name="twitter:title" content="MAHABBAT CRM" />',
    );
    expect(html).toContain('MAHABBAT CRM — ресторанная CRM для Казахстана');
    expect(html).not.toContain('social-card.png');

    const manifest = JSON.parse(
      fs.readFileSync(path.join(front, 'manifest.json'), 'utf8'),
    );
    expect(manifest).toEqual({ short_name: 'MAHABBAT', name: 'MAHABBAT CRM' });

    const brandedAsset = fs.readFileSync(
      path.join(front, 'assets', 'app.abc.js'),
      'utf8',
    );
    expect(brandedAsset).toContain('default:return"MAHABBAT CRM"');
    expect(brandedAsset).not.toContain('default:return"Twenty"');
  });

  it('brands every JS asset containing the token', () => {
    const front = makeFixture({
      assets: {
        'app.abc.js': APP_JS_TEMPLATE,
        'vendor.xyz.js': `for (;;) { console.log('default:return"Twenty"'); }`,
      },
    });
    const result = runOverlay(front);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('branded 2/2 JS assets');
  });

  it('fails when a html target is missing', () => {
    const front = makeFixture({
      index: INDEX_TEMPLATE.replace('<title>Twenty</title>', ''),
    });
    const result = runOverlay(front);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('assertion failed');
    expect(result.stderr).toContain('<title>Twenty</title>');
  });

  it('fails when no JS asset carries the title token', () => {
    const front = makeFixture({
      assets: { 'plain.js': 'export const x = 1;' },
    });
    const result = runOverlay(front);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('assertion failed');
    expect(result.stderr).toContain('title token');
  });

  it('fails when index.html is missing', () => {
    const front = makeFixture();
    fs.rmSync(path.join(front, 'index.html'));
    const result = runOverlay(front);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('index.html');
  });

  it('fails when the assets directory has no JS files', () => {
    const front = makeFixture({
      assets: { 'style.css': 'body { color: red; }' },
    });
    const result = runOverlay(front);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no bundled JS assets found');
  });

  it('fails when the manifest is malformed', () => {
    const front = makeFixture({ manifest: '{ not json' });
    const result = runOverlay(front);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('manifest.json');
  });
});