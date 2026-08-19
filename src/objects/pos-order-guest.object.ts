import { defineObject, FieldType, NumberDataType, OnDeleteAction, RelationType } from 'twenty-sdk/define';

export const POS_ORDER_GUEST_UNIVERSAL_IDENTIFIER =
  '18c37988-f756-4ef0-bf40-75183a7584a9';
export const POS_ORDER_GUEST_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  'a9d8fb05-bf57-48bb-ab2a-50d72ad6fe6f';
export const POS_ORDER_GUEST_ORDINAL_FIELD_UNIVERSAL_IDENTIFIER =
  '3e1017ba-201c-48b6-8bfd-8f56951c4cc4';
export const POS_ORDER_GUEST_DISPLAY_NUMBER_FIELD_UNIVERSAL_IDENTIFIER =
  '7a3ce967-acf7-40d7-96da-60366aff6d81';
export const POS_ORDER_GUEST_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '46bcf57f-e297-4525-b297-f018d8ec1c5b';
export const POS_ORDER_GUEST_SUBTOTAL_FIELD_UNIVERSAL_IDENTIFIER =
  '9081cc5f-4a4c-4442-b88b-3e0b7f50d20f';
export const POS_ORDER_GUEST_LINES_FIELD_UNIVERSAL_IDENTIFIER =
  '60671e06-c064-410a-853d-987dc76696df';
export const POS_ORDER_GUEST_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  'b3fdbef4-d42a-4ccb-a468-227824dfd186';
export const POS_ORDER_GUEST_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  'e743efac-352d-48a6-9215-28fc6428a8d6';

export default defineObject({
  universalIdentifier: POS_ORDER_GUEST_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posOrderGuest',
  namePlural: 'posOrderGuests',
  labelSingular: 'Гость заказа',
  labelPlural: 'Гости заказа',
  description: 'Гость внутри заказа POS; позиции принадлежат гостю',
  icon: 'IconUser',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_ORDER_GUEST_DISPLAY_NUMBER_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_ORDER_GUEST_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'order',
      label: 'Заказ',
      description: 'Заказ, в котором сидит гость',
      icon: 'IconShoppingCart',
      relationTargetObjectMetadataUniversalIdentifier:
        'a967e1ff-fea2-4a77-959a-c16460f51377',
      relationTargetFieldMetadataUniversalIdentifier:
        'b8f6c55e-16e1-41eb-9480-7e7a529eff82',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'orderId',
      },
    },
    {
      universalIdentifier: POS_ORDER_GUEST_ORDINAL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'ordinal',
      label: 'Порядковый номер',
      description: 'Порядок добавления гостя в заказ',
      icon: 'IconNumber',
      isNullable: false,
      defaultValue: 1,
      universalSettings: {
        dataType: NumberDataType.INT,
      },
    },
    {
      universalIdentifier: POS_ORDER_GUEST_DISPLAY_NUMBER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'displayNumber',
      label: 'Отображаемый номер',
      description: 'Отображаемое имя гостя, например "Гость 1"',
      icon: 'IconTag',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_ORDER_GUEST_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Имя',
      description: 'Опциональное имя гостя',
      icon: 'IconUser',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_ORDER_GUEST_SUBTOTAL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'subtotal',
      label: 'Подытог гостя',
      description: 'Сумма активных позиций гостя',
      icon: 'IconCalculator',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_ORDER_GUEST_LINES_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'lines',
      label: 'Позиции',
      description: 'Позиции, закреплённые за гостем',
      icon: 'IconList',
      relationTargetObjectMetadataUniversalIdentifier:
        'e526ebd1-bc93-42eb-91c7-59430a781d7f',
      relationTargetFieldMetadataUniversalIdentifier:
        '9ef04791-7301-4419-889c-555819fe9688',
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: POS_ORDER_GUEST_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Ключ идемпотентности',
      description: 'Ключ повторяемости команды добавления гостя',
      icon: 'IconRepeat',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
  ],
});
