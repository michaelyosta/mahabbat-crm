import { defineObject, FieldType, OnDeleteAction, RelationType } from 'twenty-sdk/define';

export const POS_KITCHEN_TICKET_UNIVERSAL_IDENTIFIER =
  '7c1a2f34-5b67-4d89-8e01-23456789abcd';
export const POS_KITCHEN_TICKET_LABEL_FIELD_UNIVERSAL_IDENTIFIER =
  '7c1a2f34-5b67-4d89-8e01-23456789abce';
export const POS_KITCHEN_TICKET_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  '7c1a2f34-5b67-4d89-8e01-23456789abcf';
export const POS_KITCHEN_TICKET_TYPE_FIELD_UNIVERSAL_IDENTIFIER =
  '7c1a2f34-5b67-4d89-8e01-23456789abd0';
export const POS_KITCHEN_TICKET_CREATED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '7c1a2f34-5b67-4d89-8e01-23456789abd2';
export const POS_KITCHEN_TICKET_PRINT_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '7c1a2f34-5b67-4d89-8e01-23456789abd3';
export const POS_KITCHEN_TICKET_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '7c1a2f34-5b67-4d89-8e01-23456789abd4';
export const POS_KITCHEN_TICKET_REQUEST_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '7c1a2f34-5b67-4d89-8e01-23456789abd5';
export const POS_KITCHEN_TICKET_CREATED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '7c1a2f34-5b67-4d89-8e01-23456789abda';
export const POS_KITCHEN_TICKET_LINES_FIELD_UNIVERSAL_IDENTIFIER =
  '7c1a2f34-5b67-4d89-8e01-23456789abd6';
export const POS_KITCHEN_TICKET_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '7c1a2f34-5b67-4d89-8e01-23456789abd7';
export const POS_KITCHEN_TICKET_UNIQUE_REQUEST_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '7c1a2f34-5b67-4d89-8e01-23456789abd8';

export default defineObject({
  universalIdentifier: POS_KITCHEN_TICKET_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posKitchenTicket',
  namePlural: 'posKitchenTickets',
  labelSingular: 'Кухонная фиша',
  labelPlural: 'Кухонные фиши',
  description:
    'Неизменяемая команда кухни; в Slice 2 используется mock/debug printer adapter',
  icon: 'IconChefHat',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_KITCHEN_TICKET_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_KITCHEN_TICKET_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'label',
      label: 'Метка',
      description: 'Человекочитаемая метка kitchen ticket',
      icon: 'IconTag',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_KITCHEN_TICKET_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'order',
      label: 'Заказ',
      description: 'Заказ, для которого создана кухонная фиша',
      icon: 'IconShoppingCart',
      relationTargetObjectMetadataUniversalIdentifier:
        'a967e1ff-fea2-4a77-959a-c16460f51377',
      relationTargetFieldMetadataUniversalIdentifier:
        'f1e6d6a2-7b63-4c9a-8d21-1e5f4a6b7c80',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'orderId',
      },
    },
    {
      universalIdentifier: POS_KITCHEN_TICKET_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'ticketType',
      label: 'Тип фиши',
      description: 'Команда добавления или отмены позиции',
      icon: 'IconArrowsExchange',
      isNullable: false,
      defaultValue: "'NEW_ITEMS'",
      options: [
        {
          id: '7c1a2f34-5b67-4d89-8e01-23456789abe1',
          value: 'NEW_ITEMS',
          label: 'Новые позиции',
          position: 0,
          color: 'blue',
        },
        {
          id: '7c1a2f34-5b67-4d89-8e01-23456789abe2',
          value: 'CANCELLATION',
          label: 'Отмена',
          position: 1,
          color: 'red',
        },
      ],
    },
    {
      universalIdentifier:
        POS_KITCHEN_TICKET_CREATED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'createdByStaffId',
      label: 'Отправил',
      description: 'Staff identity из POS session',
      icon: 'IconUserPlus',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_KITCHEN_TICKET_PRINT_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'printStatus',
      label: 'Статус печати',
      description: 'Состояние printer adapter',
      icon: 'IconPrinter',
      isNullable: false,
      defaultValue: "'QUEUED'",
      isUIEditable: false,
      options: [
        {
          id: '7c1a2f34-5b67-4d89-8e01-23456789abe5',
          value: 'QUEUED',
          label: 'Ожидает отправки',
          position: 0,
          color: 'blue',
        },
        {
          id: '7c1a2f34-5b67-4d89-8e01-23456789abe3',
          value: 'PRINTED',
          label: 'Старая запись',
          position: 1,
          color: 'green',
        },
        {
          id: '7c1a2f34-5b67-4d89-8e01-23456789abe4',
          value: 'FAILED',
          label: 'Ошибка',
          position: 2,
          color: 'red',
        },
        { id: '7c1a2f34-5b67-4d89-8e01-23456789abe6', value: 'DISPATCHING', label: 'Отправляется', position: 3, color: 'yellow' },
        { id: '7c1a2f34-5b67-4d89-8e01-23456789abe7', value: 'SENT', label: 'Отправлено', position: 4, color: 'green' },
        { id: '7c1a2f34-5b67-4d89-8e01-23456789abe8', value: 'OUTCOME_UNKNOWN', label: 'Результат неизвестен', position: 5, color: 'orange' },
        { id: '7c1a2f34-5b67-4d89-8e01-23456789abe9', value: 'CONFIRMED', label: 'Подтверждено', position: 6, color: 'green' },
      ],
    },
    {
      universalIdentifier: POS_KITCHEN_TICKET_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Семантический ключ',
      description: 'Уникальный ключ конкретного набора ещё не отправленных позиций',
      icon: 'IconRepeat',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier:
        POS_KITCHEN_TICKET_REQUEST_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'requestIdempotencyKey',
      label: 'Ключ запроса',
      description: 'Ключ повторяемости внешней POS-команды печати',
      icon: 'IconRepeat',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_KITCHEN_TICKET_LINES_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'lines',
      label: 'Позиции фиши',
      description: 'Неизменяемые строки кухонной фиши',
      icon: 'IconList',
      relationTargetObjectMetadataUniversalIdentifier:
        '8d2b3f45-6c78-4e90-9f12-3456789abcde',
      relationTargetFieldMetadataUniversalIdentifier:
        '8d2b3f45-6c78-4e90-9f12-3456789abcdf',
      universalSettings: { relationType: RelationType.ONE_TO_MANY },
    },
  ],
});
