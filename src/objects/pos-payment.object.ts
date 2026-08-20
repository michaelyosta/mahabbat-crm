import { defineObject, FieldType, OnDeleteAction, RelationType } from 'twenty-sdk/define';
import {
  POS_PAYMENT_METHOD_PAYMENTS_FIELD_UNIVERSAL_IDENTIFIER,
  POS_PAYMENT_METHOD_UNIVERSAL_IDENTIFIER,
} from './pos-payment-method.object';

export const POS_PAYMENT_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890c1';
export const POS_PAYMENT_LABEL_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890c2';
export const POS_PAYMENT_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890c3';
export const POS_PAYMENT_METHOD_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890c4';
export const POS_PAYMENT_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890c5';
export const POS_PAYMENT_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890c6';
export const POS_PAYMENT_ACCEPTED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890c7';
export const POS_PAYMENT_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890c8';
export const POS_PAYMENT_LOCK_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890c9';
export const POS_PAYMENT_METHOD_NAME_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890ca';
export const POS_PAYMENT_METHOD_TYPE_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890cb';
export const POS_PAYMENT_ORDER_PAID_TOTAL_BEFORE_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890d6';
export const POS_PAYMENT_APPLIED_TO_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890d7';
export const POS_PAYMENT_TENDERED_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890d9';
export const POS_PAYMENT_CHANGE_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890da';
export const POS_PAYMENT_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890cc';
export const POS_PAYMENT_UNIQUE_LOCK_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890cd';

export default defineObject({
  universalIdentifier: POS_PAYMENT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posPayment',
  namePlural: 'posPayments',
  labelSingular: 'Платёж POS',
  labelPlural: 'Платежи POS',
  description: 'Controlled immutable payment record for a prechecked POS order',
  icon: 'IconReceipt',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_PAYMENT_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_PAYMENT_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'label',
      label: 'Метка',
      description: 'Метка платежа',
      icon: 'IconTag',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_PAYMENT_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'order',
      label: 'Заказ',
      description: 'Оплачиваемый операционный заказ',
      icon: 'IconShoppingCart',
      relationTargetObjectMetadataUniversalIdentifier:
        'a967e1ff-fea2-4a77-959a-c16460f51377',
      relationTargetFieldMetadataUniversalIdentifier:
        '8a4d7f10-2b3c-4d5e-8f60-1234567890d1',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'orderId',
      },
    },
    {
      universalIdentifier: POS_PAYMENT_METHOD_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'paymentMethod',
      label: 'Метод оплаты',
      description: 'Конфигурируемый метод оплаты',
      icon: 'IconCreditCard',
      relationTargetObjectMetadataUniversalIdentifier:
        POS_PAYMENT_METHOD_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        POS_PAYMENT_METHOD_PAYMENTS_FIELD_UNIVERSAL_IDENTIFIER,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'paymentMethodId',
      },
    },
    {
      universalIdentifier: POS_PAYMENT_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'amount',
      label: 'Сумма',
      description: 'Успешная сумма в KZT micros',
      icon: 'IconCash',
      isNullable: false,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PAYMENT_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Статус',
      description: 'Техническое состояние controlled payment command',
      icon: 'IconStatusChange',
      isNullable: false,
      defaultValue: "'PENDING'",
      isUIEditable: false,
      options: [
        {
          id: '8a4d7f10-2b3c-4d5e-8f60-1234567890d2',
          value: 'PENDING',
          label: 'В обработке',
          position: 0,
          color: 'orange',
        },
        {
          id: '8a4d7f10-2b3c-4d5e-8f60-1234567890d3',
          value: 'SUCCESS',
          label: 'Успешен',
          position: 1,
          color: 'green',
        },
        {
          id: '8a4d7f10-2b3c-4d5e-8f60-1234567890d8',
          value: 'REJECTED',
          label: 'Отклонён',
          position: 2,
          color: 'red',
        },
      ],
    },
    {
      universalIdentifier:
        POS_PAYMENT_ACCEPTED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'acceptedByStaffId',
      label: 'Принял',
      description: 'Actor из PosSession',
      icon: 'IconUserPlus',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PAYMENT_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Ключ идемпотентности',
      description: 'Уникальный ключ recordPayment',
      icon: 'IconRepeat',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PAYMENT_LOCK_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'lockKey',
      label: 'Ключ сериализации',
      description: 'Server-owned per-order pending payment lock',
      icon: 'IconLock',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier:
        POS_PAYMENT_METHOD_NAME_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'paymentMethodNameSnapshot',
      label: 'Метод snapshot',
      description: 'Название метода на момент платежа',
      icon: 'IconTag',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier:
        POS_PAYMENT_METHOD_TYPE_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'paymentMethodTypeSnapshot',
      label: 'Тип метода snapshot',
      description: 'Тип метода на момент платежа',
      icon: 'IconCategory',
      isNullable: false,
      defaultValue: "'OTHER'",
      isUIEditable: false,
    },
    {
      universalIdentifier:
        POS_PAYMENT_ORDER_PAID_TOTAL_BEFORE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'orderPaidTotalBefore',
      label: 'Оплачено до операции',
      description: 'Server snapshot used to repair a crash before payment finalization',
      icon: 'IconHistory',
      isNullable: false,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PAYMENT_APPLIED_TO_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'appliedToOrder',
      label: 'Применён к заказу',
      description: 'Server-owned aggregate application marker',
      icon: 'IconCheck',
      isNullable: false,
      defaultValue: false,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PAYMENT_TENDERED_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'tenderedAmount',
      label: 'Передано',
      description: 'Cash tendered micros; null for non-cash or legacy payments',
      icon: 'IconCashBanknote',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PAYMENT_CHANGE_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'changeAmount',
      label: 'Сдача',
      description: 'Change micros computed server-side for cash; 0 otherwise',
      icon: 'IconCoins',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
  ],
});
