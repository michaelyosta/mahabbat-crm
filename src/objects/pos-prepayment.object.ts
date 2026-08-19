import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';
import {
  POS_RESERVATION_PREPAYMENTS_FIELD_UNIVERSAL_IDENTIFIER,
  POS_RESERVATION_UNIVERSAL_IDENTIFIER,
} from './pos-reservation.object';
import {
  POS_ORDER_PREPAYMENTS_FIELD_UNIVERSAL_IDENTIFIER,
  POS_ORDER_UNIVERSAL_IDENTIFIER,
} from './pos-order.object';
import {
  POS_PAYMENT_METHOD_PREPAYMENTS_FIELD_UNIVERSAL_IDENTIFIER,
  POS_PAYMENT_METHOD_UNIVERSAL_IDENTIFIER,
} from './pos-payment-method.object';

export const POS_PREPAYMENT_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890f5';
export const POS_PREPAYMENT_LABEL_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890f6';
export const POS_PREPAYMENT_RESERVATION_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890f7';
export const POS_PREPAYMENT_RESERVATION_PREPAYMENTS_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890f8';
export const POS_PREPAYMENT_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890f9';
export const POS_PREPAYMENT_ORDER_PREPAYMENTS_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890fa';
export const POS_PREPAYMENT_PAYMENT_METHOD_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890fb';
export const POS_PREPAYMENT_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890fc';
export const POS_PREPAYMENT_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890fd';
export const POS_PREPAYMENT_CREATED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890fe';
export const POS_PREPAYMENT_APPLIED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890ff';
export const POS_PREPAYMENT_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890a0';
export const POS_PREPAYMENT_APPLY_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890a3';
export const POS_PREPAYMENT_APPLIED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890a4';
export const POS_PREPAYMENT_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890a5';
export const POS_PREPAYMENT_UNIQUE_APPLY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890a6';

export default defineObject({
  universalIdentifier: POS_PREPAYMENT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posPrepayment',
  namePlural: 'posPrepayments',
  labelSingular: 'Предоплата POS',
  labelPlural: 'Предоплаты POS',
  description: 'Controlled reservation prepayment record',
  icon: 'IconCash',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_PREPAYMENT_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_PREPAYMENT_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'label',
      label: 'Метка',
      description: 'Метка предоплаты',
      icon: 'IconTag',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_PREPAYMENT_RESERVATION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'reservation',
      label: 'Бронь',
      description: 'Бронь, по которой внесена предоплата',
      icon: 'IconCalendarEvent',
      relationTargetObjectMetadataUniversalIdentifier:
        POS_RESERVATION_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        POS_RESERVATION_PREPAYMENTS_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'reservationId',
      },
    },
    {
      universalIdentifier: POS_PREPAYMENT_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'order',
      label: 'Заказ',
      description: 'Заказ, к которому применена предоплата',
      icon: 'IconShoppingCart',
      relationTargetObjectMetadataUniversalIdentifier:
        POS_ORDER_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        POS_ORDER_PREPAYMENTS_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'orderId',
      },
    },
    {
      universalIdentifier:
        POS_PREPAYMENT_PAYMENT_METHOD_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'paymentMethod',
      label: 'Метод оплаты',
      description: 'Метод, которым внесена предоплата',
      icon: 'IconCreditCard',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        POS_PAYMENT_METHOD_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        POS_PAYMENT_METHOD_PREPAYMENTS_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'paymentMethodId',
      },
    },
    {
      universalIdentifier: POS_PREPAYMENT_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'amount',
      label: 'Сумма',
      description: 'Предоплата в KZT micros',
      icon: 'IconCash',
      isNullable: false,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PREPAYMENT_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Статус',
      description: 'UNAPPLIED до связи с заказом, APPLIED после CAS',
      icon: 'IconStatusChange',
      isNullable: false,
      defaultValue: "'UNAPPLIED'",
      isUIEditable: false,
      options: [
        {
          id: '7a4d7f10-2b3c-4d5e-8f60-1234567890c1',
          value: 'UNAPPLIED',
          label: 'Не применена',
          position: 0,
          color: 'orange',
        },
        {
          id: '7a4d7f10-2b3c-4d5e-8f60-1234567890c2',
          value: 'APPLIED',
          label: 'Применена',
          position: 1,
          color: 'green',
        },
        {
          id: '7a4d7f10-2b3c-4d5e-8f60-1234567890c3',
          value: 'REJECTED',
          label: 'Отклонена',
          position: 2,
          color: 'red',
        },
      ],
    },
    {
      universalIdentifier:
        POS_PREPAYMENT_CREATED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'createdByStaffId',
      label: 'Создал',
      description: 'Actor из PosSession при создании',
      icon: 'IconUserPlus',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier:
        POS_PREPAYMENT_APPLIED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'appliedByStaffId',
      label: 'Применил',
      description: 'Actor из PosSession при применении',
      icon: 'IconUserCheck',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PREPAYMENT_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Ключ создания',
      description: 'Retry-safe create key',
      icon: 'IconRepeat',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier:
        POS_PREPAYMENT_APPLY_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'applyIdempotencyKey',
      label: 'Ключ применения',
      description: 'Retry-safe apply key',
      icon: 'IconRepeat',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PREPAYMENT_APPLIED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'appliedAt',
      label: 'Дата применения',
      description: 'Время применения к заказу',
      icon: 'IconClockCheck',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
  ],
});
