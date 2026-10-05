export type PosCurrency = {
  amountMicros: number;
  currencyCode: string;
};

export const POS_CURRENCY_CODE = 'KZT';

export const zeroCurrency = (): PosCurrency => ({
  amountMicros: 0,
  currencyCode: POS_CURRENCY_CODE,
});

const MAX_SAFE_MICROS = Number.MAX_SAFE_INTEGER;

export const isSafeMicros = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= MAX_SAFE_MICROS;

export const assertSafeMicros = (value: unknown, field = 'amountMicros'): number => {
  if (!isSafeMicros(value)) {
    throw new Error(`${field} must be a safe integer within ±${MAX_SAFE_MICROS}.`);
  }
  return value;
};

export const normalizeCurrency = (value: unknown): PosCurrency => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return { amountMicros: value, currencyCode: POS_CURRENCY_CODE };
  }

  if (typeof value === 'object' && value !== null) {
    const candidate = value as { amountMicros?: unknown; currencyCode?: unknown };
    const amountMicros = candidate.amountMicros;
    if (typeof amountMicros === 'number' && Number.isSafeInteger(amountMicros)) {
      return {
        amountMicros,
        currencyCode:
          typeof candidate.currencyCode === 'string'
            ? candidate.currencyCode
            : POS_CURRENCY_CODE,
      };
    }
  }

  return zeroCurrency();
};

export const requireKztCurrency = (value: unknown, field = 'unitPrice'): PosCurrency => {
  const currency = normalizeCurrency(value);
  if (currency.currencyCode !== POS_CURRENCY_CODE) {
    throw new Error(`${field} must use ${POS_CURRENCY_CODE}.`);
  }
  return currency;
};

export type PosMoneyInput = {
  unitPrice: unknown;
  quantity: number;
};

export const lineAmountMicros = ({
  unitPrice,
  quantity,
}: PosMoneyInput): number => {
  const unit = normalizeCurrency(unitPrice);
  const safeQuantity = Number.isSafeInteger(quantity) ? quantity : 0;
  const amount = unit.amountMicros * Math.max(0, safeQuantity);
  if (!Number.isSafeInteger(amount)) {
    throw new Error('lineAmountMicros overflow: unitPrice*quantity exceeds safe integer range.');
  }
  return amount;
};

export const sumActiveLinesMicros = (
  lines: Array<PosMoneyInput & { status?: string | null }>,
): number => {
  let total = 0;
  for (const line of lines) {
    if (line.status !== null && line.status !== undefined && line.status !== 'ACTIVE') continue;
    total += lineAmountMicros(line);
    if (!Number.isSafeInteger(total)) {
      throw new Error('sumActiveLinesMicros overflow: order total exceeds safe integer range.');
    }
  }
  return total;
};

export const microsToCurrency = (amountMicros: number): PosCurrency => ({
  amountMicros,
  currencyCode: POS_CURRENCY_CODE,
});
