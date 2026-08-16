export type AggregateMoneyInput = string | null | undefined;

export type AggregateSalesLineInput = {
  provider: string;
  sourceReportId: string;
  periodStart: string;
  periodEnd: string;
  warehouse: string;
  sourceFileName?: string | null;
  sourceRowNumber?: number | null;
  rawItemName: string;
  itemExternalId?: string | null;
  quantity: string;
  averagePriceBeforeDiscount?: AggregateMoneyInput;
  averagePrice?: AggregateMoneyInput;
  revenueBeforeDiscount?: AggregateMoneyInput;
  revenue?: AggregateMoneyInput;
  grossProfit?: AggregateMoneyInput;
  markupPercent?: string | null;
  grossProfitBeforeVat?: AggregateMoneyInput;
  concept?: string | null;
  revenueSharePercent?: string | null;
};

export type NormalizedAggregateSalesLine = AggregateSalesLineInput & {
  externalIdentityKey: string;
  normalizedItemKey: string;
  matchStatus: 'UNMATCHED';
};

export type SalesSnapshotLinePayload = {
  externalIdentityKey: string;
  provider: string;
  sourceReportId: string;
  periodStart: string;
  periodEnd: string;
  warehouse: string;
  sourceFileName: string | null;
  sourceRowNumber: number | null;
  rawItemName: string;
  normalizedItemKey: string;
  quantity: number;
  averagePriceBeforeDiscount: { amountMicros: string; currencyCode: 'KZT' } | null;
  averagePrice: { amountMicros: string; currencyCode: 'KZT' } | null;
  revenueBeforeDiscount: { amountMicros: string; currencyCode: 'KZT' } | null;
  revenue: { amountMicros: string; currencyCode: 'KZT' } | null;
  grossProfit: { amountMicros: string; currencyCode: 'KZT' } | null;
  grossProfitBeforeVat: { amountMicros: string; currencyCode: 'KZT' } | null;
  markupPercent: number | null;
  concept: string | null;
  revenueSharePercent: number | null;
  matchStatus: 'UNMATCHED';
};

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export const normalizeSourceText = (value: string, fieldName: string): string => {
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error(`${fieldName} must not be empty`);
  return normalized;
};

export const normalizeItemKey = (rawItemName: string): string =>
  normalizeSourceText(rawItemName, 'rawItemName').toLocaleLowerCase('ru-KZ');

export const normalizeDecimalString = (value: string, fieldName: string): string => {
  const normalized = value.trim();
  if (!DECIMAL_PATTERN.test(normalized)) {
    throw new Error(`${fieldName} must be a decimal string`);
  }
  const [integerPart, fractionPart] = normalized.replace(/^-/, '').split('.');
  const sign = normalized.startsWith('-') ? '-' : '';
  const canonicalInteger = integerPart.replace(/^0+(?=\d)/, '');
  return `${sign}${canonicalInteger}${fractionPart ? `.${fractionPart}` : ''}`;
};

export const decimalTengeToMoney = (value: AggregateMoneyInput) => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = normalizeDecimalString(String(value), 'money');
  const sign = normalized.startsWith('-') ? -1n : 1n;
  const unsigned = normalized.replace(/^-/, '');
  const [integerPart, fractionPart = ''] = unsigned.split('.');
  if (fractionPart.length > 6) throw new Error('money supports at most 6 decimal places');
  const micros = sign * (
    BigInt(integerPart) * 1_000_000n
      + BigInt((fractionPart + '000000').slice(0, 6))
  );
  return { amountMicros: micros.toString(), currencyCode: 'KZT' as const };
};

const decimalStringToApiNumber = (value: string | null | undefined, fieldName: string): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw new Error(`${fieldName} is outside the JSON number range`);
  return numberValue;
};

export const buildAggregateLineIdentityKey = (input: AggregateSalesLineInput): string => {
  const provider = normalizeSourceText(input.provider, 'provider').toUpperCase();
  const sourceReportId = normalizeSourceText(input.sourceReportId, 'sourceReportId');
  const periodStart = normalizeSourceText(input.periodStart, 'periodStart');
  const periodEnd = normalizeSourceText(input.periodEnd, 'periodEnd');
  const warehouse = normalizeSourceText(input.warehouse, 'warehouse');
  const itemKey = normalizeItemKey(input.rawItemName);
  const sourceRow = input.sourceRowNumber === null || input.sourceRowNumber === undefined
    ? 'NO_ROW'
    : String(input.sourceRowNumber);
  const itemExternalId = input.itemExternalId?.trim() || 'NO_ITEM_ID';
  return `AGGREGATE::${provider}::${sourceReportId}::${periodStart}::${periodEnd}::${warehouse}::${itemExternalId}::${itemKey}::${sourceRow}`;
};

export const normalizeAggregateSalesLine = (
  input: AggregateSalesLineInput,
): NormalizedAggregateSalesLine => {
  const rawItemName = input.rawItemName.normalize('NFKC');
  if (!rawItemName.trim()) throw new Error('rawItemName must not be empty');
  const quantity = normalizeDecimalString(input.quantity, 'quantity');
  return {
    ...input,
    provider: normalizeSourceText(input.provider, 'provider').toUpperCase(),
    sourceReportId: normalizeSourceText(input.sourceReportId, 'sourceReportId'),
    periodStart: normalizeSourceText(input.periodStart, 'periodStart'),
    periodEnd: normalizeSourceText(input.periodEnd, 'periodEnd'),
    warehouse: normalizeSourceText(input.warehouse, 'warehouse'),
    rawItemName,
    normalizedItemKey: normalizeItemKey(rawItemName),
    quantity,
    externalIdentityKey: buildAggregateLineIdentityKey(input),
    matchStatus: 'UNMATCHED',
  };
};

export const toSalesSnapshotLinePayload = (
  line: NormalizedAggregateSalesLine,
): SalesSnapshotLinePayload => ({
  externalIdentityKey: line.externalIdentityKey,
  provider: line.provider,
  sourceReportId: line.sourceReportId,
  periodStart: line.periodStart,
  periodEnd: line.periodEnd,
  warehouse: line.warehouse,
  sourceFileName: line.sourceFileName ?? null,
  sourceRowNumber: line.sourceRowNumber ?? null,
  rawItemName: line.rawItemName,
  normalizedItemKey: line.normalizedItemKey,
  quantity: decimalStringToApiNumber(line.quantity, 'quantity') as number,
  averagePriceBeforeDiscount: decimalTengeToMoney(line.averagePriceBeforeDiscount),
  averagePrice: decimalTengeToMoney(line.averagePrice),
  revenueBeforeDiscount: decimalTengeToMoney(line.revenueBeforeDiscount),
  revenue: decimalTengeToMoney(line.revenue),
  grossProfit: decimalTengeToMoney(line.grossProfit),
  grossProfitBeforeVat: decimalTengeToMoney(line.grossProfitBeforeVat),
  markupPercent: decimalStringToApiNumber(line.markupPercent, 'markupPercent'),
  concept: line.concept ?? null,
  revenueSharePercent: decimalStringToApiNumber(line.revenueSharePercent, 'revenueSharePercent'),
  matchStatus: line.matchStatus,
});

export type AggregateSalesLineRecord = NormalizedAggregateSalesLine & { id: string };

export type AggregateSalesLineRepository = {
  findByExternalIdentityKey: (key: string) => Promise<AggregateSalesLineRecord | null>;
  create: (line: NormalizedAggregateSalesLine) => Promise<AggregateSalesLineRecord>;
  update: (id: string, patch: Partial<NormalizedAggregateSalesLine>) => Promise<AggregateSalesLineRecord>;
};

export type AggregateImportResult = {
  created: number;
  updated: number;
  skipped: number;
  conflicts: Array<{ key: string; reason: string }>;
};

export const importAggregateSalesLines = async (
  inputs: AggregateSalesLineInput[],
  repository: AggregateSalesLineRepository,
): Promise<AggregateImportResult> => {
  const result: AggregateImportResult = { created: 0, updated: 0, skipped: 0, conflicts: [] };

  for (const input of inputs) {
    const normalized = normalizeAggregateSalesLine(input);
    const existing = await repository.findByExternalIdentityKey(normalized.externalIdentityKey);
    if (!existing) {
      await repository.create(normalized);
      result.created += 1;
      continue;
    }

    if (existing.rawItemName !== normalized.rawItemName) {
      result.conflicts.push({ key: normalized.externalIdentityKey, reason: 'raw item name conflict' });
      continue;
    }

    const patch: Partial<NormalizedAggregateSalesLine> = {
      quantity: normalized.quantity,
      averagePriceBeforeDiscount: normalized.averagePriceBeforeDiscount,
      averagePrice: normalized.averagePrice,
      revenueBeforeDiscount: normalized.revenueBeforeDiscount,
      revenue: normalized.revenue,
      grossProfit: normalized.grossProfit,
      markupPercent: normalized.markupPercent,
      grossProfitBeforeVat: normalized.grossProfitBeforeVat,
      concept: normalized.concept,
      revenueSharePercent: normalized.revenueSharePercent,
    };
    const changed = Object.entries(patch).some(([key, value]) => existing[key as keyof AggregateSalesLineRecord] !== value);
    if (!changed) {
      result.skipped += 1;
      continue;
    }
    await repository.update(existing.id, patch);
    result.updated += 1;
  }

  return result;
};
