import { defineObject, FieldType, NumberDataType } from 'twenty-sdk/define';

export const SALES_SNAPSHOT_LINE_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678901';
export const SALES_SNAPSHOT_LINE_EXTERNAL_IDENTITY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678902';
export const SALES_SNAPSHOT_LINE_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678903';
export const SALES_SNAPSHOT_LINE_SOURCE_REPORT_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678904';
export const SALES_SNAPSHOT_LINE_PERIOD_START_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678905';
export const SALES_SNAPSHOT_LINE_PERIOD_END_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678906';
export const SALES_SNAPSHOT_LINE_WAREHOUSE_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678907';
export const SALES_SNAPSHOT_LINE_SOURCE_FILE_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678908';
export const SALES_SNAPSHOT_LINE_SOURCE_ROW_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678909';
export const SALES_SNAPSHOT_LINE_RAW_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678910';
export const SALES_SNAPSHOT_LINE_NORMALIZED_ITEM_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678911';
export const SALES_SNAPSHOT_LINE_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678912';
export const SALES_SNAPSHOT_LINE_AVERAGE_PRICE_BEFORE_DISCOUNT_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678913';
export const SALES_SNAPSHOT_LINE_AVERAGE_PRICE_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678914';
export const SALES_SNAPSHOT_LINE_REVENUE_BEFORE_DISCOUNT_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678915';
export const SALES_SNAPSHOT_LINE_REVENUE_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678916';
export const SALES_SNAPSHOT_LINE_GROSS_PROFIT_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678917';
export const SALES_SNAPSHOT_LINE_MARKUP_PERCENT_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678918';
export const SALES_SNAPSHOT_LINE_GROSS_PROFIT_BEFORE_VAT_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678919';
export const SALES_SNAPSHOT_LINE_CONCEPT_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678920';
export const SALES_SNAPSHOT_LINE_REVENUE_SHARE_PERCENT_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678921';
export const SALES_SNAPSHOT_LINE_MATCH_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '9b4e5f67-8a90-4b12-9cde-1f2345678922';
export default defineObject({
  universalIdentifier: SALES_SNAPSHOT_LINE_UNIVERSAL_IDENTIFIER,
  nameSingular: 'salesSnapshotLine',
  namePlural: 'salesSnapshotLines',
  labelSingular: 'Строка агрегированных продаж',
  labelPlural: 'Строки агрегированных продаж',
  description: 'Исторические агрегаты, не являющиеся заказами',
  icon: 'IconChartLine',
  isSearchable: true,
  isUIEditable: false,
  isUICreatable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    SALES_SNAPSHOT_LINE_RAW_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_EXTERNAL_IDENTITY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'externalIdentityKey',
      label: 'Служебный ключ отчёта',
      description: 'Системный ключ строки отчёта для защиты от дублей.',
      icon: 'IconKey',
      isNullable: true,
      isUnique: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'provider',
      label: 'Источник данных',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_SOURCE_REPORT_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'sourceReportId',
      label: 'ID отчёта',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_PERIOD_START_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE,
      name: 'periodStart',
      label: 'Начало периода',
      isNullable: false,
      isUIEditable: false,
      defaultValue: 'now',
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_PERIOD_END_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE,
      name: 'periodEnd',
      label: 'Конец периода',
      isNullable: false,
      isUIEditable: false,
      defaultValue: 'now',
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_WAREHOUSE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'warehouse',
      label: 'Подразделение',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_SOURCE_FILE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'sourceFileName',
      label: 'Исходный файл',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_SOURCE_ROW_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'sourceRowNumber',
      label: 'Строка источника',
      isNullable: true,
      isUIEditable: false,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_RAW_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'rawItemName',
      label: 'Название позиции (как в источнике)',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_NORMALIZED_ITEM_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'normalizedItemKey',
      label: 'Ключ позиции',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'quantity',
      label: 'Количество',
      isNullable: false,
      isUIEditable: false,
      defaultValue: 0,
      universalSettings: { dataType: NumberDataType.FLOAT, decimals: 3 },
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_AVERAGE_PRICE_BEFORE_DISCOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'averagePriceBeforeDiscount',
      label: 'Средняя цена без скидки',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_AVERAGE_PRICE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'averagePrice',
      label: 'Средняя цена',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_REVENUE_BEFORE_DISCOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'revenueBeforeDiscount',
      label: 'Выручка без скидки',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_REVENUE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'revenue',
      label: 'Выручка',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_GROSS_PROFIT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'grossProfit',
      label: 'Валовая прибыль',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_GROSS_PROFIT_BEFORE_VAT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'grossProfitBeforeVat',
      label: 'Валовая прибыль без НДС',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_MARKUP_PERCENT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'markupPercent',
      label: 'Наценка, %',
      isNullable: true,
      isUIEditable: false,
      universalSettings: { dataType: NumberDataType.FLOAT, decimals: 3 },
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_CONCEPT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'concept',
      label: 'Концепция',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_REVENUE_SHARE_PERCENT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'revenueSharePercent',
      label: '% от выручки',
      isNullable: true,
      isUIEditable: false,
      universalSettings: { dataType: NumberDataType.FLOAT, decimals: 3 },
    },
    {
      universalIdentifier: SALES_SNAPSHOT_LINE_MATCH_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'matchStatus',
      label: 'Сопоставление с меню',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "'UNMATCHED'",
      options: [
        { id: '9b4e5f67-8a90-4b12-9cde-1f2345678924', value: 'UNMATCHED', label: 'Не сопоставлено', position: 0, color: 'gray' },
        { id: '9b4e5f67-8a90-4b12-9cde-1f2345678925', value: 'REVIEW', label: 'Нужна проверка', position: 1, color: 'orange' },
        { id: '9b4e5f67-8a90-4b12-9cde-1f2345678926', value: 'MATCHED', label: 'Сопоставлено', position: 2, color: 'green' },
      ],
    },
  ],
});
