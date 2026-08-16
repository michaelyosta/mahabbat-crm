import {
  normalizeExternalIdentity,
  type ExternalIdentityInput,
  type NormalizedExternalIdentity,
} from './external-identity';
import { planIdentityFieldsUpdate } from './identity-contract';

export type ImportRecord = ExternalIdentityInput & {
  id?: string;
  [field: string]: unknown;
};

export type ImportPolicy = {
  sourceOwnedFields: readonly string[];
  protectedFields: readonly string[];
};

export type ImportDecision =
  | {
      kind: 'create';
      identity: NormalizedExternalIdentity;
      record: Record<string, unknown>;
    }
  | {
      kind: 'update';
      identity: NormalizedExternalIdentity;
      patch: Record<string, unknown>;
    }
  | {
      kind: 'noop';
      identity: NormalizedExternalIdentity;
    }
  | {
      kind: 'conflict' | 'reject';
      reason: string;
    };

const withoutIdentityFields = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value).filter(
      ([field]) =>
        field !== 'id' &&
        field !== 'provider' &&
        field !== 'externalId' &&
        field !== 'externalIdentityKey',
    ),
  );

export const decideImport = (
  existing: ImportRecord | null,
  incoming: ImportRecord,
  policy: ImportPolicy,
): ImportDecision => {
  const identityResult = normalizeExternalIdentity(incoming);
  if (!identityResult.ok) {
    return { kind: 'reject', reason: identityResult.error };
  }

  const { identity } = identityResult;
  const record = {
    ...incoming,
    provider: identity.provider,
    externalId: identity.externalId,
    externalIdentityKey: identity.key,
  };
  delete record.id;

  if (!existing) {
    return { kind: 'create', identity, record };
  }

  const existingIdentity = normalizeExternalIdentity(existing);
  if (!existingIdentity.ok || existingIdentity.identity.key !== identity.key) {
    return { kind: 'conflict', reason: 'IDENTITY_MISMATCH' };
  }

  const existingFields = withoutIdentityFields(existing);
  const incomingFields = withoutIdentityFields(record);
  const protectedFields = new Set(policy.protectedFields);

  const fieldPlan = planIdentityFieldsUpdate({
    existing: existingFields,
    incoming: incomingFields,
    sourceOwnedFields: policy.sourceOwnedFields.filter((field) => !protectedFields.has(field)),
  });
  if (fieldPlan.conflicts.length > 0) {
    return {
      kind: 'conflict',
      reason: `CONFLICTING_FIELDS:${fieldPlan.conflicts.map((conflict) => conflict.field).sort().join(',')}`,
    };
  }
  if (Object.keys(fieldPlan.updates).length === 0) return { kind: 'noop', identity };
  return { kind: 'update', identity, patch: fieldPlan.updates };
};
