export type PosCurrency = {
  amountMicros: number;
  currencyCode: string;
};

export const POS_CURRENCY_CODE = 'KZT';

export const zeroCurrency = (): PosCurrency => ({
  amountMicros: 0,
  currencyCode: POS_CURRENCY_CODE,
});

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
  return unit.amountMicros * Math.max(0, safeQuantity);
};

export const sumActiveLinesMicros = (
  lines: Array<PosMoneyInput & { status?: string | null }>,
): number =>
  lines
    .filter((line) => line.status === null || line.status === 'ACTIVE')
    .reduce((sum, line) => sum + lineAmountMicros(line), 0);

export const microsToCurrency = (amountMicros: number): PosCurrency => ({
  amountMicros,
  currencyCode: POS_CURRENCY_CODE,
});
