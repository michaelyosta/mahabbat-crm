import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';
import { POS_TABLE_UNIVERSAL_IDENTIFIER } from './pos-table.object';
import { POS_ORDER_UNIVERSAL_IDENTIFIER } from './pos-order.object';

export const POS_RESERVATION_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890e1';
export const POS_RESERVATION_LABEL_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890e2';
export const POS_RESERVATION_TABLE_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890e3';
export const POS_RESERVATION_TABLE_RESERVATIONS_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890e4';
export const POS_RESERVATION_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890e5';
export const POS_RESERVATION_ORDER_RESERVATIONS_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890e6';
export const POS_RESERVATION_PREPAYMENTS_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890e0';
export const POS_RESERVATION_SCHEDULED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890e7';
export const POS_RESERVATION_GUEST_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890e8';
export const POS_RESERVATION_PHONE_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890e9';
export const POS_RESERVATION_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890ea';
export const POS_RESERVATION_CREATED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890eb';
export const POS_RESERVATION_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890ec';
export const POS_RESERVATION_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890ed';

export default defineObject({
  universalIdentifier: POS_RESERVATION_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posReservation',
  namePlural: 'posReservations',
  labelSingular: 'Бронь POS',
  labelPlural: 'Брони POS',
  description: 'Operational table reservation for the POS layer',
  icon: 'IconCalendarEvent',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_RESERVATION_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_RESERVATION_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'label',
      label: 'Метка',
      description: 'Метка брони',
      icon: 'IconTag',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_RESERVATION_TABLE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'table',
      label: 'Стол',
      description: 'Забронированный операционный стол',
      icon: 'IconArmchair',
      relationTargetObjectMetadataUniversalIdentifier:
        POS_TABLE_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        POS_RESERVATION_TABLE_RESERVATIONS_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'tableId',
      },
    },
    {
      universalIdentifier: POS_RESERVATION_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'order',
      label: 'Заказ',
      description: 'Заказ, связанный с визитом',
      icon: 'IconShoppingCart',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        POS_ORDER_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        '7a4d7f10-2b3c-4d5e-8f60-1234567890a3',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'orderId',
      },
    },
    {
      universalIdentifier: POS_RESERVATION_PREPAYMENTS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'prepayments',
      label: 'Предоплаты',
      description: 'Предоплаты этой брони',
      icon: 'IconReceipt',
      relationTargetObjectMetadataUniversalIdentifier:
        '8a4d7f10-2b3c-4d5e-8f60-1234567890f5',
      relationTargetFieldMetadataUniversalIdentifier:
        '8a4d7f10-2b3c-4d5e-8f60-1234567890f7',
      universalSettings: { relationType: RelationType.ONE_TO_MANY },
    },
    {
      universalIdentifier:
        POS_RESERVATION_SCHEDULED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'scheduledAt',
      label: 'Время',
      description: 'Планируемое время визита',
      icon: 'IconClock',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_RESERVATION_GUEST_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'guestName',
      label: 'Имя гостя',
      description: 'Имя гостя, если клиент ещё не выбран',
      icon: 'IconUser',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_RESERVATION_PHONE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'phone',
      label: 'Телефон',
      description: 'Телефон гостя без обязательного Customer link',
      icon: 'IconPhone',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_RESERVATION_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Статус',
      description: 'Операционный статус брони',
      icon: 'IconStatusChange',
      isNullable: false,
      defaultValue: "'ACTIVE'",
      isUIEditable: false,
      options: [
        {
          id: '8a4d7f10-2b3c-4d5e-8f60-1234567890f1',
          value: 'ACTIVE',
          label: 'Активна',
          position: 0,
          color: 'blue',
        },
        {
          id: '8a4d7f10-2b3c-4d5e-8f60-1234567890f2',
          value: 'COMPLETED',
          label: 'Завершена',
          position: 1,
          color: 'green',
        },
        {
          id: '8a4d7f10-2b3c-4d5e-8f60-1234567890f3',
          value: 'CANCELLED',
          label: 'Отменена',
          position: 2,
          color: 'red',
        },
        {
          id: '8a4d7f10-2b3c-4d5e-8f60-1234567890f4',
          value: 'NO_SHOW',
          label: 'Не пришёл',
          position: 3,
          color: 'orange',
        },
      ],
    },
    {
      universalIdentifier:
        POS_RESERVATION_CREATED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'createdByStaffId',
      label: 'Создал',
      description: 'Actor из PosSession',
      icon: 'IconUserPlus',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_RESERVATION_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Ключ идемпотентности',
      description: 'Server-owned retry key',
      icon: 'IconRepeat',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
  ],
});
