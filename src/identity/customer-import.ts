import { normalizeKzPhone } from 'src/utils/kz-phone';

import { importByIdentity, type IdentityRepository, type ImportResult } from './identity-importer';
import type { ImportPolicy, ImportRecord } from './import-policy';

export type CustomerImportRecord = ImportRecord & {
  phone?: unknown;
};

export type CustomerNormalizationResult =
  | { ok: true; record: ImportRecord }
  | { ok: false; reason: string };

/**
 * Normalizes a raw customer phone before identity matching. Phone is never
 * added to the external identity key; it remains a separate lookup field.
 */
export const normalizeCustomerImportRecord = (
  incoming: CustomerImportRecord,
): CustomerNormalizationResult => {
  if (incoming.phone === undefined) return { ok: true, record: incoming };
  if (typeof incoming.phone !== 'string') return { ok: false, reason: 'PHONE_INVALID' };

  const phone = normalizeKzPhone(incoming.phone);
  if (!phone.ok) return { ok: false, reason: `PHONE_${phone.error}` };

  const record = { ...incoming };
  delete record.phone;
  return { ok: true, record: { ...record, normalizedPhone: phone.normalized } };
};

export const importCustomerByIdentity = async <T extends ImportRecord>(
  repository: IdentityRepository<T>,
  incoming: CustomerImportRecord,
  policy: ImportPolicy,
): Promise<ImportResult<T>> => {
  const normalized = normalizeCustomerImportRecord(incoming);
  if (!normalized.ok) return { kind: 'reject', reason: normalized.reason };
  return importByIdentity(repository, normalized.record, policy);
};
