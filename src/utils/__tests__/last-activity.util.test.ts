import { describe, expect, it } from 'vitest';

import {
  mergeLastActivityAt,
  parseActivityTimestamp,
} from 'src/utils/last-activity.util';

describe('parseActivityTimestamp', () => {
  it('parses an ISO string', () => {
    expect(parseActivityTimestamp('2026-08-10T10:00:00.000Z')).toBe(
      Date.parse('2026-08-10T10:00:00.000Z'),
    );
  });

  it('parses a Date', () => {
    const timestamp = new Date('2026-08-10T10:00:00.000Z');
    expect(parseActivityTimestamp(timestamp)).toBe(timestamp.getTime());
  });

  it('rejects a malformed string', () => {
    expect(parseActivityTimestamp('not-a-date')).toBeNull();
  });

  it('rejects non-string, non-Date input', () => {
    expect(parseActivityTimestamp(42)).toBeNull();
    expect(parseActivityTimestamp(null)).toBeNull();
  });
});

describe('mergeLastActivityAt', () => {
  it('sets the timestamp when there is no current value', () => {
    expect(mergeLastActivityAt(null, '2026-08-10T10:00:00.000Z')).toBe(
      '2026-08-10T10:00:00.000Z',
    );
  });

  it('advances when the candidate is strictly later', () => {
    expect(
      mergeLastActivityAt(
        '2026-08-10T10:00:00.000Z',
        '2026-08-12T10:00:00.000Z',
      ),
    ).toBe('2026-08-12T10:00:00.000Z');
  });

  it('keeps the current value when the candidate is earlier (never regresses)', () => {
    expect(
      mergeLastActivityAt(
        '2026-08-10T10:00:00.000Z',
        '2026-08-01T10:00:00.000Z',
      ),
    ).toBe('2026-08-10T10:00:00.000Z');
  });

  it('keeps the current value when the candidate is equal', () => {
    expect(
      mergeLastActivityAt(
        '2026-08-10T10:00:00.000Z',
        '2026-08-10T10:00:00.000Z',
      ),
    ).toBe('2026-08-10T10:00:00.000Z');
  });

  it('repairs an invalid current value with a valid candidate', () => {
    expect(mergeLastActivityAt('garbage', '2026-08-10T10:00:00.000Z')).toBe(
      '2026-08-10T10:00:00.000Z',
    );
  });

  it('never overwrites a valid value with an invalid candidate', () => {
    expect(mergeLastActivityAt('2026-08-10T10:00:00.000Z', 'garbage')).toBe(
      '2026-08-10T10:00:00.000Z',
    );
  });

  it('accepts a Date candidate', () => {
    expect(
      mergeLastActivityAt(null, new Date('2026-08-10T10:00:00.000Z')),
    ).toBe('2026-08-10T10:00:00.000Z');
  });
});