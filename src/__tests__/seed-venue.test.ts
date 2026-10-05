import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  isSyntheticPosRecord,
  isSyntheticPosValue,
} from 'src/front-components/pos-ui.helpers';

const VENUE_SEED_PATH = 'scripts/seed-venue.mjs';

// Forbidden production markers: acceptance, demo, review and legacy subsets.
// Matched against DATA lines only (header comment documents the exclusion).
const FORBIDDEN = [
  'POS Acceptance',
  'POS-A1',
  'POS-A2',
  'POS-A3',
  'INV-HR-',
  'MAHABBAT-DEMO-',
  'acceptance-only',
  'Зал у окна',
  'Демо официант',
  'Демо администратор',
];

describe('venue seed', () => {
  it('passes dry-run validation with staff PINs', () => {
    const result = spawnSync(
      'node',
      [VENUE_SEED_PATH, '--dry-run'],
      {
        env: {
          ...process.env,
          MAHABBAT_API_URL: 'http://localhost:3000',
          MAHABBAT_API_KEY: 'unit-test-key',
          MAHABBAT_POS_SEED_WAITER_PIN: '1111',
          MAHABBAT_POS_SEED_ADMIN_PIN: '2222',
        },
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      '3 zones, 11 tables, 30 menu items, 2 payment methods, 2 POS staff records',
    );
  });

  it('fails closed without staff PINs', () => {
    const result = spawnSync(
      'node',
      [VENUE_SEED_PATH, '--dry-run'],
      {
        env: {
          ...process.env,
          MAHABBAT_API_URL: 'http://localhost:3000',
          MAHABBAT_API_KEY: 'unit-test-key',
          MAHABBAT_POS_SEED_WAITER_PIN: '',
          MAHABBAT_POS_SEED_ADMIN_PIN: '',
        },
        encoding: 'utf8',
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('no POS staff');
  });

  it('contains no acceptance/demo/review/legacy data', () => {
    const lines = fs
      .readFileSync(VENUE_SEED_PATH, 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('*'));
    for (const marker of FORBIDDEN) {
      expect(
        lines.filter((line) => line.includes(marker)),
        `venue seed must not contain ${marker}`,
      ).toEqual([]);
    }
  });

  it('seeds only human-visible venue records', () => {
    // Venue display names must survive the production presentation filter.
    for (const label of [
      'Основной зал',
      'Стол 1',
      'VIP 1',
      'Люля-кебаб',
      'Наличные',
      'Официант',
      'Администратор',
    ]) {
      expect(isSyntheticPosValue(label)).toBe(false);
    }
    expect(
      isSyntheticPosRecord({ id: 'venue-table', number: '1', name: 'Стол 1' }),
    ).toBe(false);
  });
});
