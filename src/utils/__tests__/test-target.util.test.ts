import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DISPOSABLE_TEST_TARGETS,
  TEST_TARGET_ALLOW_ENV,
  assertAllowedTestTarget,
  isAllowedTestTarget,
  normalizeTestTarget,
} from 'src/utils/test-target.util';

describe('test-target.util', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('normalizeTestTarget', () => {
    it('trims whitespace', () => {
      expect(normalizeTestTarget('  http://localhost:2020  ')).toBe(
        'http://localhost:2020',
      );
    });

    it('strips trailing slashes', () => {
      expect(normalizeTestTarget('http://localhost:2020/')).toBe(
        'http://localhost:2020',
      );
    });
  });

  describe('isAllowedTestTarget', () => {
    it('allows every disposable dev target by default', () => {
      for (const target of DISPOSABLE_TEST_TARGETS) {
        expect(isAllowedTestTarget(target)).toBe(true);
      }
    });

    it('rejects the production-like selfhost target by default', () => {
      expect(isAllowedTestTarget('http://localhost:3000')).toBe(false);
    });

    it('rejects arbitrary external hosts by default', () => {
      expect(isAllowedTestTarget('https://app.example.com')).toBe(false);
    });

    it('rejects a target with a disallowed scheme', () => {
      expect(isAllowedTestTarget('ftp://localhost:2020')).toBe(false);
    });

    it('allows an explicitly opted-in target', () => {
      vi.stubEnv(
        TEST_TARGET_ALLOW_ENV,
        'https://staging.example.com, https://other.example.com/',
      );
      expect(isAllowedTestTarget('https://staging.example.com')).toBe(true);
      expect(isAllowedTestTarget('https://other.example.com')).toBe(true);
    });

    it('still rejects disallowed targets when an allow env is set', () => {
      vi.stubEnv(TEST_TARGET_ALLOW_ENV, 'https://staging.example.com');
      expect(isAllowedTestTarget('http://localhost:3000')).toBe(false);
      expect(isAllowedTestTarget('https://unlisted.example.com')).toBe(false);
    });
  });

  describe('assertAllowedTestTarget', () => {
    it('does not throw for a disposable dev target', () => {
      expect(() => assertAllowedTestTarget('http://localhost:2020')).not.toThrow();
    });

    it('throws for a disallowed target', () => {
      expect(() => assertAllowedTestTarget('http://localhost:3000')).toThrow(
        'Fail-closed',
      );
    });

    it('throws for a disallowed target that would touch uninstall', () => {
      expect(() => assertAllowedTestTarget('https://app.example.com')).toThrow(
        'Fail-closed',
      );
    });
  });
});