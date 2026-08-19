import { defineObject, FieldType, RelationType } from 'twenty-sdk/define';

export const POS_SHIFT_UNIVERSAL_IDENTIFIER =
  'c97fccd8-3295-4462-bb20-c7db1d6ba0dd';
export const POS_SHIFT_LABEL_FIELD_UNIVERSAL_IDENTIFIER =
  'b2574d29-a14e-4fba-b91e-1f2c19d75734';
export const POS_SHIFT_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  'd0f3e579-efbf-4de3-90a8-2328e22eb3f2';
export const POS_SHIFT_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '2f9c80d6-ac52-4aaa-b5aa-c860598d3aba';
export const POS_SHIFT_OPENED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '51fc1c3f-27a6-4ccf-8ece-38e0aa353c08';
export const POS_SHIFT_CLOSED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '2c66d6c6-24be-4f8d-b9a4-b9b1fddf6d5b';
export const POS_SHIFT_IS_OPEN_FIELD_UNIVERSAL_IDENTIFIER =
  'c803c75c-d52c-4174-8d95-963b49b66607';
export const POS_SHIFT_OPEN_TOKEN_FIELD_UNIVERSAL_IDENTIFIER =
  '310efff4-2439-43e0-92e3-a4b98cc08a73';
export const POS_SHIFT_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  'a8c8d1b7-1d8e-403e-bb80-11e53cb14cd0';
export const POS_SHIFT_ORDERS_FIELD_UNIVERSAL_IDENTIFIER =
  'dfa4e9b8-cdb7-42f2-bb98-1ea5459b3a3f';
export const POS_SHIFT_UNIQUE_STAFF_IS_OPEN_INDEX_UNIVERSAL_IDENTIFIER =
  '58422381-3aa9-42ae-aa09-21352365bebb';
export const POS_SHIFT_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  'ff0096e0-8aad-47e7-a32e-c24074283e17';

export default defineObject({
  universalIdentifier: POS_SHIFT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posShift',
  namePlural: 'posShifts',
  labelSingular: 'Смена POS',
  labelPlural: 'Смены POS',
  description: 'Открытая рабочая смена официанта',
  icon: 'IconCalendarEvent',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_SHIFT_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_SHIFT_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'label',
      label: 'Метка',
      description: 'Текстовый идентификатор смены',
      icon: 'IconTag',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_SHIFT_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'staffId',
      label: 'Сотрудник',
      description: 'Идентификатор PosStaff, открывшего смену',
      icon: 'IconUser',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_SHIFT_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Статус',
      description: 'Состояние смены',
      icon: 'IconStatusChange',
      isNullable: false,
      defaultValue: "'OPEN'",
      options: [
        {
          id: '62dd7b31-2d99-45cf-9b7d-6b5c20a0e0c1',
          value: 'OPEN',
          label: 'Открыта',
          position: 0,
          color: 'green',
        },
        {
          id: 'a5c415f9-7ce5-4bfd-8f2f-1b453f60d213',
          value: 'CLOSED',
          label: 'Закрыта',
          position: 1,
          color: 'gray',
        },
      ],
    },
    {
      universalIdentifier: POS_SHIFT_OPENED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'openedAt',
      label: 'Время открытия',
      description: 'Момент открытия смены',
      icon: 'IconClock',
      isNullable: false,
      defaultValue: 'now',
    },
    {
      universalIdentifier: POS_SHIFT_CLOSED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'closedAt',
      label: 'Время закрытия',
      description: 'Момент закрытия смены',
      icon: 'IconClockX',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_SHIFT_IS_OPEN_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isOpen',
      label: 'Открыта',
      description: 'Признак активной смены; null после закрытия',
      icon: 'IconDoorEnter',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_SHIFT_OPEN_TOKEN_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'openToken',
      label: 'Токен открытия',
      description: 'Уникальный маркер активной смены; снимается при закрытии',
      icon: 'IconKey',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_SHIFT_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Ключ идемпотентности',
      description: 'Ключ повторяемости команды открытия смены',
      icon: 'IconRepeat',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_SHIFT_ORDERS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'orders',
      label: 'Заказы',
      description: 'Заказы, открытые в рамках этой смены',
      icon: 'IconShoppingCart',
      relationTargetObjectMetadataUniversalIdentifier:
        'a967e1ff-fea2-4a77-959a-c16460f51377',
      relationTargetFieldMetadataUniversalIdentifier:
        '90b7c38e-6db9-4646-adf5-725d27450d23',
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
