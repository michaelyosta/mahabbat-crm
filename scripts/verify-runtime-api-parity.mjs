/**
 * Cheap post-deploy guard for the production LOCAL logic-function executor.
 *
 * It checks the generated SDK layer actually loaded by the server runtime,
 * rather than only checking the raw GraphQL schema or the host source tree.
 * The guard is intentionally read-only and never touches Docker volumes.
 */
import { spawnSync } from 'node:child_process';

const container = process.env.MAHABBAT_RUNTIME_CONTAINER?.trim() || 'mahabbat-twenty-server-1';
if (!/^[A-Za-z0-9_.-]+$/.test(container)) throw new Error('MAHABBAT_RUNTIME_CONTAINER contains unsupported characters');

const probe = `
set -eu
files=$(find /tmp/logic-function-executor-tmpdir/sdk -path "*/node_modules/twenty-client-sdk/dist/core/generated/index.mjs" -type f 2>/dev/null)
[ -n "$files" ]
count=0
for file in $files; do
  grep -q "inventoryStockLocations" "$file"
  count=$((count + 1))
done
printf "runtime-sdk-files=%s inventoryStockLocations=present\\n" "$count"
`;

const result = spawnSync('docker', ['exec', container, 'sh', '-lc', probe], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status !== 0) {
  const detail = String(result.stderr || result.stdout || '').trim();
  throw new Error(`production CoreApiClient SDK parity check failed${detail ? `: ${detail}` : ''}`);
}

process.stdout.write(`PASS ${String(result.stdout).trim()}\n`);
