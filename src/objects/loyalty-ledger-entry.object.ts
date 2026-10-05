import {
  defineObject,
  FieldType,
  NumberDataType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export const LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER =
  'ce455a03-74bd-460f-863b-4da2f2138979';
export const LOYALTY_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER =
  'ade48490-f3d2-4e6d-88e6-891c928d6945';
export const LOYALTY_ENTRIES_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  'fbe228b3-8d3f-48a1-8bbd-a9e346de2ba2';
export const LOYALTY_TYPE_FIELD_UNIVERSAL_IDENTIFIER =
  'e2679091-25e4-4d5d-ae6a-0d01551fc3cd';
export const LOYALTY_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER =
  '5ca04f28-aac5-45aa-bd73-24583c9f75af';
export const LOYALTY_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'bd5e410d-65b4-4ff6-b47b-4254cb88c1c7';
export const LOYALTY_RELATED_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  '0f419655-5bf8-48be-a170-6075f3625414';
export const LOYALTY_ENTRIES_ON_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  'e65549f4-84db-4c25-a98a-0f1aafd6688f';
export const LOYALTY_REASON_FIELD_UNIVERSAL_IDENTIFIER =
  '6647e390-6f37-4ec6-a108-1ed0ecbf84f1';
export const LOYALTY_ACTOR_SOURCE_FIELD_UNIVERSAL_IDENTIFIER =
  '32943007-b743-48f2-b29a-c7025efca3c1';
export const LOYALTY_SOURCE_FIELD_UNIVERSAL_IDENTIFIER =
  'dd5c39dc-0325-440a-9009-919676b58463';
export const LOYALTY_UNIQUE_CUSTOMER_OCCURRED_AT_REASON_INDEX_UNIVERSAL_IDENTIFIER =
  'cc2619e1-6990-415e-9f2c-ef18fae65049';
// Removed in P1: the composite unique (customer, occurredAt, reason) rejected
// two legitimate adjustments made in the same millisecond with the same
// reason. Exactly-once is owned by sourceRequestId + idempotencyKey.
export const LOYALTY_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '28493870-e6f8-47c0-ab9c-57061e3912e6';
export const LOYALTY_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '6f2a766a-bbaa-43c7-829b-8be40f873dc0';
export const LOYALTY_UNIQUE_IDEMPOTENCY_KEY_INDEX_FIELD_UNIVERSAL_IDENTIFIER =
  'cd54cd43-0d4f-4222-9f3d-63c740327d85';
export const LOYALTY_SOURCE_REQUEST_FIELD_UNIVERSAL_IDENTIFIER =
  '3aecf988-a446-4cf6-8a5e-0c9a6b382d3d';
export const LOYALTY_UNIQUE_SOURCE_REQUEST_INDEX_UNIVERSAL_IDENTIFIER =
  '87df3f68-820f-4484-8565-c55ea48e6ceb';
export const LOYALTY_UNIQUE_SOURCE_REQUEST_INDEX_FIELD_UNIVERSAL_IDENTIFIER =
  '9ea2c80f-b12e-40eb-96b8-1574dcd5d92f';

export default defineObject({
  universalIdentifier: LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
  nameSingular: 'loyaltyLedgerEntry',
  namePlural: 'loyaltyLedgerEntries',
  labelSingular: 'Операция лояльности',
  labelPlural: 'Лояльность',
  description: 'Запись движения баллов лояльности',
  icon: 'IconCards',
  isSearchable: true,
  isUIEditable: false,
  isUICreatable: false,
  labelIdentifierFieldMetadataUniversalIdentifier:
    LOYALTY_REASON_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: LOYALTY_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'customer',
      label: 'Клиент',
      description: 'Клиент, чей баланс изменяет операция',
      icon: 'IconUser',
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        LOYALTY_ENTRIES_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'customerId',
      },
    },
    {
      universalIdentifier: LOYALTY_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'entryType',
      label: 'Тип операции',
      description: 'Начисление, списание или корректировка',
      icon: 'IconTag',
      isNullable: false,
      defaultValue: "'EARN'",
      options: [
        {
          id: 'bb928ac3-836d-4d97-b078-bb41b6167b29',
          value: 'EARN',
          label: 'Начисление',
          position: 0,
          color: 'green',
        },
        {
          id: '3111f410-e028-4ad8-ae16-60db0c9dc789',
          value: 'REDEEM',
          label: 'Списание',
          position: 1,
          color: 'red',
        },
        {
          id: 'e5da734f-a296-4769-a469-8e427a0ecdde',
          value: 'ADJUSTMENT',
          label: 'Корректировка',
          position: 2,
          color: 'blue',
        },
      ],
    },
    {
      universalIdentifier: LOYALTY_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'amount',
      label: 'Сумма баллов',
      description: 'Целое число баллов; положительное или отрицательное',
      icon: 'IconNumber',
      isNullable: false,
      defaultValue: 0,
      universalSettings: {
        dataType: NumberDataType.INT,
      },
    },
    {
      universalIdentifier: LOYALTY_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'occurredAt',
      label: 'Дата операции',
      description: 'Время, когда операция произошла',
      icon: 'IconClock',
      isNullable: false,
      defaultValue: 'now',
    },
    {
      universalIdentifier: LOYALTY_RELATED_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'relatedOrder',
      label: 'Связанный заказ',
      description: 'Заказ, связанный с операцией лояльности',
      icon: 'IconShoppingCart',
      relationTargetObjectMetadataUniversalIdentifier:
        '1640fcc5-d992-40a5-acd2-37e98161e6db',
      relationTargetFieldMetadataUniversalIdentifier:
        LOYALTY_ENTRIES_ON_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'relatedOrderId',
      },
    },
    {
      universalIdentifier: LOYALTY_SOURCE_REQUEST_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'sourceRequest',
      label: 'Основание операции',
      description:
        'Заявка, на основании которой создана операция',
      icon: 'IconReceipt2',
      relationTargetObjectMetadataUniversalIdentifier:
        '26a57aa5-e064-48ce-bad1-53e4d456e4ca',
      relationTargetFieldMetadataUniversalIdentifier:
        '7cad10fc-d631-4127-b48d-2218bd038af0',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'sourceRequestId',
      },
    },
    {
      universalIdentifier: LOYALTY_REASON_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'reason',
      label: 'Причина',
      description: 'Причина начисления или корректировки',
      icon: 'IconMessage',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: LOYALTY_ACTOR_SOURCE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'actorSource',
      label: 'Кто провёл',
      description: 'Система или сотрудник, создавший операцию',
      icon: 'IconUserCog',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: LOYALTY_SOURCE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'source',
      label: 'Канал операции',
      description: 'Канал, через который создана операция',
      icon: 'IconSourceCode',
      isNullable: true,
      defaultValue: null,
      options: [
        {
          id: '36459814-3c57-4bd9-9dae-14f3a04c8bb1',
          value: 'MANUAL',
          label: 'Вручную',
          position: 0,
          color: 'gray',
        },
        {
          id: '443add9b-548e-4a9a-b0a0-401a5489ca71',
          value: 'POS',
          label: 'POS',
          position: 1,
          color: 'blue',
        },
        {
          id: '36c4a2d1-6b99-407b-8be8-6b0a8bdd71dd',
          value: 'IMPORT',
          label: 'Импорт',
          position: 2,
          color: 'green',
        },
        {
          id: '842230ae-2ac0-4dbd-ad66-928b0aff76f3',
          value: 'API',
          label: 'API',
          position: 3,
          color: 'cyan',
        },
        {
          id: 'c306819f-6cad-409f-b672-3c26d48da2df',
          value: 'OTHER',
          label: 'Другое',
          position: 4,
          color: 'orange',
        },
      ],
    },
  ],
});
