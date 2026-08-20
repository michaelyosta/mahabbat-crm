import { defineObject, FieldType } from 'twenty-sdk/define';

export const INVENTORY_STOCK_ITEM_UNIVERSAL_IDENTIFIER =
  'b22e1f00-aaaa-4aaa-8000-000000000201';
export const INVENTORY_STOCK_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  'b22e1f00-bbbb-4aaa-8000-000000000202';
export const INVENTORY_STOCK_ITEM_TYPE_FIELD_UNIVERSAL_IDENTIFIER =
  'b22e1f00-cccc-4aaa-8000-000000000203';
export const INVENTORY_STOCK_ITEM_UNIT_KIND_FIELD_UNIVERSAL_IDENTIFIER =
  'b22e1f00-dddd-4aaa-8000-000000000204';
export const INVENTORY_STOCK_ITEM_BASE_UNIT_FIELD_UNIVERSAL_IDENTIFIER =
  'b22e1f00-eeee-4aaa-8000-000000000205';
export const INVENTORY_STOCK_ITEM_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER =
  'b22e1f00-ffff-4aaa-8000-000000000206';
export const INVENTORY_STOCK_ITEM_DEFAULT_LOCATION_FIELD_UNIVERSAL_IDENTIFIER =
  'b22e1f00-aaaa-4bbb-8000-000000000207';

export default defineObject({
  universalIdentifier: INVENTORY_STOCK_ITEM_UNIVERSAL_IDENTIFIER,
  nameSingular: 'inventoryStockItem',
  namePlural: 'inventoryStockItems',
  labelSingular: 'Позиция склада',
  labelPlural: 'Позиции склада',
  description: 'Универсальная складская позиция (сырьё/полуфабрикат)',
  icon: 'IconPackage',
  labelIdentifierFieldMetadataUniversalIdentifier:
    INVENTORY_STOCK_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: INVENTORY_STOCK_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Название',
      description: 'Название складской позиции',
      icon: 'IconTag',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: INVENTORY_STOCK_ITEM_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'itemType',
      label: 'Тип',
      description: 'RAW_MATERIAL или SEMI_FINISHED',
      icon: 'IconCategory',
      isNullable: false,
      defaultValue: "'RAW_MATERIAL'",
      options: [
        { id: 'b22e1f00-1111-4aaa-8000-000000000211', value: 'RAW_MATERIAL', label: 'Сырьё', position: 0, color: 'blue' },
        { id: 'b22e1f00-2222-4aaa-8000-000000000212', value: 'SEMI_FINISHED', label: 'Полуфабрикат', position: 1, color: 'orange' },
      ],
    },
    {
      universalIdentifier: INVENTORY_STOCK_ITEM_UNIT_KIND_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'unitKind',
      label: 'Семейство единиц',
      description: 'MASS/VOLUME/COUNT',
      icon: 'IconRuler',
      isNullable: false,
      defaultValue: "'MASS'",
      options: [
        { id: 'b22e1f00-3333-4aaa-8000-000000000213', value: 'MASS', label: 'Масса', position: 0, color: 'green' },
        { id: 'b22e1f00-4444-4aaa-8000-000000000214', value: 'VOLUME', label: 'Объём', position: 1, color: 'blue' },
        { id: 'b22e1f00-5555-4aaa-8000-000000000215', value: 'COUNT', label: 'Штуки', position: 2, color: 'yellow' },
      ],
    },
    {
      universalIdentifier: INVENTORY_STOCK_ITEM_BASE_UNIT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'baseUnit',
      label: 'Базовая единица',
      description: 'GRAM/MILLILITER/PIECE',
      icon: 'IconScale',
      isNullable: false,
      defaultValue: "'GRAM'",
      options: [
        { id: 'b22e1f00-6666-4aaa-8000-000000000216', value: 'GRAM', label: 'г', position: 0, color: 'gray' },
        { id: 'b22e1f00-7777-4aaa-8000-000000000217', value: 'MILLILITER', label: 'мл', position: 1, color: 'gray' },
        { id: 'b22e1f00-8888-4aaa-8000-000000000218', value: 'PIECE', label: 'шт', position: 2, color: 'gray' },
      ],
    },
    {
      universalIdentifier: INVENTORY_STOCK_ITEM_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Активна',
      description: 'Позиция доступна для движений',
      icon: 'IconToggleRight',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: INVENTORY_STOCK_ITEM_DEFAULT_LOCATION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'defaultLocationId',
      label: 'Точка по умолчанию',
      description: 'Default StockLocation для списаний',
      icon: 'IconMapPin',
      isNullable: true,
      defaultValue: null,
    },
  ],
});
