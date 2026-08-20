import { defineObject, FieldType } from 'twenty-sdk/define';

export const INVENTORY_STOCK_LOCATION_UNIVERSAL_IDENTIFIER =
  'a11e1f00-aaaa-4aaa-8000-000000000101';
export const INVENTORY_STOCK_LOCATION_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  'a11e1f00-bbbb-4aaa-8000-000000000102';
export const INVENTORY_STOCK_LOCATION_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER =
  'a11e1f00-cccc-4aaa-8000-000000000103';
export const INVENTORY_STOCK_LOCATION_SORT_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  'a11e1f00-dddd-4aaa-8000-000000000104';

export default defineObject({
  universalIdentifier: INVENTORY_STOCK_LOCATION_UNIVERSAL_IDENTIFIER,
  nameSingular: 'inventoryStockLocation',
  namePlural: 'inventoryStockLocations',
  labelSingular: 'Точка хранения',
  labelPlural: 'Точки хранения',
  description: 'Складская точка хранения (Кухня/Бар/Шашлыки)',
  icon: 'IconBuildingWarehouse',
  labelIdentifierFieldMetadataUniversalIdentifier:
    INVENTORY_STOCK_LOCATION_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: INVENTORY_STOCK_LOCATION_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Название',
      description: 'Название точки хранения',
      icon: 'IconMapPin',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: INVENTORY_STOCK_LOCATION_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Активна',
      description: 'Точка доступна для движений',
      icon: 'IconToggleRight',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: INVENTORY_STOCK_LOCATION_SORT_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'sortOrder',
      label: 'Порядок',
      description: 'Порядок сортировки',
      icon: 'IconSortAscending',
      isNullable: false,
      defaultValue: 0,
    },
  ],
});
