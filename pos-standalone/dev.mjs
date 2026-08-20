#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const gateway = spawn(process.execPath, [join(root, 'pos-standalone', 'server', 'gateway.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

const yarnCommand = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
const web = spawn(yarnCommand, ['pos:web:dev'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

let shuttingDown = false;
const stop = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!gateway.killed) gateway.kill();
  if (!web.killed) web.kill();
  process.exitCode = code;
};

gateway.once('exit', (code) => stop(code ?? 1));
web.once('exit', (code) => stop(code ?? 1));
process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
