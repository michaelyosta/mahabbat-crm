import type { CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';
import { readRuntimeState, compareAndSetRuntimeState } from 'src/server/runtime-state';

const KEY = 'pos-login-budget';
const WINDOW_MS = 60_000;
const LIMIT = 5;
type Budget = { windowStartedAt: number; count: number };

// One workspace-wide budget, shared by all resolvers and terminal IDs. Reserve
// before expensive PIN verification so concurrent failures cannot evade it.
export const reserveLoginAttempt = async (client: CoreApiClientLike, now = Date.now()): Promise<
  { ok: true; windowStartedAt: number } | { ok: false; retryAfterSeconds: number }
> => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = await readRuntimeState(client, KEY, { windowStartedAt: now, count: 0 });
    let budget = JSON.parse(state.value) as Budget;
    if (!Number.isSafeInteger(budget.windowStartedAt) || !Number.isSafeInteger(budget.count) || budget.count < 0) throw new Error('INVALID_LOGIN_BUDGET');
    if (now >= budget.windowStartedAt + WINDOW_MS) budget = { windowStartedAt: now, count: 0 };
    if (budget.count >= LIMIT) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((budget.windowStartedAt + WINDOW_MS - now) / 1000)) };
    if (await compareAndSetRuntimeState(client, state, { ...budget, count: budget.count + 1 })) return { ok: true, windowStartedAt: budget.windowStartedAt };
  }
  return { ok: false, retryAfterSeconds: 1 };
};

// Successful authentication releases only its own reservation, never failures
// from other clients. Crashed attempts conservatively count until window expiry.
export const releaseLoginAttempt = async (client: CoreApiClientLike, windowStartedAt: number): Promise<void> => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = await readRuntimeState(client, KEY);
    const budget = JSON.parse(state.value) as Budget;
    if (budget.windowStartedAt !== windowStartedAt || budget.count <= 0) return;
    if (await compareAndSetRuntimeState(client, state, { ...budget, count: budget.count - 1 })) return;
  }
};
