import { defineObject, FieldType } from 'twenty-sdk/define';

export const INVENTORY_RECIPE_UNIVERSAL_IDENTIFIER = 'e55e1f00-aaaa-4aaa-8000-000000000501';
export const INVENTORY_RECIPE_LABEL_FIELD_UNIVERSAL_IDENTIFIER = 'e55e1f00-bbbb-4aaa-8000-000000000502';
export const INVENTORY_RECIPE_TARGET_KIND_FIELD_UNIVERSAL_IDENTIFIER = 'e55e1f00-cccc-4aaa-8000-000000000503';
export const INVENTORY_RECIPE_TARGET_ID_FIELD_UNIVERSAL_IDENTIFIER = 'e55e1f00-dddd-4aaa-8000-000000000504';
export const INVENTORY_RECIPE_DEFAULT_LOCATION_FIELD_UNIVERSAL_IDENTIFIER = 'e55e1f00-eeee-4aaa-8000-000000000505';
export const INVENTORY_RECIPE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER = 'e55e1f00-ffff-4aaa-8000-000000000506';

export default defineObject({
  universalIdentifier: INVENTORY_RECIPE_UNIVERSAL_IDENTIFIER,
  nameSingular: 'inventoryRecipe',
  namePlural: 'inventoryRecipes',
  labelSingular: 'Калькуляция',
  labelPlural: 'Калькуляции',
  description: 'Калькуляционная карта на MenuItem или полуфабрикат',
  icon: 'IconChefHat',
  labelIdentifierFieldMetadataUniversalIdentifier: INVENTORY_RECIPE_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    { universalIdentifier: INVENTORY_RECIPE_LABEL_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'label', label: 'Название', icon: 'IconTag', isNullable: false, defaultValue: "''" },
    {
      universalIdentifier: INVENTORY_RECIPE_TARGET_KIND_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT, name: 'targetKind', label: 'Тип цели', icon: 'IconTarget', isNullable: false, defaultValue: "'MENU_ITEM'",
      options: [
        { id: 'e55e1f00-1111-4aaa-8000-000000000511', value: 'MENU_ITEM', label: 'Блюдо', position: 0, color: 'blue' },
        { id: 'e55e1f00-2222-4aaa-8000-000000000512', value: 'SEMI_FINISHED', label: 'Полуфабрикат', position: 1, color: 'orange' },
      ],
    },
    { universalIdentifier: INVENTORY_RECIPE_TARGET_ID_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'targetId', label: 'ID цели', description: 'MenuItemId или StockItemId', icon: 'IconHash', isNullable: false, defaultValue: "''" },
    { universalIdentifier: INVENTORY_RECIPE_DEFAULT_LOCATION_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'defaultLocationId', label: 'Точка списания', icon: 'IconMapPin', isNullable: true, defaultValue: null },
    { universalIdentifier: INVENTORY_RECIPE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.BOOLEAN, name: 'isActive', label: 'Активна', icon: 'IconToggleRight', isNullable: false, defaultValue: true },
  ],
});
