import { defineObject, FieldType, OnDeleteAction, RelationType } from 'twenty-sdk/define';

export const POS_ORDER_UNIVERSAL_IDENTIFIER =
  'a967e1ff-fea2-4a77-959a-c16460f51377';
export const POS_ORDER_LABEL_FIELD_UNIVERSAL_IDENTIFIER =
  '8ebe5a62-e387-4d53-afbd-7b7fe0573729';
export const POS_ORDER_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  'b21faa4f-d1d4-47cd-9332-f9aa04ab9a30';
export const POS_ORDER_SHIFT_FIELD_UNIVERSAL_IDENTIFIER =
  '90b7c38e-6db9-4646-adf5-725d27450d23';
export const POS_ORDER_TABLE_FIELD_UNIVERSAL_IDENTIFIER =
  '87844b37-ded0-45a4-a5df-5fb3bffba5e0';
export const POS_ORDER_OWNER_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '03229c69-a0ad-4ef3-b773-59de574acfd6';
export const POS_ORDER_OPENED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '23dc892b-b0ff-4bef-931f-0783792e4c72';
export const POS_ORDER_OPENED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '93c09035-d37a-4669-b289-f632c6ace756';
export const POS_ORDER_CLOSED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '5bf2500f-cf69-4a94-858f-02aa9ac7fff4';
export const POS_ORDER_CLAIM_TOKEN_FIELD_UNIVERSAL_IDENTIFIER =
  '6929c271-97f7-4316-bd15-dbc252afe0ea';
export const POS_ORDER_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '23f3bb89-5cd4-4645-ad5c-95902dd5c492';
export const POS_ORDER_GUESTS_FIELD_UNIVERSAL_IDENTIFIER =
  'b8f6c55e-16e1-41eb-9480-7e7a529eff82';
export const POS_ORDER_LINES_FIELD_UNIVERSAL_IDENTIFIER =
  '828a4a69-0619-433e-91bc-f23068c2d3d7';
export const POS_ORDER_SUBTOTAL_FIELD_UNIVERSAL_IDENTIFIER =
  '09f772d4-575e-4e5f-a1bc-9c69015b58ac';
export const POS_ORDER_TOTAL_FIELD_UNIVERSAL_IDENTIFIER =
  '4d5e7e89-cd8c-4298-b313-bbd6786e4caa';
export const POS_ORDER_NOTES_FIELD_UNIVERSAL_IDENTIFIER =
  '8121484b-87ef-4917-8e3c-9be13166cb3b';
export const POS_ORDER_KITCHEN_TICKETS_FIELD_UNIVERSAL_IDENTIFIER =
  'f1e6d6a2-7b63-4c9a-8d21-1e5f4a6b7c80';
export const POS_ORDER_PRECHECKS_FIELD_UNIVERSAL_IDENTIFIER =
  'a2b3c4d5-e6f7-4890-8123-456789abcdef';
export const POS_ORDER_UNIQUE_TABLE_CLAIM_INDEX_UNIVERSAL_IDENTIFIER =
  '20629f11-1305-4671-b7f7-0ddd4028afd6';
export const POS_ORDER_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '5b54a079-10c4-43fa-9635-466219e19c20';

export default defineObject({
  universalIdentifier: POS_ORDER_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posOrder',
  namePlural: 'posOrders',
  labelSingular: 'Заказ POS',
  labelPlural: 'Заказы POS',
  description: 'Операционный заказ на столе ресторана',
  icon: 'IconShoppingCart',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_ORDER_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_ORDER_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'label',
      label: 'Метка',
      description: 'Текстовый идентификатор заказа',
      icon: 'IconTag',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_ORDER_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Статус',
      description: 'Состояние заказа по машине состояний POS',
      icon: 'IconStatusChange',
      isNullable: false,
      defaultValue: "'OPEN'",
      options: [
        {
          id: '6c25af02-f5e0-4b1e-8e9c-2b3c4d5e6f01',
          value: 'OPEN',
          label: 'Открыт',
          position: 0,
          color: 'blue',
        },
        {
          id: '6c25af02-f5e0-4b1e-8e9c-2b3c4d5e6f02',
          value: 'IN_PROGRESS',
          label: 'В работе',
          position: 1,
          color: 'yellow',
        },
        {
          id: '6c25af02-f5e0-4b1e-8e9c-2b3c4d5e6f03',
          value: 'PRECHECK_PRINTED',
          label: 'Предчек распечатан',
          position: 2,
          color: 'orange',
        },
        {
          id: '6c25af02-f5e0-4b1e-8e9c-2b3c4d5e6f04',
          value: 'CLOSED',
          label: 'Закрыт',
          position: 3,
          color: 'gray',
        },
        {
          id: '6c25af02-f5e0-4b1e-8e9c-2b3c4d5e6f05',
          value: 'CANCELLED',
          label: 'Отменён',
          position: 4,
          color: 'red',
        },
      ],
    },
    {
      universalIdentifier: POS_ORDER_SHIFT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'shift',
      label: 'Смена',
      description: 'Смена, в которой открыт заказ',
      icon: 'IconCalendarEvent',
      relationTargetObjectMetadataUniversalIdentifier:
        'c97fccd8-3295-4462-bb20-c7db1d6ba0dd',
      relationTargetFieldMetadataUniversalIdentifier:
        'dfa4e9b8-cdb7-42f2-bb98-1ea5459b3a3f',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'shiftId',
      },
    },
    {
      universalIdentifier: POS_ORDER_TABLE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'table',
      label: 'Стол',
      description: 'Стол, на котором размещён заказ',
      icon: 'IconGridDots',
      relationTargetObjectMetadataUniversalIdentifier:
        '205a888c-c914-4069-9a47-9bdf3021cbb5',
      relationTargetFieldMetadataUniversalIdentifier:
        '98d21aeb-6efa-49f4-87d4-4a7b8fd4f9f9',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'tableId',
      },
    },
    {
      universalIdentifier: POS_ORDER_OWNER_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'ownerStaffId',
      label: 'Владелец',
      description: 'Сотрудник, которому принадлежит заказ',
      icon: 'IconUser',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_ORDER_OPENED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'openedByStaffId',
      label: 'Открыл',
      description: 'Сотрудник, открывший заказ',
      icon: 'IconUserPlus',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_ORDER_OPENED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'openedAt',
      label: 'Время открытия',
      description: 'Момент открытия заказа',
      icon: 'IconClock',
      isNullable: false,
      defaultValue: 'now',
    },
    {
      universalIdentifier: POS_ORDER_CLOSED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'closedAt',
      label: 'Время закрытия',
      description: 'Момент закрытия заказа',
      icon: 'IconClockX',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_ORDER_CLAIM_TOKEN_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'claimToken',
      label: 'Токен захвата стола',
      description: 'Детерминированный токен захвата стола (tableId); null после закрытия',
      icon: 'IconLock',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_ORDER_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Ключ идемпотентности',
      description: 'Ключ повторяемости команды открытия заказа',
      icon: 'IconRepeat',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_ORDER_GUESTS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'guests',
      label: 'Гости',
      description: 'Гости заказа',
      icon: 'IconUsers',
      relationTargetObjectMetadataUniversalIdentifier:
        '18c37988-f756-4ef0-bf40-75183a7584a9',
      relationTargetFieldMetadataUniversalIdentifier:
        'a9d8fb05-bf57-48bb-ab2a-50d72ad6fe6f',
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: POS_ORDER_LINES_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'lines',
      label: 'Позиции',
      description: 'Позиции заказа',
      icon: 'IconList',
      relationTargetObjectMetadataUniversalIdentifier:
        'e526ebd1-bc93-42eb-91c7-59430a781d7f',
      relationTargetFieldMetadataUniversalIdentifier:
        '17593803-af63-4c2e-a8ff-0f6f098e79ca',
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: POS_ORDER_SUBTOTAL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'subtotal',
      label: 'Подытог',
      description: 'Сумма активных позиций до скидок',
      icon: 'IconCalculator',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_ORDER_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'total',
      label: 'Итог',
      description: 'Итоговая сумма заказа',
      icon: 'IconCash',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_ORDER_NOTES_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'notes',
      label: 'Заметки',
      description: 'Комментарий к заказу',
      icon: 'IconNotes',
      isNullable: true,
      defaultValue: null,
      universalSettings: {
        displayedMaxRows: 4,
      },
    },
    {
      universalIdentifier: POS_ORDER_KITCHEN_TICKETS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'kitchenTickets',
      label: 'Кухонные фиши',
      description: 'Immutable команды кухни для заказа',
      icon: 'IconChefHat',
      relationTargetObjectMetadataUniversalIdentifier:
        '7c1a2f34-5b67-4d89-8e01-23456789abcd',
      relationTargetFieldMetadataUniversalIdentifier:
        '7c1a2f34-5b67-4d89-8e01-23456789abcf',
      universalSettings: { relationType: RelationType.ONE_TO_MANY },
    },
    {
      universalIdentifier: POS_ORDER_PRECHECKS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'prechecks',
      label: 'Пречеки',
      description: 'История серверных snapshots заказа',
      icon: 'IconReceipt',
      relationTargetObjectMetadataUniversalIdentifier:
        '9e3c4f56-7a89-4f01-8123-456789abcdef',
      relationTargetFieldMetadataUniversalIdentifier:
        '9e3c4f56-7a89-4f01-8123-456789abcdf1',
      universalSettings: { relationType: RelationType.ONE_TO_MANY },
    },
  ],
});
