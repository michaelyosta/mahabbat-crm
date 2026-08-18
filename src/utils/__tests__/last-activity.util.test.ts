import { describe, expect, it } from 'vitest';

import {
  normalizeActivityTimestamp,
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

describe('normalizeActivityTimestamp', () => {
  it('returns a canonical ISO string for a string candidate', () => {
    expect(normalizeActivityTimestamp('2026-08-10T10:00:00.000Z')).toBe(
      '2026-08-10T10:00:00.000Z',
    );
  });

  it('returns a canonical ISO string for a Date candidate', () => {
    expect(
      normalizeActivityTimestamp(new Date('2026-08-10T10:00:00.000Z')),
    ).toBe('2026-08-10T10:00:00.000Z');
  });

  it('returns null for a malformed candidate', () => {
    expect(normalizeActivityTimestamp('garbage')).toBeNull();
  });

  it('returns null for null or undefined candidates', () => {
    expect(normalizeActivityTimestamp(null)).toBeNull();
    expect(normalizeActivityTimestamp(undefined)).toBeNull();
  });
});