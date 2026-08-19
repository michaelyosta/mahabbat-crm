import { defineObject, FieldType, NumberDataType, RelationType } from 'twenty-sdk/define';

export const POS_PAYMENT_METHOD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890ab';
export const POS_PAYMENT_METHOD_LABEL_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890ac';
export const POS_PAYMENT_METHOD_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890ad';
export const POS_PAYMENT_METHOD_TYPE_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890ae';
export const POS_PAYMENT_METHOD_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890af';
export const POS_PAYMENT_METHOD_SORT_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890a1';
export const POS_PAYMENT_METHOD_PAYMENTS_FIELD_UNIVERSAL_IDENTIFIER =
  '8a4d7f10-2b3c-4d5e-8f60-1234567890a2';

export default defineObject({
  universalIdentifier: POS_PAYMENT_METHOD_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posPaymentMethod',
  namePlural: 'posPaymentMethods',
  labelSingular: 'Метод оплаты POS',
  labelPlural: 'Методы оплаты POS',
  description: 'Конфигурируемый способ оплаты операционного заказа',
  icon: 'IconCreditCard',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_PAYMENT_METHOD_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_PAYMENT_METHOD_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'label',
      label: 'Метка',
      description: 'Метка метода оплаты',
      icon: 'IconTag',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_PAYMENT_METHOD_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Название',
      description: 'Пользовательское название метода оплаты',
      icon: 'IconCash',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_PAYMENT_METHOD_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'methodType',
      label: 'Тип',
      description: 'Базовый тип метода; банки могут быть OTHER',
      icon: 'IconCategory',
      isNullable: false,
      defaultValue: "'OTHER'",
      options: [
        {
          id: '8a4d7f10-2b3c-4d5e-8f60-1234567890b1',
          value: 'CASH',
          label: 'Наличные',
          position: 0,
          color: 'green',
        },
        {
          id: '8a4d7f10-2b3c-4d5e-8f60-1234567890b2',
          value: 'CARD',
          label: 'Карта',
          position: 1,
          color: 'blue',
        },
        {
          id: '8a4d7f10-2b3c-4d5e-8f60-1234567890b3',
          value: 'OTHER',
          label: 'Другой',
          position: 2,
          color: 'orange',
        },
      ],
    },
    {
      universalIdentifier: POS_PAYMENT_METHOD_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Активен',
      description: 'Доступен для новых платежей',
      icon: 'IconCheck',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: POS_PAYMENT_METHOD_SORT_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'sortOrder',
      label: 'Порядок',
      description: 'Порядок показа в POS',
      icon: 'IconListNumbers',
      isNullable: false,
      defaultValue: 0,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier: POS_PAYMENT_METHOD_PAYMENTS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'payments',
      label: 'Платежи',
      description: 'Платежи с этим методом',
      icon: 'IconReceipt',
      relationTargetObjectMetadataUniversalIdentifier:
        '8a4d7f10-2b3c-4d5e-8f60-1234567890c1',
      relationTargetFieldMetadataUniversalIdentifier:
        '8a4d7f10-2b3c-4d5e-8f60-1234567890c4',
      universalSettings: { relationType: RelationType.ONE_TO_MANY },
    },
  ],
});
