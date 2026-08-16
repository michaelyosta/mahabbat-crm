import { describe, expect, it } from 'vitest';

import { parseCreateLoyaltyAdjustmentBody } from 'src/logic-functions/utils/validate-loyalty-adjustment-input.util';

const VALID_CUSTOMER_ID = 'c3f7a2b1-0000-4000-8000-000000000001';
const VALID_IDEMPOTENCY_KEY = 'd4f7a2b1-0000-4000-8000-000000000002';

describe('parseCreateLoyaltyAdjustmentBody', () => {
  it('accepts a valid positive adjustment', () => {
    const result = parseCreateLoyaltyAdjustmentBody({
      customerId: VALID_CUSTOMER_ID,
      amount: 500,
      reason: '  Бонус за отзыв  ',
      idempotencyKey: VALID_IDEMPOTENCY_KEY,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        customerId: VALID_CUSTOMER_ID,
        amount: 500,
        reason: 'Бонус за отзыв',
        idempotencyKey: VALID_IDEMPOTENCY_KEY,
      },
    });
  });

  it('accepts a valid negative adjustment', () => {
    const result = parseCreateLoyaltyAdjustmentBody({
      customerId: VALID_CUSTOMER_ID,
      amount: -500,
      reason: 'Списание ошибки',
      idempotencyKey: VALID_IDEMPOTENCY_KEY,
    });

    expect(result.ok).toBe(true);
  });

  it('accepts the maximum absolute amount', () => {
    const result = parseCreateLoyaltyAdjustmentBody({
      customerId: VALID_CUSTOMER_ID,
      amount: 100000,
      reason: 'Максимальная корректировка',
      idempotencyKey: VALID_IDEMPOTENCY_KEY,
    });

    expect(result.ok).toBe(true);
  });

  it('ignores client-provided entry type, source and actor', () => {
    const result = parseCreateLoyaltyAdjustmentBody({
      customerId: VALID_CUSTOMER_ID,
      amount: 100,
      reason: 'Игнорируем лишние поля',
      idempotencyKey: VALID_IDEMPOTENCY_KEY,
      entryType: 'EARN',
      source: 'POS',
      actorSource: 'client-specified',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        customerId: VALID_CUSTOMER_ID,
        amount: 100,
        reason: 'Игнорируем лишние поля',
        idempotencyKey: VALID_IDEMPOTENCY_KEY,
      },
    });
  });

  it.each([
    [null, 'INVALID_BODY'],
    ['not-an-object', 'INVALID_BODY'],
    [{}, 'INVALID_CUSTOMER_ID'],
    [{ customerId: 'not-a-uuid' }, 'INVALID_CUSTOMER_ID'],
    [{ customerId: VALID_CUSTOMER_ID }, 'INVALID_AMOUNT'],
    [{ customerId: VALID_CUSTOMER_ID, amount: 0 }, 'INVALID_AMOUNT'],
    [{ customerId: VALID_CUSTOMER_ID, amount: 1.5 }, 'INVALID_AMOUNT'],
    [{ customerId: VALID_CUSTOMER_ID, amount: 100001 }, 'INVALID_AMOUNT'],
    [{ customerId: VALID_CUSTOMER_ID, amount: -100001 }, 'INVALID_AMOUNT'],
    [{ customerId: VALID_CUSTOMER_ID, amount: Number.MAX_SAFE_INTEGER }, 'INVALID_AMOUNT'],
    [{ customerId: VALID_CUSTOMER_ID, amount: '100' }, 'INVALID_AMOUNT'],
    [{ customerId: VALID_CUSTOMER_ID, amount: 100 }, 'INVALID_REASON'],
    [{ customerId: VALID_CUSTOMER_ID, amount: 100, reason: '   ' }, 'INVALID_REASON'],
    [{ customerId: VALID_CUSTOMER_ID, amount: 100, reason: 'x'.repeat(241) }, 'INVALID_REASON'],
    [
      {
        customerId: VALID_CUSTOMER_ID,
        amount: 100,
        reason: 'ok',
        idempotencyKey: 'not-a-uuid',
      },
      'INVALID_IDEMPOTENCY_KEY',
    ],
  ])('rejects invalid input %j with %s', (body, code) => {
    expect(parseCreateLoyaltyAdjustmentBody(body)).toEqual({
      ok: false,
      error: expect.objectContaining({ code }),
    });
  });
});
