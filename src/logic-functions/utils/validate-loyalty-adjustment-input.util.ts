const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REASON_LENGTH = 240;
const MAX_ABS_AMOUNT = 100_000;

export type CreateLoyaltyAdjustmentInput = {
  customerId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
};

export type CreateLoyaltyAdjustmentValidationErrorCode =
  | 'INVALID_BODY'
  | 'INVALID_CUSTOMER_ID'
  | 'INVALID_AMOUNT'
  | 'INVALID_REASON'
  | 'INVALID_IDEMPOTENCY_KEY';

export type CreateLoyaltyAdjustmentValidationResult =
  | {
      ok: true;
      data: CreateLoyaltyAdjustmentInput;
    }
  | {
      ok: false;
      error: {
        code: CreateLoyaltyAdjustmentValidationErrorCode;
        message: string;
      };
    };

const invalid = (
  code: CreateLoyaltyAdjustmentValidationErrorCode,
  message: string,
): CreateLoyaltyAdjustmentValidationResult => ({ ok: false, error: { code, message } });

export const parseCreateLoyaltyAdjustmentBody = (
  body: unknown,
): CreateLoyaltyAdjustmentValidationResult => {
  if (typeof body !== 'object' || body === null) {
    return invalid('INVALID_BODY', 'Request body must be a JSON object');
  }

  const { customerId, amount, reason, idempotencyKey } = body as Record<
    string,
    unknown
  >;

  if (typeof customerId !== 'string' || !UUID_PATTERN.test(customerId)) {
    return invalid('INVALID_CUSTOMER_ID', 'customerId must be a UUID');
  }

  if (
    typeof amount !== 'number' ||
    !Number.isSafeInteger(amount) ||
    amount === 0 ||
    Math.abs(amount) > MAX_ABS_AMOUNT
  ) {
    return invalid(
      'INVALID_AMOUNT',
      'amount must be a nonzero safe integer with absolute value <= 100000',
    );
  }

  if (typeof reason !== 'string') {
    return invalid('INVALID_REASON', 'reason must be a string');
  }

  const trimmedReason = reason.trim();

  if (trimmedReason.length === 0 || trimmedReason.length > MAX_REASON_LENGTH) {
    return invalid(
      'INVALID_REASON',
      'reason must be non-empty and at most 240 characters',
    );
  }

  if (typeof idempotencyKey !== 'string' || !UUID_PATTERN.test(idempotencyKey)) {
    return invalid('INVALID_IDEMPOTENCY_KEY', 'idempotencyKey must be a UUID');
  }

  return {
    ok: true,
    data: {
      customerId,
      amount,
      reason: trimmedReason,
      idempotencyKey,
    },
  };
};
