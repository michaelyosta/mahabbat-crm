export const DISPOSABLE_TEST_TARGETS = [
  'http://localhost:2020',
  'http://127.0.0.1:2020',
  'http://localhost:2021',
  'http://127.0.0.1:2021',
] as const;

export const TEST_TARGET_ALLOW_ENV = 'TWENTY_APP_TEST_ALLOW_URLS';

export function normalizeTestTarget(apiUrl: string): string {
  return apiUrl.trim().replace(/\/+$/, '');
}

export function isAllowedTestTarget(apiUrl: string): boolean {
  const normalized = normalizeTestTarget(apiUrl);

  if ((DISPOSABLE_TEST_TARGETS as readonly string[]).includes(normalized)) {
    return true;
  }

  const extraTargets = (process.env[TEST_TARGET_ALLOW_ENV] ?? '')
    .split(',')
    .map(normalizeTestTarget)
    .filter((target) => target.length > 0);

  return extraTargets.includes(normalized);
}

export function assertAllowedTestTarget(apiUrl: string): void {
  if (isAllowedTestTarget(apiUrl)) {
    return;
  }

  throw new Error(
    `Fail-closed: refusing to sync/uninstall against disallowed target ${apiUrl}. ` +
      `Only disposable local dev servers (${DISPOSABLE_TEST_TARGETS.join(', ')}) are allowed. ` +
      `Opt into additional targets via the ${TEST_TARGET_ALLOW_ENV} env var.`,
  );
}