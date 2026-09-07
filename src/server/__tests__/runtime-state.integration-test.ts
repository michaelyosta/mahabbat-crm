import { randomUUID } from 'node:crypto';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { describe, expect, it } from 'vitest';
import type { CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import { compareAndSetRuntimeState, readRuntimeState, type RuntimeState } from 'src/server/runtime-state';
import { queryAll } from 'src/server/query-all';

// Runs only under the disposable-target global setup. Exercises the real
// generated custom-object API and PostgreSQL uniqueness/version predicates.
describe('runtime state on the installed Twenty app', () => {
  it('converges concurrent creates and grants only one update of the same version', async () => {
    const client = new CoreApiClient() as unknown as CoreApiClientLike;
    const key = `integration-cas:${randomUUID()}`;
    const rows = await Promise.all(Array.from({ length: 5 }, () => readRuntimeState(client, key, { count: 0 })));
    expect(new Set(rows.map(row => row.id)).size).toBe(1);
    const writes = await Promise.all(rows.map(row => compareAndSetRuntimeState(client, row, { count: 1 })));
    expect(writes.filter(Boolean)).toHaveLength(1);
    const state = await readRuntimeState(client, key);
    expect(state.version).toBe(1);
    expect(JSON.parse(state.value)).toEqual({ count: 1 });
  });

  it('follows real API cursors across multiple pages of custom records', async () => {
    const client = new CoreApiClient() as unknown as CoreApiClientLike;
    const keys = Array.from({ length: 5 }, () => `integration-page:${randomUUID()}`);
    await Promise.all(keys.map(key => readRuntimeState(client, key)));
    const rows = await queryAll<RuntimeState>(client, 'mahabbatRuntimeStates', { first: 2, filter: { stateKey: { in: keys } } }, { id: true, stateKey: true, value: true, version: true });
    expect(rows.map(row => row.stateKey).sort()).toEqual(keys.sort());
  });
});
