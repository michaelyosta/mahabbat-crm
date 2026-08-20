import { defineObject, FieldType, NumberDataType } from 'twenty-sdk/define';

export const INVENTORY_RECIPE_VERSION_UNIVERSAL_IDENTIFIER = 'f66e1f00-aaaa-4aaa-8000-000000000601';
export const INVENTORY_RECIPE_VERSION_RECIPE_FIELD_UNIVERSAL_IDENTIFIER = 'f66e1f00-bbbb-4aaa-8000-000000000602';
export const INVENTORY_RECIPE_VERSION_NUMBER_FIELD_UNIVERSAL_IDENTIFIER = 'f66e1f00-cccc-4aaa-8000-000000000603';
export const INVENTORY_RECIPE_VERSION_YIELD_QTY_FIELD_UNIVERSAL_IDENTIFIER = 'f66e1f00-dddd-4aaa-8000-000000000604';
export const INVENTORY_RECIPE_VERSION_EFFECTIVE_FROM_FIELD_UNIVERSAL_IDENTIFIER = 'f66e1f00-eeee-4aaa-8000-000000000605';
export const INVENTORY_RECIPE_VERSION_STATUS_FIELD_UNIVERSAL_IDENTIFIER = 'f66e1f00-ffff-4aaa-8000-000000000606';
export const INVENTORY_RECIPE_VERSION_CREATED_BY_FIELD_UNIVERSAL_IDENTIFIER = 'f66e1f00-aaaa-4bbb-8000-000000000607';
export const INVENTORY_RECIPE_VERSION_IDEMPOTENCY_FIELD_UNIVERSAL_IDENTIFIER = 'f66e1f00-bbbb-4bbb-8000-000000000608';

export default defineObject({
  universalIdentifier: INVENTORY_RECIPE_VERSION_UNIVERSAL_IDENTIFIER,
  nameSingular: 'inventoryRecipeVersion',
  namePlural: 'inventoryRecipeVersions',
  labelSingular: 'Версия калькуляции',
  labelPlural: 'Версии калькуляций',
  description: 'Версионированная калькуляция с yield и линями',
  icon: 'IconVersions',
  labelIdentifierFieldMetadataUniversalIdentifier: INVENTORY_RECIPE_VERSION_NUMBER_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    { universalIdentifier: INVENTORY_RECIPE_VERSION_RECIPE_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'recipeId', label: 'Калькуляция', icon: 'IconChefHat', isNullable: false, defaultValue: "''" },
    { universalIdentifier: INVENTORY_RECIPE_VERSION_NUMBER_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.NUMBER, name: 'versionNumber', label: 'Версия', icon: 'IconHash', isNullable: false, defaultValue: 1, universalSettings: { dataType: NumberDataType.INT } },
    { universalIdentifier: INVENTORY_RECIPE_VERSION_YIELD_QTY_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.NUMBER, name: 'yieldQuantityMicros', label: 'Выход (micros)', description: 'Напр. 1кг = 1000000', icon: 'IconScale', isNullable: false, defaultValue: 1000000, universalSettings: { dataType: NumberDataType.INT } },
    { universalIdentifier: INVENTORY_RECIPE_VERSION_EFFECTIVE_FROM_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.DATE_TIME, name: 'effectiveFrom', label: 'Действует с', icon: 'IconClock', isNullable: false, defaultValue: 'now' },
    {
      universalIdentifier: INVENTORY_RECIPE_VERSION_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT, name: 'status', label: 'Статус', icon: 'IconStatusChange', isNullable: false, defaultValue: "'ACTIVE'",
      options: [
        { id: 'f66e1f00-1111-4aaa-8000-000000000611', value: 'ACTIVE', label: 'Активна', position: 0, color: 'green' },
        { id: 'f66e1f00-2222-4aaa-8000-000000000612', value: 'SUPERSEDED', label: 'Заменена', position: 1, color: 'gray' },
      ],
    },
    { universalIdentifier: INVENTORY_RECIPE_VERSION_CREATED_BY_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'createdByStaffId', label: 'Автор', icon: 'IconUser', isNullable: false, defaultValue: "''" },
    { universalIdentifier: INVENTORY_RECIPE_VERSION_IDEMPOTENCY_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'idempotencyKey', label: 'Ключ идемпотентности', icon: 'IconRepeat', isNullable: false, defaultValue: "''" },
  ],
});
