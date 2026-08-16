import { describe, expect, it } from 'vitest';

import { normalizeKzPhone } from 'src/utils/kz-phone';

describe('normalizeKzPhone', () => {
  describe('accepted formats', () => {
    it.each([
      ['77771234567', '77771234567'],
      ['87771234567', '77771234567'],
      ['+77771234567', '77771234567'],
      ['+7 777 123 45 67', '77771234567'],
      ['8 (777) 123-45-67', '77771234567'],
      ['+7(777)123-45-67', '77771234567'],
      ['7-777-123-45-67', '77771234567'],
      ['  +7 777 123 45 67  ', '77771234567'],
      ['87001234567', '77001234567'],
      ['7011234567', '77011234567'],
      ['6 701 234 567', '76701234567'],
      ['(777) 123-45-67', '77771234567'],
      ['+7 600 123 45 67', '76001234567'],
    ])('normalizes %s to %s', (input, expected) => {
      expect(normalizeKzPhone(input)).toEqual({
        ok: true,
        normalized: expected,
      });
    });
  });

  describe('rejected inputs', () => {
    it.each([
      ['', 'EMPTY'],
      ['   ', 'EMPTY'],
      ['abc', 'INVALID_CHARACTERS'],
      ['7771234567a', 'INVALID_CHARACTERS'],
      ['+7 777 123 45 67 extra', 'INVALID_CHARACTERS'],
      ['++7771234567', 'INVALID_CHARACTERS'],
      ['777123456', 'INVALID_LENGTH'],
      ['777123456789', 'INVALID_LENGTH'],
      ['+777712345678', 'INVALID_LENGTH'],
      ['79991234567', 'NON_KZ'],
      ['+7 999 123 45 67', 'NON_KZ'],
      ['+8 701 123 45 67', 'NON_KZ'],
      ['89991234567', 'NON_KZ'],
      ['07771234567', 'NON_KZ'],
      ['+7777123456', 'INVALID_LENGTH'],
      ['9991234567', 'NON_KZ'],
    ])('rejects %s with %s', (input, error) => {
      expect(normalizeKzPhone(input)).toEqual({ ok: false, error });
    });
  });
});
