import { defineObject, FieldType, NumberDataType } from 'twenty-sdk/define';

export const INVENTORY_STOCK_BALANCE_UNIVERSAL_IDENTIFIER =
  'c33e1f00-aaaa-4aaa-8000-000000000301';
export const INVENTORY_STOCK_BALANCE_STOCK_ITEM_FIELD_UNIVERSAL_IDENTIFIER =
  'c33e1f00-bbbb-4aaa-8000-000000000302';
export const INVENTORY_STOCK_BALANCE_LOCATION_FIELD_UNIVERSAL_IDENTIFIER =
  'c33e1f00-cccc-4aaa-8000-000000000303';
export const INVENTORY_STOCK_BALANCE_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER =
  'c33e1f00-dddd-4aaa-8000-000000000304';
export const INVENTORY_STOCK_BALANCE_AVG_COST_FIELD_UNIVERSAL_IDENTIFIER =
  'c33e1f00-eeee-4aaa-8000-000000000305';
export const INVENTORY_STOCK_BALANCE_TOTAL_VALUE_FIELD_UNIVERSAL_IDENTIFIER =
  'c33e1f00-ffff-4aaa-8000-000000000306';
export const INVENTORY_STOCK_BALANCE_VERSION_FIELD_UNIVERSAL_IDENTIFIER =
  'c33e1f00-aaaa-4bbb-8000-000000000307';

export default defineObject({
  universalIdentifier: INVENTORY_STOCK_BALANCE_UNIVERSAL_IDENTIFIER,
  nameSingular: 'inventoryStockBalance',
  namePlural: 'inventoryStockBalances',
  labelSingular: 'Остаток',
  labelPlural: 'Остатки',
  description: 'Проекция остатка StockItem × Location (verified cache поверх ledger)',
  icon: 'IconStack2',
  labelIdentifierFieldMetadataUniversalIdentifier:
    INVENTORY_STOCK_BALANCE_STOCK_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: INVENTORY_STOCK_BALANCE_STOCK_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'stockItemId',
      label: 'Позиция',
      description: 'FK InventoryStockItem',
      icon: 'IconPackage',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: INVENTORY_STOCK_BALANCE_LOCATION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'locationId',
      label: 'Точка',
      description: 'FK InventoryStockLocation',
      icon: 'IconMapPin',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: INVENTORY_STOCK_BALANCE_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'quantityMicros',
      label: 'Количество (micros)',
      description: 'Сумма ledger в базовых micros (g*1000 / ml*1000 / pcs*1000)',
      icon: 'IconScale',
      isNullable: false,
      defaultValue: 0,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier: INVENTORY_STOCK_BALANCE_AVG_COST_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'averageCostMicros',
      label: 'Средняя цена (micros/kg)',
      description: 'Moving weighted average, целые micros KZT per base unit',
      icon: 'IconCash',
      isNullable: false,
      defaultValue: 0,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier: INVENTORY_STOCK_BALANCE_TOTAL_VALUE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'totalValueMicros',
      label: 'Стоимость остатка',
      description: 'quantityMicros * averageCostMicros / 1000 ??? храним как micros',
      icon: 'IconCalculator',
      isNullable: false,
      defaultValue: 0,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier: INVENTORY_STOCK_BALANCE_VERSION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'version',
      label: 'Версия',
      description: 'Optimistic version / watermark',
      icon: 'IconHash',
      isNullable: false,
      defaultValue: 0,
      universalSettings: { dataType: NumberDataType.INT },
    },
  ],
});
