import { defineObject, FieldType, NumberDataType } from 'twenty-sdk/define';

export const INVENTORY_RECIPE_LINE_UNIVERSAL_IDENTIFIER = 'a77e1f00-aaaa-4aaa-8000-000000000701';
export const INVENTORY_RECIPE_LINE_VERSION_FIELD_UNIVERSAL_IDENTIFIER = 'a77e1f00-bbbb-4aaa-8000-000000000702';
export const INVENTORY_RECIPE_LINE_STOCK_ITEM_FIELD_UNIVERSAL_IDENTIFIER = 'a77e1f00-cccc-4aaa-8000-000000000703';
export const INVENTORY_RECIPE_LINE_QTY_FIELD_UNIVERSAL_IDENTIFIER = 'a77e1f00-dddd-4aaa-8000-000000000704';
export const INVENTORY_RECIPE_LINE_SORT_ORDER_FIELD_UNIVERSAL_IDENTIFIER = 'a77e1f00-eeee-4aaa-8000-000000000705';

export default defineObject({
  universalIdentifier: INVENTORY_RECIPE_LINE_UNIVERSAL_IDENTIFIER,
  nameSingular: 'inventoryRecipeLine',
  namePlural: 'inventoryRecipeLines',
  labelSingular: 'Строка калькуляции',
  labelPlural: 'Строки калькуляций',
  description: 'Ингредиент калькуляции с количеством на выход',
  icon: 'IconListDetails',
  labelIdentifierFieldMetadataUniversalIdentifier: INVENTORY_RECIPE_LINE_STOCK_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    { universalIdentifier: INVENTORY_RECIPE_LINE_VERSION_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'recipeVersionId', label: 'Версия', icon: 'IconVersions', isNullable: false, defaultValue: "''" },
    { universalIdentifier: INVENTORY_RECIPE_LINE_STOCK_ITEM_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'stockItemId', label: 'Ингредиент', icon: 'IconPackage', isNullable: false, defaultValue: "''" },
    { universalIdentifier: INVENTORY_RECIPE_LINE_QTY_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.NUMBER, name: 'quantityMicros', label: 'Количество (micros)', icon: 'IconScale', isNullable: false, defaultValue: 0, universalSettings: { dataType: NumberDataType.INT } },
    { universalIdentifier: INVENTORY_RECIPE_LINE_SORT_ORDER_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.NUMBER, name: 'sortOrder', label: 'Порядок', icon: 'IconSortAscending', isNullable: false, defaultValue: 0, universalSettings: { dataType: NumberDataType.INT } },
  ],
});
