import { describe, expect, it } from 'vitest';

import {
  buildIdentityKey,
  isSameIdentity,
  normalizeExternalId,
  normalizeProvider,
  parseIdentity,
  planIdentityFieldsUpdate,
} from 'src/identity/identity-contract';

describe('normalizeProvider', () => {
  it.each([
    ['POS', 'POS'],
    ['  pos  ', 'POS'],
    ['iiko', 'IIKO'],
    ['import_v2', 'IMPORT_V2'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeProvider(input)).toBe(expected);
  });

  it.each([
    ['', null],
    ['   ', null],
    ['a b', null],
    ['a/b', null],
    ['a'.repeat(65), null],
    [null, null],
    [42, null],
  ])('rejects %j with %s', (input, expected) => {
    expect(normalizeProvider(input)).toBe(expected);
  });
});

describe('normalizeExternalId', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeExternalId('  MAHABBAT-DEMO-ORD-001  ')).toBe(
      'MAHABBAT-DEMO-ORD-001',
    );
  });

  it('preserves case and internal characters', () => {
    expect(normalizeExternalId('Order-001#A')).toBe('Order-001#A');
  });

  it.each([
    ['', null],
    ['   ', null],
    ['a\u0000b', null],
    ['a\u001Fb', null],
    ['a\u007Fb', null],
    ['x'.repeat(256), null],
    [null, null],
    [42, null],
  ])('rejects %j', (input, expected) => {
    expect(normalizeExternalId(input)).toBe(expected);
  });
});

describe('parseIdentity', () => {
  it('parses and canonicalizes a valid identity', () => {
    expect(
      parseIdentity({ provider: ' pos ', externalId: '  ORD-001 ' }),
    ).toEqual({
      ok: true,
      data: {
        provider: 'POS',
        externalId: 'ORD-001',
        key: 'POS::ORD-001',
      },
    });
  });

  it.each([
    [null, 'INVALID_BODY'],
    ['not-an-object', 'INVALID_BODY'],
    [{}, 'INVALID_PROVIDER'],
    [{ provider: null, externalId: 'x' }, 'INVALID_PROVIDER'],
    [{ provider: 'a b', externalId: 'x' }, 'INVALID_PROVIDER'],
    [{ provider: 'POS' }, 'INVALID_EXTERNAL_ID'],
    [{ provider: 'POS', externalId: '   ' }, 'INVALID_EXTERNAL_ID'],
    [{ provider: 'POS', externalId: 'a\u0000b' }, 'INVALID_EXTERNAL_ID'],
  ])('rejects malformed identity %j with %s', (input, code) => {
    expect(parseIdentity(input)).toEqual({
      ok: false,
      error: expect.objectContaining({ code }),
    });
  });
});

describe('identity key', () => {
  it('builds a deterministic key', () => {
    expect(buildIdentityKey('POS', 'ORD-001')).toBe('POS::ORD-001');
  });

  it('treats normalization-equivalent inputs as the same identity', () => {
    expect(
      isSameIdentity(
        { provider: 'pos', externalId: ' ORD-001 ' },
        { provider: 'POS', externalId: 'ORD-001' },
      ),
    ).toBe(true);
  });

  it('keeps different external ids distinct', () => {
    expect(
      isSameIdentity(
        { provider: 'POS', externalId: 'ORD-001' },
        { provider: 'POS', externalId: 'ORD-002' },
      ),
    ).toBe(false);
  });

  it('keeps an external id containing the key separator unambiguous', () => {
    expect(buildIdentityKey('A', 'B::C')).toBe('A::B::C');
    expect(buildIdentityKey('A', 'B')).toBe('A::B');
    expect(buildIdentityKey('A', 'B::C')).not.toBe(buildIdentityKey('A', 'B'));
  });

  it('allows the same phone with different identities', () => {
    const posIdentity = parseIdentity({ provider: 'POS', externalId: 'C-1' });
    const manualIdentity = parseIdentity({
      provider: 'MANUAL',
      externalId: 'C-1',
    });

    expect(posIdentity.ok).toBe(true);
    expect(manualIdentity.ok).toBe(true);
    expect(posIdentity.ok && manualIdentity.ok).toBe(true);

    if (!posIdentity.ok || !manualIdentity.ok) {
      return;
    }

    expect(posIdentity.data.key).not.toBe(manualIdentity.data.key);

    const plan = planIdentityFieldsUpdate({
      existing: {
        normalizedPhone: '77001234567',
      },
      incoming: {
        normalizedPhone: '77001234567',
      },
      sourceOwnedFields: [],
    });

    expect(plan.conflicts).toHaveLength(0);
    expect(plan.updates).toEqual({});
  });
});

describe('planIdentityFieldsUpdate', () => {
  it('stages updates only for source-owned fields', () => {
    const plan = planIdentityFieldsUpdate({
      existing: {
        sourceName: 'Старый',
        customerStatus: 'ACTIVE',
      },
      incoming: {
        sourceName: 'Новый',
        customerStatus: 'ACTIVE',
      },
      sourceOwnedFields: ['sourceName'],
    });

    expect(plan).toEqual({
      updates: { sourceName: 'Новый' },
      conflicts: [],
      ignoredFields: [],
    });
  });

  it('allows a source-owned field to be cleared with null', () => {
    const plan = planIdentityFieldsUpdate({
      existing: { sourceName: 'Старый' },
      incoming: { sourceName: null },
      sourceOwnedFields: ['sourceName'],
    });

    expect(plan.updates).toEqual({ sourceName: null });
    expect(plan.conflicts).toHaveLength(0);
  });

  it('reports protected local fields as conflicts and does not overwrite them', () => {
    const plan = planIdentityFieldsUpdate({
      existing: {
        sourceName: 'Старый',
        normalizedPhone: '77001234567',
        customerNotes: 'Локальная заметка',
      },
      incoming: {
        sourceName: 'Новый',
        normalizedPhone: '77009999999',
        customerNotes: 'Другая заметка',
      },
      sourceOwnedFields: ['sourceName'],
    });

    expect(plan.updates).toEqual({ sourceName: 'Новый' });
    expect(plan.conflicts).toHaveLength(2);
    expect(plan.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'normalizedPhone',
          reason: 'PROTECTED_FIELD_CHANGED',
          incoming: '77009999999',
          existing: '77001234567',
        }),
        expect.objectContaining({
          field: 'customerNotes',
          reason: 'PROTECTED_FIELD_CHANGED',
        }),
      ]),
    );
  });

  it('treats equal values as a no-op', () => {
    const plan = planIdentityFieldsUpdate({
      existing: { normalizedPhone: '77001234567' },
      incoming: { normalizedPhone: '77001234567' },
      sourceOwnedFields: [],
    });

    expect(plan).toEqual({
      updates: {},
      conflicts: [],
      ignoredFields: [],
    });
  });

  it('ignores undefined incoming values', () => {
    const plan = planIdentityFieldsUpdate({
      existing: { normalizedPhone: '77001234567' },
      incoming: { normalizedPhone: undefined, customerNotes: 'x' },
      sourceOwnedFields: ['customerNotes'],
    });

    expect(plan.updates).toEqual({ customerNotes: 'x' });
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.ignoredFields).toEqual(['normalizedPhone']);
  });

  it('never silently merges a protected null into an existing value', () => {
    const plan = planIdentityFieldsUpdate({
      existing: { lastActivityAt: '2026-08-09T10:00:00.000Z' },
      incoming: { lastActivityAt: null },
      sourceOwnedFields: [],
    });

    expect(plan.updates).toEqual({});
    expect(plan.conflicts).toEqual([
      expect.objectContaining({
        field: 'lastActivityAt',
        existing: '2026-08-09T10:00:00.000Z',
        incoming: null,
      }),
    ]);
  });
});
