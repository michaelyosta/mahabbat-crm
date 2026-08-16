import {
  defineObject,
  FieldType,
  NumberDataType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

export const ORDER_ITEM_UNIVERSAL_IDENTIFIER =
  'be60c91b-3de6-4630-b6a7-0861caedb554';
export const ORDER_ITEM_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  '3d92993a-f3d1-4661-97a7-4343576638b4';
export const ORDER_ITEM_MENU_ITEM_FIELD_UNIVERSAL_IDENTIFIER =
  'fde1db67-bb66-44d5-9ac6-a2eb6530764f';
export const ORDER_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '5a700182-4578-4b38-9545-e1c12b19704f';
export const ORDER_ITEM_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER =
  '3a1546eb-01f9-43e6-b41d-ca2c8633a620';
export const ORDER_ITEM_UNIT_PRICE_FIELD_UNIVERSAL_IDENTIFIER =
  'd2499d45-624e-4eb2-8a9a-645fdfc2372b';
export const ORDER_ITEM_TOTAL_FIELD_UNIVERSAL_IDENTIFIER =
  '93ec9ea9-93d5-47bc-87ce-d80dc5abcf9a';
export const ORDER_ITEM_UNIQUE_ORDER_MENU_ITEM_INDEX_UNIVERSAL_IDENTIFIER =
  'd3a1ada5-baa9-4eca-85c1-6c4099326f4a';

export default defineObject({
  universalIdentifier: ORDER_ITEM_UNIVERSAL_IDENTIFIER,
  nameSingular: 'orderItem',
  namePlural: 'orderItems',
  labelSingular: 'Позиция заказа',
  labelPlural: 'Позиции заказа',
  description: 'Строка заказа с позицией и ценой',
  icon: 'IconList',
  isSearchable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    ORDER_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: ORDER_ITEM_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'order',
      label: 'Заказ',
      description: 'Заказ, к которому относится позиция',
      icon: 'IconShoppingCart',
      relationTargetObjectMetadataUniversalIdentifier:
        '1640fcc5-d992-40a5-acd2-37e98161e6db',
      relationTargetFieldMetadataUniversalIdentifier:
        '9ebf16fb-ddfe-4f38-8a3c-6186221d4b6b',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'orderId',
      },
    },
    {
      universalIdentifier: ORDER_ITEM_MENU_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'menuItem',
      label: 'Позиция меню',
      description: 'Ключ или идентификатор позиции меню',
      icon: 'IconSoup',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: ORDER_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Название',
      description: 'Название блюда на момент заказа',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: ORDER_ITEM_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'quantity',
      label: 'Количество',
      icon: 'IconNumber',
      isNullable: false,
      defaultValue: 1,
      universalSettings: {
        dataType: NumberDataType.INT,
      },
    },
    {
      universalIdentifier: ORDER_ITEM_UNIT_PRICE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'unitPrice',
      label: 'Цена за единицу',
      icon: 'IconCash',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: ORDER_ITEM_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'total',
      label: 'Итог позиции',
      description: 'Сумма строки с учётом количества',
      icon: 'IconCalculator',
      isNullable: true,
      defaultValue: null,
    },
  ],
});
