import { defineObject, FieldType, NumberDataType } from 'twenty-sdk/define';

export const INVENTORY_COUNT_LINE_UNIVERSAL_IDENTIFIER = 'e00e1f00-aaaa-4aaa-8000-000000001101';
export const INVENTORY_COUNT_LINE_COUNT_FIELD_UNIVERSAL_IDENTIFIER = 'e00e1f00-bbbb-4aaa-8000-000000001102';
export const INVENTORY_COUNT_LINE_STOCK_ITEM_FIELD_UNIVERSAL_IDENTIFIER = 'e00e1f00-cccc-4aaa-8000-000000001103';
export const INVENTORY_COUNT_LINE_EXPECTED_FIELD_UNIVERSAL_IDENTIFIER = 'e00e1f00-dddd-4aaa-8000-000000001104';
export const INVENTORY_COUNT_LINE_ACTUAL_FIELD_UNIVERSAL_IDENTIFIER = 'e00e1f00-eeee-4aaa-8000-000000001105';
export const INVENTORY_COUNT_LINE_VARIANCE_FIELD_UNIVERSAL_IDENTIFIER = 'e00e1f00-ffff-4aaa-8000-000000001106';
export const INVENTORY_COUNT_LINE_UNIT_COST_FIELD_UNIVERSAL_IDENTIFIER = 'e00e1f00-aaaa-4bbb-8000-000000001107';
export const INVENTORY_COUNT_LINE_RESOLUTION_FIELD_UNIVERSAL_IDENTIFIER = 'e00e1f00-bbbb-4bbb-8000-000000001108';
export const INVENTORY_COUNT_LINE_RECIPE_VERSION_FIELD_UNIVERSAL_IDENTIFIER = 'e00e1f00-cccc-4bbb-8000-000000001109';

export default defineObject({
  universalIdentifier: INVENTORY_COUNT_LINE_UNIVERSAL_IDENTIFIER,
  nameSingular: 'inventoryCountLine',
  namePlural: 'inventoryCountLines',
  labelSingular: 'Строка ревизии',
  labelPlural: 'Строки ревизии',
  description: 'Expected/actual/variance per StockItem',
  icon: 'IconListCheck',
  labelIdentifierFieldMetadataUniversalIdentifier: INVENTORY_COUNT_LINE_STOCK_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    { universalIdentifier: INVENTORY_COUNT_LINE_COUNT_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'countId', label: 'Ревизия', icon: 'IconClipboardCheck', isNullable: false, defaultValue: "''" },
    { universalIdentifier: INVENTORY_COUNT_LINE_STOCK_ITEM_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'stockItemId', label: 'Позиция', icon: 'IconPackage', isNullable: false, defaultValue: "''" },
    { universalIdentifier: INVENTORY_COUNT_LINE_EXPECTED_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.NUMBER, name: 'expectedQuantityMicros', label: 'Должно быть', icon: 'IconScale', isNullable: false, defaultValue: 0, universalSettings: { dataType: NumberDataType.INT } },
    { universalIdentifier: INVENTORY_COUNT_LINE_ACTUAL_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.NUMBER, name: 'actualQuantityMicros', label: 'Фактически', icon: 'IconScale', isNullable: true, defaultValue: null, universalSettings: { dataType: NumberDataType.INT } },
    { universalIdentifier: INVENTORY_COUNT_LINE_VARIANCE_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.NUMBER, name: 'varianceMicros', label: 'Разница', icon: 'IconArrowsDiff', isNullable: true, defaultValue: null, universalSettings: { dataType: NumberDataType.INT } },
    { universalIdentifier: INVENTORY_COUNT_LINE_UNIT_COST_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.NUMBER, name: 'unitCostMicrosSnapshot', label: 'Цена snapshot', icon: 'IconCash', isNullable: false, defaultValue: 0, universalSettings: { dataType: NumberDataType.INT } },
    {
      universalIdentifier: INVENTORY_COUNT_LINE_RESOLUTION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT, name: 'resolution', label: 'Резолюция', icon: 'IconGitBranch', isNullable: false, defaultValue: "'PENDING'",
      options: [
        { id: 'e00e1f00-1111-4aaa-8000-000000001111', value: 'PENDING', label: 'Ожидает', position: 0, color: 'gray' },
        { id: 'e00e1f00-2222-4aaa-8000-000000001112', value: 'UNRECORDED_PRODUCTION', label: 'Произведено', position: 1, color: 'orange' },
        { id: 'e00e1f00-3333-4aaa-8000-000000001113', value: 'DIRECT_ADJUSTMENT', label: 'Корректировка', position: 2, color: 'blue' },
      ],
    },
    { universalIdentifier: INVENTORY_COUNT_LINE_RECIPE_VERSION_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'producedRecipeVersionId', label: 'Версия рецепта (произв.)', icon: 'IconFileDescription', isNullable: true, defaultValue: null },
  ],
});
