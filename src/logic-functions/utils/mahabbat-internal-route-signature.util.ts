import { createHmac, timingSafeEqual } from 'crypto';

import { MAHABBAT_INTERNAL_ROUTE_PREVIOUS_SECRET_ENV_VAR_NAME } from 'src/constants/universal-identifiers';

// Versioned HMAC envelope for every internal route signature
// (loyalty/inventory/POS resolvers, print gateway, setup wizard bridge).
//
// Wire format: `v1=<hex(hmac-sha256(stableStringify(body)))>`.
// Rotation is independent from the workspace API key: the operator keeps the
// previous route secret in MAHABBAT_INTERNAL_ROUTE_SECRET_PREVIOUS while the
// new primary propagates, and verifiers accept both during the grace window.
// Legacy unprefixed signatures (hex of the canonical body, or hex of the
// historical plain JSON.stringify body) are accepted read-only so a mixed
// fleet of old/new signers never fails closed during rollout. Signers always
// emit the current versioned format.
export const INTERNAL_ROUTE_SIGNATURE_VERSION = 'v1';

// Canonical stable-stringify: object keys are sorted recursively, so two
// processes holding the same payload sign identical bytes regardless of key
// insertion order. Array order is preserved (it is semantically significant).
// Semantics mirror JSON.stringify for everything JSON supports: undefined,
// function and symbol values are dropped from objects and become null in
// arrays; NaN/Infinity become null.
export const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => {
        const entry = record[key];
        return (
          entry !== undefined &&
          typeof entry !== 'function' &&
          typeof entry !== 'symbol'
        );
      })
      .sort();

    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }

  if (typeof value === 'string') return JSON.stringify(value);

  if (typeof value === 'number') {
    return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  }

  if (typeof value === 'bigint') {
    throw new TypeError('Cannot canonicalize a bigint route body.');
  }

  // boolean
  return JSON.stringify(value) ?? 'null';
};

export const signInternalRouteBody = (body: unknown, secret: string): string => {
  const hex = createHmac('sha256', secret)
    .update(stableStringify(body), 'utf8')
    .digest('hex');

  return `${INTERNAL_ROUTE_SIGNATURE_VERSION}=${hex}`;
};

const signatureCandidates = (
  body: unknown,
  secrets: string[],
): string[] => {
  const canonical = stableStringify(body);
  let legacy: string | null = null;
  try {
    legacy = JSON.stringify(body) ?? null;
  } catch {
    legacy = null;
  }

  const candidates: string[] = [];
  for (const candidateSecret of secrets) {
    const hex = createHmac('sha256', candidateSecret)
      .update(canonical, 'utf8')
      .digest('hex');
    candidates.push(`${INTERNAL_ROUTE_SIGNATURE_VERSION}=${hex}`);
    // Grace: unprefixed hex of the same canonical body.
    candidates.push(hex);

    if (legacy !== null) {
      const legacyHex = createHmac('sha256', candidateSecret)
        .update(legacy, 'utf8')
        .digest('hex');
      candidates.push(`${INTERNAL_ROUTE_SIGNATURE_VERSION}=${legacyHex}`);
      candidates.push(legacyHex);
    }
  }

  return candidates;
};

export const readInternalRouteSecondarySecrets = (): string[] => {
  const raw = process.env[MAHABBAT_INTERNAL_ROUTE_PREVIOUS_SECRET_ENV_VAR_NAME];

  return typeof raw === 'string' && raw.length > 0 ? [raw] : [];
};

export const verifyInternalRouteBodySignature = ({
  body,
  signature,
  secret,
  secondarySecrets,
}: {
  body: unknown;
  signature: string | undefined;
  secret: string;
  secondarySecrets?: Array<string | undefined | null>;
}): boolean => {
  if (!signature) return false;

  const secrets = [secret, ...(secondarySecrets ?? [])].filter(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.length > 0,
  );

  if (secrets.length === 0) return false;

  const providedBuffer = Buffer.from(signature, 'utf8');

  return signatureCandidates(body, secrets).some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, 'utf8');

    return (
      providedBuffer.length === candidateBuffer.length &&
      timingSafeEqual(providedBuffer, candidateBuffer)
    );
  });
};
