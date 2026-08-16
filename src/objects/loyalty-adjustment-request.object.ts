import {
  defineObject,
  FieldType,
  NumberDataType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export const LOYALTY_ADJUSTMENT_REQUEST_UNIVERSAL_IDENTIFIER =
  '26a57aa5-e064-48ce-bad1-53e4d456e4ca';
export const LOYALTY_ADJUSTMENT_REQUEST_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER =
  'e96f7ce4-ffac-4f04-96ef-8d54f3db226c';
export const LOYALTY_ADJUSTMENT_REQUESTS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  'f7dbdb8a-a949-4496-b61c-a3e5337db7de';
export const LOYALTY_ADJUSTMENT_REQUEST_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER =
  '47e49783-9dc4-4a03-b840-064a7753bc8b';
export const LOYALTY_ADJUSTMENT_REQUEST_REASON_FIELD_UNIVERSAL_IDENTIFIER =
  'c960b53c-6c33-4024-8978-9168a40b588e';
export const LOYALTY_ADJUSTMENT_REQUEST_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '00383c82-5679-4ff9-9c5b-52aa18f7a8cf';
export const LOYALTY_ADJUSTMENT_REQUEST_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '7907d1b5-4e76-4548-8d7e-612890ea146c';
export const LOYALTY_ADJUSTMENT_REQUEST_PROCESSED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'cd0e1ea9-627c-4717-a9b2-1a723755e0bd';
export const LOYALTY_ADJUSTMENT_REQUEST_ERROR_FIELD_UNIVERSAL_IDENTIFIER =
  '52158be1-3e4c-43f7-b294-ed9624189ed6';
export const LOYALTY_ADJUSTMENT_REQUEST_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '27dfa770-7497-405b-9612-081a58edab77';
export const LOYALTY_ADJUSTMENT_REQUEST_UNIQUE_IDEMPOTENCY_KEY_INDEX_FIELD_UNIVERSAL_IDENTIFIER =
  '01c3df8e-1922-4cd8-847d-e806a06c46b2';
export const LOYALTY_ADJUSTMENT_REQUEST_LEDGER_ENTRIES_FIELD_UNIVERSAL_IDENTIFIER =
  '7cad10fc-d631-4127-b48d-2218bd038af0';

export default defineObject({
  universalIdentifier: LOYALTY_ADJUSTMENT_REQUEST_UNIVERSAL_IDENTIFIER,
  nameSingular: 'loyaltyAdjustmentRequest',
  namePlural: 'loyaltyAdjustmentRequests',
  labelSingular: 'Заявка на корректировку бонусов',
  labelPlural: 'Заявки на корректировку бонусов',
  description:
    'Внутренняя заявка, из которой App-функция создаёт проверяемую операцию в истории бонусов',
  icon: 'IconReceipt2',
  isSearchable: false,
  isUIEditable: false,
  isUICreatable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    LOYALTY_ADJUSTMENT_REQUEST_REASON_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier:
        LOYALTY_ADJUSTMENT_REQUEST_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'customer',
      label: 'Клиент',
      description: 'Клиент, чей баланс изменяет заявка',
      icon: 'IconUser',
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        LOYALTY_ADJUSTMENT_REQUESTS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'customerId',
      },
    },
    {
      universalIdentifier:
        LOYALTY_ADJUSTMENT_REQUEST_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'amount',
      label: 'Корректировка, баллы',
      description: 'Ненулевое целое число баллов',
      icon: 'IconNumber',
      isNullable: false,
      defaultValue: 0,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier:
        LOYALTY_ADJUSTMENT_REQUEST_REASON_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'reason',
      label: 'Причина',
      description: 'Основание ручной корректировки',
      icon: 'IconMessage',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier:
        LOYALTY_ADJUSTMENT_REQUEST_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Ключ идемпотентности',
      description: 'Защита от повторной обработки одной заявки',
      icon: 'IconKey',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier:
        LOYALTY_ADJUSTMENT_REQUEST_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Статус обработки',
      description: 'Технический результат обработки заявки',
      icon: 'IconProgressCheck',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "'PENDING'",
      options: [
        { id: 'f4d05a29-161e-4cc7-ae9f-16516162d25d', value: 'PENDING', label: 'Ожидает', position: 0, color: 'yellow' },
        { id: 'd3979f72-5c56-415a-b0fe-ea9edc0b00cb', value: 'APPLIED', label: 'Применена', position: 1, color: 'green' },
        { id: 'c522e3f0-5af7-4679-9b36-ea0ea2bfbdb4', value: 'REJECTED', label: 'Отклонена', position: 2, color: 'red' },
      ],
    },
    {
      universalIdentifier:
        LOYALTY_ADJUSTMENT_REQUEST_PROCESSED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'processedAt',
      label: 'Обработана',
      description: 'Время завершения обработки заявки',
      icon: 'IconClockCheck',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier:
        LOYALTY_ADJUSTMENT_REQUEST_ERROR_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'error',
      label: 'Ошибка обработки',
      description: 'Причина отклонения заявки, если операция не создана',
      icon: 'IconExclamationCircle',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier:
        LOYALTY_ADJUSTMENT_REQUEST_LEDGER_ENTRIES_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'ledgerEntries',
      label: 'Созданные операции бонусов',
      description:
        'Операции в истории бонусов, созданные из этой контролируемой заявки',
      icon: 'IconCards',
      relationTargetObjectMetadataUniversalIdentifier:
        'ce455a03-74bd-460f-863b-4da2f2138979',
      relationTargetFieldMetadataUniversalIdentifier:
        '3aecf988-a446-4cf6-8a5e-0c9a6b382d3d',
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
