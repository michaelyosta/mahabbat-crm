/**
 * Pure identity contract for customer/order/reservation imports.
 *
 * Identity is the pair (provider, externalId) and nothing else. Phone number is
 * intentionally not part of the identity key: two sources may report the same
 * phone for two distinct identities, and that must remain allowed.
 */

export type IdentityProvider = string;
export type ExternalId = string;
export type IdentityKey = string;

export type Identity = {
  provider: IdentityProvider;
  externalId: ExternalId;
};

export type ParsedIdentity = Identity & {
  key: IdentityKey;
};

export type IdentityParseErrorCode =
  | 'INVALID_BODY'
  | 'INVALID_PROVIDER'
  | 'INVALID_EXTERNAL_ID';

export type IdentityParseError = {
  code: IdentityParseErrorCode;
  message: string;
  field?: 'provider' | 'externalId';
};

export type IdentityParseResult =
  | {
      ok: true;
      data: ParsedIdentity;
    }
  | {
      ok: false;
      error: IdentityParseError;
    };

export const MAX_PROVIDER_LENGTH = 64;
export const MAX_EXTERNAL_ID_LENGTH = 255;

/**
 * Providers are machine codes: uppercase ASCII after trimming. The charset is
 * deliberately narrow so the composite key `provider::externalId` can never be
 * ambiguous.
 */
const PROVIDER_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;

/**
 * Trims and uppercases a provider, or returns null when the value is missing,
 * not a string, or falls outside the canonical provider charset.
 */
export const normalizeProvider = (
  input: unknown,
): IdentityProvider | null => {
  if (typeof input !== 'string') {
    return null;
  }

  const provider = input.trim().toUpperCase();

  if (
    provider.length === 0 ||
    provider.length > MAX_PROVIDER_LENGTH ||
    !PROVIDER_PATTERN.test(provider)
  ) {
    return null;
  }

  return provider;
};

/**
 * Trims an external id while preserving case and internal characters: external
 * ids are provider-defined and must not be case-folded or re-formatted by the
 * importer. Control characters are rejected because they make storage and
 * logging ambiguous.
 */
export const normalizeExternalId = (input: unknown): ExternalId | null => {
  if (typeof input !== 'string') {
    return null;
  }

  const externalId = input.trim();

  if (
    externalId.length === 0 ||
    externalId.length > MAX_EXTERNAL_ID_LENGTH ||
    /[\u0000-\u001F\u007F]/.test(externalId)
  ) {
    return null;
  }

  return externalId;
};

export const buildIdentityKey = (
  provider: IdentityProvider,
  externalId: ExternalId,
): IdentityKey => `${provider}::${externalId}`;

const invalid = (
  code: IdentityParseErrorCode,
  message: string,
  field?: IdentityParseError['field'],
): IdentityParseResult => ({ ok: false, error: { code, message, field } });

/**
 * Parses and canonicalizes an identity. Both fields must be present and
 * valid; malformed identities are rejected with a typed error instead of
 * being silently coerced.
 */
export const parseIdentity = (input: unknown): IdentityParseResult => {
  if (typeof input !== 'object' || input === null) {
    return invalid(
      'INVALID_BODY',
      'Identity must be an object with provider and externalId',
    );
  }

  const { provider, externalId } = input as Record<string, unknown>;

  const normalizedProvider = normalizeProvider(provider);

  if (normalizedProvider === null) {
    return invalid(
      'INVALID_PROVIDER',
      'provider must be 1-64 characters matching A-Z, 0-9, "_", "." or "-" after trimming and uppercasing',
      'provider',
    );
  }

  const normalizedExternalId = normalizeExternalId(externalId);

  if (normalizedExternalId === null) {
    return invalid(
      'INVALID_EXTERNAL_ID',
      'externalId must be a non-empty string of at most 255 characters without control characters after trimming',
      'externalId',
    );
  }

  return {
    ok: true,
    data: {
      provider: normalizedProvider,
      externalId: normalizedExternalId,
      key: buildIdentityKey(normalizedProvider, normalizedExternalId),
    },
  };
};

export const isSameIdentity = (left: unknown, right: unknown): boolean => {
  const parsedLeft = parseIdentity(left);
  const parsedRight = parseIdentity(right);

  return (
    parsedLeft.ok && parsedRight.ok && parsedLeft.data.key === parsedRight.data.key
  );
};

export type IdentityFieldConflictReason = 'PROTECTED_FIELD_CHANGED';

export type IdentityFieldConflict = {
  field: string;
  existing: unknown;
  incoming: unknown;
  reason: IdentityFieldConflictReason;
};

export type IdentityFieldUpdatePlan = {
  updates: Record<string, unknown>;
  conflicts: IdentityFieldConflict[];
  ignoredFields: string[];
};

export type PlanIdentityFieldsUpdateInput = {
  existing: Record<string, unknown>;
  incoming: Record<string, unknown>;
  sourceOwnedFields: readonly string[];
};

/**
 * Explicit conflict policy for a matched identity:
 *
 * - Fields listed in `sourceOwnedFields` may be overwritten by the incoming
 *   source record (update is staged, never applied here).
 * - Any other field that differs is a protected-field conflict and is never
 *   silently overwritten.
 * - Equal values are a no-op; `undefined` incoming values are ignored.
 *
 * The caller decides what to do with conflicts (fail the import, quarantine,
 * or escalate); this function never mutates anything.
 */
export const planIdentityFieldsUpdate = ({
  existing,
  incoming,
  sourceOwnedFields,
}: PlanIdentityFieldsUpdateInput): IdentityFieldUpdatePlan => {
  const sourceOwned = new Set(
    sourceOwnedFields.filter(
      (field) => typeof field === 'string' && field.trim().length > 0,
    ),
  );

  const updates: Record<string, unknown> = {};
  const conflicts: IdentityFieldConflict[] = [];
  const ignoredFields: string[] = [];

  for (const field of Object.keys(incoming)) {
    const incomingValue = incoming[field];

    if (incomingValue === undefined) {
      ignoredFields.push(field);
      continue;
    }

    const existingValue = existing[field];

    if (Object.is(existingValue, incomingValue)) {
      continue;
    }

    if (sourceOwned.has(field)) {
      updates[field] = incomingValue;
      continue;
    }

    conflicts.push({
      field,
      existing: existingValue,
      incoming: incomingValue,
      reason: 'PROTECTED_FIELD_CHANGED',
    });
  }

  return { updates, conflicts, ignoredFields };
};
