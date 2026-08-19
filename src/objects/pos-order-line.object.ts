import { defineObject, FieldType, NumberDataType, OnDeleteAction, RelationType } from 'twenty-sdk/define';

export const POS_ORDER_LINE_UNIVERSAL_IDENTIFIER =
  'e526ebd1-bc93-42eb-91c7-59430a781d7f';
export const POS_ORDER_LINE_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  '17593803-af63-4c2e-a8ff-0f6f098e79ca';
export const POS_ORDER_LINE_GUEST_FIELD_UNIVERSAL_IDENTIFIER =
  '9ef04791-7301-4419-889c-555819fe9688';
export const POS_ORDER_LINE_MENU_ITEM_FIELD_UNIVERSAL_IDENTIFIER =
  '356b729c-e51b-4a6f-ae83-f26e0870e330';
export const POS_ORDER_LINE_ITEM_NAME_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER =
  'eaaf0fd0-9f00-4019-93e4-49c999a5185d';
export const POS_ORDER_LINE_UNIT_PRICE_FIELD_UNIVERSAL_IDENTIFIER =
  '8bf389e0-9647-4466-a5da-0d449d0b85b3';
export const POS_ORDER_LINE_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER =
  'f290b1f4-1db4-463b-9dfa-eb215fd634e5';
export const POS_ORDER_LINE_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '932e8349-9a41-4b0e-855c-d9868f32ec13';
export const POS_ORDER_LINE_VOIDED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '763a54ca-2903-4d7c-a9b1-c4da9839239e';
export const POS_ORDER_LINE_VOID_REASON_FIELD_UNIVERSAL_IDENTIFIER =
  '1f293efe-b128-421e-878d-e70f6688adec';
export const POS_ORDER_LINE_VOID_PREPARED_STATE_FIELD_UNIVERSAL_IDENTIFIER =
  '3001402f-c7a1-4a3a-ab29-7106dada8e0e';
export const POS_ORDER_LINE_VOIDED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '71e0a6d5-b243-45fe-b260-7c7385ab04e8';
export const POS_ORDER_LINE_CREATED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '28f2815f-7ea8-46d2-bb6a-5fe12948ff63';
export const POS_ORDER_LINE_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '4fbb111e-f88d-4273-a781-ac393756c3a2';
export const POS_ORDER_LINE_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '6f6eab89-15da-4f20-863d-bbf21cddcecb';

export default defineObject({
  universalIdentifier: POS_ORDER_LINE_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posOrderLine',
  namePlural: 'posOrderLines',
  labelSingular: 'Позиция заказа',
  labelPlural: 'Позиции заказа',
  description: 'Позиция в заказе POS с ценовым снапшотом меню',
  icon: 'IconList',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_ORDER_LINE_ITEM_NAME_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_ORDER_LINE_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'order',
      label: 'Заказ',
      description: 'Заказ, содержащий позицию',
      icon: 'IconShoppingCart',
      relationTargetObjectMetadataUniversalIdentifier:
        'a967e1ff-fea2-4a77-959a-c16460f51377',
      relationTargetFieldMetadataUniversalIdentifier:
        '828a4a69-0619-433e-91bc-f23068c2d3d7',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'orderId',
      },
    },
    {
      universalIdentifier: POS_ORDER_LINE_GUEST_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'guest',
      label: 'Гость',
      description: 'Гость, за которым закреплена позиция',
      icon: 'IconUser',
      relationTargetObjectMetadataUniversalIdentifier:
        '18c37988-f756-4ef0-bf40-75183a7584a9',
      relationTargetFieldMetadataUniversalIdentifier:
        '60671e06-c064-410a-853d-987dc76696df',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'guestId',
      },
    },
    {
      universalIdentifier: POS_ORDER_LINE_MENU_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'menuItem',
      label: 'Позиция меню',
      description: 'Исходная позиция меню',
      icon: 'IconFileDescription',
      relationTargetObjectMetadataUniversalIdentifier:
        'c1523420-522c-48cf-953d-ac10c534488e',
      relationTargetFieldMetadataUniversalIdentifier:
        'a068393e-a10e-439b-88ba-16ceb29b7991',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'menuItemId',
      },
    },
    {
      universalIdentifier: POS_ORDER_LINE_ITEM_NAME_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'itemNameSnapshot',
      label: 'Название (снапшот)',
      description: 'Название позиции на момент заказа',
      icon: 'IconTag',
      isNullable: false,
      defaultValue: '',
    },
    {
      universalIdentifier: POS_ORDER_LINE_UNIT_PRICE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'unitPrice',
      label: 'Цена (снапшот)',
      description: 'Цена позиции на момент заказа',
      icon: 'IconCash',
      isNullable: false,
      defaultValue: { amountMicros: '0', currencyCode: 'KZT' },
    },
    {
      universalIdentifier: POS_ORDER_LINE_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'quantity',
      label: 'Количество',
      description: 'Количество единиц позиции',
      icon: 'IconNumber',
      isNullable: false,
      defaultValue: 1,
      universalSettings: {
        dataType: NumberDataType.INT,
      },
    },
    {
      universalIdentifier: POS_ORDER_LINE_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Статус',
      description: 'Состояние позиции',
      icon: 'IconStatusChange',
      isNullable: false,
      defaultValue: "'ACTIVE'",
      options: [
        {
          id: '4b0f9d15-9e1c-4f5b-9f2a-0c8b1d2e3f01',
          value: 'ACTIVE',
          label: 'Активна',
          position: 0,
          color: 'green',
        },
        {
          id: '4b0f9d15-9e1c-4f5b-9f2a-0c8b1d2e3f02',
          value: 'VOIDED',
          label: 'Списана',
          position: 1,
          color: 'red',
        },
      ],
    },
    {
      universalIdentifier: POS_ORDER_LINE_VOIDED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'voidedAt',
      label: 'Время списания',
      description: 'Момент списания позиции',
      icon: 'IconClockX',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_ORDER_LINE_VOID_REASON_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'voidReason',
      label: 'Причина списания',
      description: 'Причина списания позиции',
      icon: 'IconNotes',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_ORDER_LINE_VOID_PREPARED_STATE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'voidPreparedState',
      label: 'Готовность при списании',
      description: 'Состояние готовности позиции на момент списания',
      icon: 'IconChefHat',
      isNullable: true,
      defaultValue: null,
      options: [
        {
          id: '5c1a0e26-af2d-4c6b-8f3b-1d9c2e3f4a01',
          value: 'PREPARED',
          label: 'Приготовлена',
          position: 0,
          color: 'yellow',
        },
        {
          id: '5c1a0e26-af2d-4c6b-8f3b-1d9c2e3f4a02',
          value: 'NOT_PREPARED',
          label: 'Не приготовлена',
          position: 1,
          color: 'gray',
        },
      ],
    },
    {
      universalIdentifier: POS_ORDER_LINE_VOIDED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'voidedByStaffId',
      label: 'Списал',
      description: 'Сотрудник, списавший позицию',
      icon: 'IconUserX',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_ORDER_LINE_CREATED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'createdByStaffId',
      label: 'Добавил',
      description: 'Сотрудник, добавивший позицию',
      icon: 'IconUserPlus',
      isNullable: false,
      isUIEditable: false,
      defaultValue: '',
    },
    {
      universalIdentifier: POS_ORDER_LINE_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Ключ идемпотентности',
      description: 'Ключ повторяемости команды добавления позиции',
      icon: 'IconRepeat',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
  ],
});
