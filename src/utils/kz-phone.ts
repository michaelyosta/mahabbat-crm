export type KzPhoneNormalizationResult =
  | {
      ok: true;
      normalized: string;
    }
  | {
      ok: false;
      error: KzPhoneNormalizationError;
    };

export type KzPhoneNormalizationError =
  | 'EMPTY'
  | 'INVALID_CHARACTERS'
  | 'INVALID_LENGTH'
  | 'NON_KZ';

const KZ_PHONE_LENGTH = 11;
const KZ_NATIONAL_PHONE_LENGTH = 10;
const KZ_SEPARATORS_PATTERN = /[\s()-]/g;
const KZ_DIGITS_PATTERN = /^\+?(\d+)$/;

/**
 * Normalizes a Kazakhstan phone number to the canonical internal form
 * `7XXXXXXXXXX` (the E.164 digits, stored without a leading `+`).
 *
 * Accepted inputs:
 * - `+7`, national trunk `8`, local 10-digit `6...`/`7...`, or already
 *   canonical `7` prefixes;
 * - spaces, dashes and parentheses as separators.
 *
 * Rejected inputs:
 * - empty values;
 * - anything containing non-digit, non-separator characters;
 * - numbers whose digit count is not 11;
 * - 11-digit `7`/`8` numbers that are not Kazakhstan numbers. Kazakhstan's
 *   national destination code is `6` (landline) or `7` (mobile), so e.g.
 *   Russian `+7 9xx` numbers are rejected.
 */
export const normalizeKzPhone = (
  input: string,
): KzPhoneNormalizationResult => {
  const trimmedInput = input.trim();

  if (trimmedInput.length === 0) {
    return { ok: false, error: 'EMPTY' };
  }

  const withoutSeparators = trimmedInput.replace(KZ_SEPARATORS_PATTERN, '');
  const digitsMatch = withoutSeparators.match(KZ_DIGITS_PATTERN);

  if (!digitsMatch) {
    return { ok: false, error: 'INVALID_CHARACTERS' };
  }

  if (withoutSeparators.startsWith('+') && !withoutSeparators.startsWith('+7')) {
    return { ok: false, error: 'NON_KZ' };
  }

  let digits = digitsMatch[1];

  if (digits.length === KZ_NATIONAL_PHONE_LENGTH) {
    if (trimmedInput.startsWith('+')) {
      return { ok: false, error: 'INVALID_LENGTH' };
    }
    digits = `7${digits}`;
  }

  if (digits.length !== KZ_PHONE_LENGTH) {
    return { ok: false, error: 'INVALID_LENGTH' };
  }

  if (digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  }

  const isKazakhstanNumber =
    digits.startsWith('7') && (digits[1] === '6' || digits[1] === '7');

  if (!isKazakhstanNumber) {
    return { ok: false, error: 'NON_KZ' };
  }

  return { ok: true, normalized: digits };
};
