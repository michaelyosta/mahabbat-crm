import { describe, expect, it } from 'vitest';

import {
  commandError,
  countShiftOpenOrders,
  createSubmitGuard,
  formatOpenOrderCount,
  russianPlural,
  summarizeReleaseManifest,
  type PosRow,
} from 'src/front-components/pos-ui.helpers';

const order = (overrides: Partial<PosRow> & { id: string }): PosRow => ({
  status: 'IN_PROGRESS',
  ...overrides,
});

describe('russianPlural / formatOpenOrderCount', () => {
  it.each([
    [1, '1 заказ'],
    [2, '2 заказа'],
    [3, '3 заказа'],
    [4, '4 заказа'],
    [5, '5 заказов'],
    [0, '0 заказов'],
    [11, '11 заказов'],
    [12, '12 заказов'],
    [14, '14 заказов'],
    [21, '21 заказ'],
    [22, '22 заказа'],
    [25, '25 заказов'],
    [101, '101 заказ'],
    [111, '111 заказов'],
  ])('formats %i as %s', (count, expected) => {
    expect(formatOpenOrderCount(count)).toBe(expected);
  });

  it('handles generic triples', () => {
    expect(russianPlural(1, 'a', 'b', 'c')).toBe('a');
    expect(russianPlural(3, 'a', 'b', 'c')).toBe('b');
    expect(russianPlural(8, 'a', 'b', 'c')).toBe('c');
  });
});

describe('countShiftOpenOrders', () => {
  const shiftA = 'shift-a';
  const shiftB = 'shift-b';

  it('counts OPEN / IN_PROGRESS / PRECHECK_PRINTED of the shift', () => {
    const orders = [
      order({ id: 'o1', status: 'OPEN', shiftId: shiftA }),
      order({ id: 'o2', status: 'IN_PROGRESS', shiftId: shiftA }),
      order({ id: 'o3', status: 'PRECHECK_PRINTED', shiftId: shiftA }),
      order({ id: 'o4', status: 'CLOSED', shiftId: shiftA }),
      order({ id: 'o5', status: 'CANCELLED', shiftId: shiftA }),
      order({ id: 'o6', status: 'OPEN', shiftId: shiftB }),
    ];
    expect(countShiftOpenOrders(orders, shiftA)).toBe(3);
    expect(countShiftOpenOrders(orders, shiftB)).toBe(1);
  });

  it('falls back to all active when no row carries shiftId', () => {
    const orders = [
      order({ id: 'o1', status: 'OPEN' }),
      order({ id: 'o2', status: 'CLOSED' }),
    ];
    expect(countShiftOpenOrders(orders, shiftA)).toBe(1);
  });

  it('ignores synthetic acceptance rows', () => {
    const orders = [
      order({ id: 'o1', status: 'OPEN', shiftId: shiftA }),
      order({
        id: 'o2',
        status: 'OPEN',
        shiftId: shiftA,
        name: 'POS Acceptance check',
      }),
    ];
    expect(countShiftOpenOrders(orders, shiftA)).toBe(1);
  });

  it('counts all active without a shift', () => {
    const orders = [
      order({ id: 'o1', status: 'OPEN', shiftId: shiftA }),
      order({ id: 'o2', status: 'CLOSED', shiftId: shiftA }),
    ];
    expect(countShiftOpenOrders(orders, null)).toBe(1);
    expect(countShiftOpenOrders([], shiftA)).toBe(0);
  });
});

describe('SHIFT_HAS_OPEN_ORDERS message', () => {
  it('maps to Russian text instead of the generic fallback', () => {
    const message = commandError({
      body: { code: 'SHIFT_HAS_OPEN_ORDERS', message: 'Shift has open orders.' },
    });
    expect(message).toContain('Смена не закрыта');
    expect(message).toContain('открытые заказы');
  });
});

describe('summarizeReleaseManifest', () => {
  const changelog =
    '1.1.0-rc.1: финансы (три-state CAS, идемпотентность) + бэкап v2. 1.0.1: новый updater с сохранением данных.';

  const raw = {
    mahabbatVersion: '1.1.0-rc.1',
    windowsFileVersion: '1.1.0.1',
    deploymentSha: '05cdd57',
    crmSha: 'c1252d1e53d8ea1aabde5f59dc09cf35ec394d91',
    backupVersion: 2,
    images: {
      branding: {
        immutableTag: 'sha-08dd2de9e097-branding',
        digest: 'sha256:3497f4a3bb110876f92b15a44865a41845958eb9d9a2d064b70f72de91364b2e',
      },
      venue: {
        immutableTag: 'sha-08dd2de9e097-venue',
        digest: 'sha256:204850428783a3e081c40e820fd36275b54f21f2d595f489178db27333cea532',
      },
    },
    changelogSource: changelog,
  };

  it('passes values through byte-for-byte (Cyrillic intact)', () => {
    const summary = summarizeReleaseManifest(raw, 'abc123');
    expect(summary).not.toBeNull();
    expect(summary?.mahabbatVersion).toBe('1.1.0-rc.1');
    expect(summary?.crmSha).toBe('c1252d1e53d8ea1aabde5f59dc09cf35ec394d91');
    expect(summary?.changelog).toBe(changelog);
    expect(summary?.images.branding.digest).toBe(
      'sha256:3497f4a3bb110876f92b15a44865a41845958eb9d9a2d064b70f72de91364b2e',
    );
    expect(summary?.manifestSha256).toBe('abc123');
    // Никакой mojibake-вида «С„Рё»: строка не перекодирована.
    expect(summary?.changelog).not.toContain('Рё');
  });

  it('returns null when required fields are missing', () => {
    expect(summarizeReleaseManifest(null)).toBeNull();
    expect(summarizeReleaseManifest('nope')).toBeNull();
    expect(summarizeReleaseManifest({})).toBeNull();
    expect(
      summarizeReleaseManifest({ mahabbatVersion: '1.0.0' }),
    ).toBeNull();
    expect(summarizeReleaseManifest({ crmSha: 'abc' })).toBeNull();
  });
});

describe('createSubmitGuard', () => {
  it('lets the first click through and blocks the repeat (no second key)', () => {
    const guard = createSubmitGuard();
    let keysMade = 0;
    const first = guard.acquire('record-payment', () => {
      keysMade += 1;
      return `key-${keysMade}`;
    });
    expect(first).toBe('key-1');
    const second = guard.acquire('record-payment', () => {
      keysMade += 1;
      return `key-${keysMade}`;
    });
    expect(second).toBeNull();
    expect(keysMade).toBe(1);
  });

  it('tracks intents independently and frees on release', () => {
    const guard = createSubmitGuard();
    expect(guard.acquire('a', () => 'ka')).toBe('ka');
    expect(guard.acquire('b', () => 'kb')).toBe('kb');
    guard.release('a');
    expect(guard.acquire('a', () => 'ka2')).toBe('ka2');
    // b still held
    expect(guard.acquire('b', () => 'kb2')).toBeNull();
  });
});
