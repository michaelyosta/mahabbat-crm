import { defineObject, FieldType } from 'twenty-sdk/define';

export const INVENTORY_CONSUMPTION_ISSUE_UNIVERSAL_IDENTIFIER = 'c99e1f00-aaaa-4aaa-8000-000000000901';
export const INVENTORY_CONSUMPTION_ISSUE_ORDER_FIELD_UNIVERSAL_IDENTIFIER = 'c99e1f00-bbbb-4aaa-8000-000000000902';
export const INVENTORY_CONSUMPTION_ISSUE_ORDER_LINE_FIELD_UNIVERSAL_IDENTIFIER = 'c99e1f00-cccc-4aaa-8000-000000000903';
export const INVENTORY_CONSUMPTION_ISSUE_MENU_ITEM_FIELD_UNIVERSAL_IDENTIFIER = 'c99e1f00-dddd-4aaa-8000-000000000904';
export const INVENTORY_CONSUMPTION_ISSUE_TYPE_FIELD_UNIVERSAL_IDENTIFIER = 'c99e1f00-eeee-4aaa-8000-000000000905';
export const INVENTORY_CONSUMPTION_ISSUE_STATUS_FIELD_UNIVERSAL_IDENTIFIER = 'c99e1f00-ffff-4aaa-8000-000000000906';

export default defineObject({
  universalIdentifier: INVENTORY_CONSUMPTION_ISSUE_UNIVERSAL_IDENTIFIER,
  nameSingular: 'inventoryConsumptionIssue',
  namePlural: 'inventoryConsumptionIssues',
  labelSingular: 'Проблема списания',
  labelPlural: 'Проблемы списания',
  description: 'MISSING_RECIPE / MISSING_LOCATION issue',
  icon: 'IconAlertTriangle',
  labelIdentifierFieldMetadataUniversalIdentifier: INVENTORY_CONSUMPTION_ISSUE_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    { universalIdentifier: INVENTORY_CONSUMPTION_ISSUE_ORDER_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'orderId', label: 'Заказ', icon: 'IconShoppingCart', isNullable: false, defaultValue: "''" },
    { universalIdentifier: INVENTORY_CONSUMPTION_ISSUE_ORDER_LINE_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'orderLineId', label: 'Строка', icon: 'IconList', isNullable: true, defaultValue: null },
    { universalIdentifier: INVENTORY_CONSUMPTION_ISSUE_MENU_ITEM_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'menuItemId', label: 'Блюдо', icon: 'IconChefHat', isNullable: true, defaultValue: null },
    {
      universalIdentifier: INVENTORY_CONSUMPTION_ISSUE_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT, name: 'issueType', label: 'Тип', icon: 'IconTag', isNullable: false, defaultValue: "'MISSING_RECIPE'",
      options: [
        { id: 'c99e1f00-1111-4aaa-8000-000000000911', value: 'MISSING_RECIPE', label: 'Нет калькуляции', position: 0, color: 'red' },
        { id: 'c99e1f00-2222-4aaa-8000-000000000912', value: 'MISSING_LOCATION', label: 'Нет точки', position: 1, color: 'orange' },
        { id: 'c99e1f00-3333-4aaa-8000-000000000913', value: 'INSUFFICIENT_STOCK', label: 'Недостача', position: 2, color: 'yellow' },
      ],
    },
    {
      universalIdentifier: INVENTORY_CONSUMPTION_ISSUE_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT, name: 'status', label: 'Статус', icon: 'IconStatusChange', isNullable: false, defaultValue: "'OPEN'",
      options: [
        { id: 'c99e1f00-4444-4aaa-8000-000000000914', value: 'OPEN', label: 'Открыта', position: 0, color: 'red' },
        { id: 'c99e1f00-5555-4aaa-8000-000000000915', value: 'RESOLVED', label: 'Решена', position: 1, color: 'green' },
      ],
    },
  ],
});
