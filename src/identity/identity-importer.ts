import { normalizeExternalIdentity } from './external-identity';
import { decideImport, type ImportPolicy, type ImportRecord } from './import-policy';

export type IdentityRepository<T extends ImportRecord> = {
  findByIdentity: (provider: string, externalId: string) => Promise<T | null>;
  create: (record: Record<string, unknown>) => Promise<T>;
  update: (id: string, patch: Record<string, unknown>) => Promise<T>;
  isUniqueIdentityError: (error: unknown) => boolean;
};

export type ImportResult<T> =
  | { kind: 'created' | 'updated' | 'noop'; record: T }
  | { kind: 'conflict' | 'reject'; reason: string };

export const importByIdentity = async <T extends ImportRecord>(
  repository: IdentityRepository<T>,
  incoming: ImportRecord,
  policy: ImportPolicy,
): Promise<ImportResult<T>> => {
  const identityResult = normalizeExternalIdentity(incoming);
  if (!identityResult.ok) return { kind: 'reject', reason: identityResult.error };
  const existing = await repository.findByIdentity(
    identityResult.identity.provider,
    identityResult.identity.externalId,
  );
  let decision = decideImport(existing, incoming, policy);

  if (decision.kind === 'reject' || decision.kind === 'conflict') return decision;
  if (decision.kind === 'noop') return { kind: 'noop', record: existing as T };
  if (decision.kind === 'update') {
    return { kind: 'updated', record: await repository.update(existing?.id as string, decision.patch) };
  }
  if (decision.kind !== 'create') {
    return { kind: 'reject', reason: 'UNEXPECTED_IMPORT_DECISION' };
  }

  const createDecision = decision;

  try {
    return { kind: 'created', record: await repository.create(createDecision.record) };
  } catch (error) {
    if (!repository.isUniqueIdentityError(error)) throw error;
    const raced = await repository.findByIdentity(
      createDecision.identity.provider,
      createDecision.identity.externalId,
    );
    if (!raced) throw error;
    decision = decideImport(raced, incoming, policy);
    if (decision.kind === 'reject' || decision.kind === 'conflict') return decision;
    if (decision.kind === 'noop') return { kind: 'noop', record: raced };
    if (decision.kind === 'update') {
      return { kind: 'updated', record: await repository.update(raced.id as string, decision.patch) };
    }
    throw error;
  }
};
