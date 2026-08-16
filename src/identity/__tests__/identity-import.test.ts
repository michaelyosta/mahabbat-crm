import { describe, expect, it } from 'vitest';

import { normalizeExternalIdentity } from '../external-identity';
import { importCustomerByIdentity, normalizeCustomerImportRecord } from '../customer-import';
import { importByIdentity } from '../identity-importer';
import { decideImport, type ImportPolicy, type ImportRecord } from '../import-policy';

const policy: ImportPolicy = {
  sourceOwnedFields: ['firstName', 'lastName', 'normalizedPhone'],
  protectedFields: ['notes'],
};

const identity = { provider: ' iiko ', externalId: ' order-42 ' };

describe('external identity', () => {
  it('normalizes the provider and preserves external id case', () => {
    expect(normalizeExternalIdentity(identity)).toEqual({
      ok: true,
      identity: { provider: 'IIKO', externalId: 'order-42', key: 'IIKO::order-42' },
    });
  });

  it.each([
    [{ provider: '', externalId: 'x' }, 'PROVIDER_REQUIRED'],
    [{ provider: 'iiko api', externalId: 'x' }, 'PROVIDER_INVALID'],
    [{ provider: 'iiko', externalId: '' }, 'EXTERNAL_ID_REQUIRED'],
    [{ provider: 'iiko', externalId: 'x\u0000y' }, 'EXTERNAL_ID_INVALID'],
  ])('rejects malformed identity %j', (input, error) => {
    expect(normalizeExternalIdentity(input)).toEqual({ ok: false, error });
  });
});

describe('customer import normalization', () => {
  it('normalizes the raw Kazakhstan phone before identity upsert', () => {
    expect(normalizeCustomerImportRecord({ ...identity, phone: '8 (701) 123-45-67' })).toEqual({
      ok: true,
      record: { ...identity, normalizedPhone: '77011234567' },
    });
  });

  it('rejects malformed raw phones instead of guessing', () => {
    expect(normalizeCustomerImportRecord({ ...identity, phone: '+8 701 123 45 67' })).toEqual({
      ok: false,
      reason: 'PHONE_NON_KZ',
    });
  });

  it('passes the normalized phone into the identity importer', async () => {
    const records = new Map<string, ImportRecord & { id: string }>();
    const repository = {
      findByIdentity: async (provider: string, externalId: string) => records.get(`${provider}::${externalId}`) ?? null,
      create: async (record: Record<string, unknown>) => {
        const created = { ...record, id: 'customer-1' } as ImportRecord & { id: string };
        records.set(`${String(record.provider)}::${String(record.externalId)}`, created);
        return created;
      },
      update: async (id: string, patch: Record<string, unknown>) => ({ id, ...patch } as ImportRecord & { id: string }),
      isUniqueIdentityError: () => false,
    };

    const result = await importCustomerByIdentity(repository, { ...identity, phone: '7011234567' }, policy);
    expect(result).toMatchObject({ kind: 'created', record: { normalizedPhone: '77011234567' } });
  });
});

describe('import policy', () => {
  it('creates when identity is new', () => {
    expect(decideImport(null, { ...identity, externalIdentityKey: 'spoofed', firstName: 'Aida' }, policy)).toMatchObject({
      kind: 'create',
      record: { provider: 'IIKO', externalId: 'order-42', externalIdentityKey: 'IIKO::order-42' },
    });
  });

  it('is a noop for a repeated identical delivery', () => {
    const record = { ...identity, firstName: 'Aida' };
    expect(decideImport(record, record, policy)).toMatchObject({ kind: 'noop' });
  });

  it('updates source-owned fields when the external record changes', () => {
    expect(decideImport(
      { ...identity, firstName: 'Aida' },
      { ...identity, firstName: 'Aigul' },
      policy,
    )).toMatchObject({ kind: 'update', patch: { firstName: 'Aigul' } });
  });

  it('returns conflict instead of overwriting protected local data', () => {
    expect(decideImport(
      { ...identity, notes: 'Manager note' },
      { ...identity, notes: 'External note' },
      policy,
    )).toMatchObject({ kind: 'conflict' });
  });

  it('allows the same phone for different external identities', () => {
    const first = decideImport(null, { ...identity, normalizedPhone: '77011234567' }, policy);
    const second = decideImport(null, { provider: 'IIKO', externalId: 'order-43', normalizedPhone: '77011234567' }, policy);
    expect(first.kind).toBe('create');
    expect(second.kind).toBe('create');
  });

  it('converges a concurrent create race into one logical import', async () => {
    const records = new Map<string, ImportRecord & { id: string }>();
    let nextId = 1;
    const repository = {
      findByIdentity: async (provider: string, externalId: string) => records.get(`${provider.toUpperCase()}::${externalId}`) ?? null,
      create: async (record: Record<string, unknown>) => {
        const key = `${String(record.provider)}::${String(record.externalId)}`;
        if (records.has(key)) throw new Error('UNIQUE_PROVIDER_EXTERNAL_ID');
        const created = { ...record, id: String(nextId++) } as ImportRecord & { id: string };
        records.set(key, created);
        return created;
      },
      update: async (id: string, patch: Record<string, unknown>) => {
        const record = [...records.values()].find((item) => item.id === id) as ImportRecord & { id: string };
        Object.assign(record, patch);
        return record;
      },
      isUniqueIdentityError: (error: unknown) => error instanceof Error && error.message.includes('UNIQUE'),
    };

    const results = await Promise.all([
      importByIdentity(repository, { ...identity, firstName: 'Aida' }, policy),
      importByIdentity(repository, { ...identity, firstName: 'Aida' }, policy),
    ]);

    expect(results.map((result) => result.kind).sort()).toEqual(['created', 'noop']);
    expect(records).toHaveLength(1);
  });
});
