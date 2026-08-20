import { defineObject, FieldType, NumberDataType } from 'twenty-sdk/define';

export const INVENTORY_CONSUMPTION_REQUEST_UNIVERSAL_IDENTIFIER = 'b88e1f00-aaaa-4aaa-8000-000000000801';
export const INVENTORY_CONSUMPTION_REQUEST_ORDER_FIELD_UNIVERSAL_IDENTIFIER = 'b88e1f00-bbbb-4aaa-8000-000000000802';
export const INVENTORY_CONSUMPTION_REQUEST_STATUS_FIELD_UNIVERSAL_IDENTIFIER = 'b88e1f00-cccc-4aaa-8000-000000000803';
export const INVENTORY_CONSUMPTION_REQUEST_IDEMPOTENCY_FIELD_UNIVERSAL_IDENTIFIER = 'b88e1f00-dddd-4aaa-8000-000000000804';
export const INVENTORY_CONSUMPTION_REQUEST_ATTEMPT_FIELD_UNIVERSAL_IDENTIFIER = 'b88e1f00-eeee-4aaa-8000-000000000805';
export const INVENTORY_CONSUMPTION_REQUEST_ERROR_FIELD_UNIVERSAL_IDENTIFIER = 'b88e1f00-ffff-4aaa-8000-000000000806';
export const INVENTORY_CONSUMPTION_REQUEST_PROCESSED_AT_FIELD_UNIVERSAL_IDENTIFIER = 'b88e1f00-aaaa-4bbb-8000-000000000807';

export default defineObject({
  universalIdentifier: INVENTORY_CONSUMPTION_REQUEST_UNIVERSAL_IDENTIFIER,
  nameSingular: 'inventoryConsumptionRequest',
  namePlural: 'inventoryConsumptionRequests',
  labelSingular: 'Заявка списания',
  labelPlural: 'Заявки списания',
  description: 'Durable exactly-once заявка на списание закрытого заказа',
  icon: 'IconReceipt',
  labelIdentifierFieldMetadataUniversalIdentifier: INVENTORY_CONSUMPTION_REQUEST_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    { universalIdentifier: INVENTORY_CONSUMPTION_REQUEST_ORDER_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'orderId', label: 'POS заказ', icon: 'IconShoppingCart', isNullable: false, defaultValue: "''" },
    {
      universalIdentifier: INVENTORY_CONSUMPTION_REQUEST_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT, name: 'status', label: 'Статус', icon: 'IconStatusChange', isNullable: false, defaultValue: "'PENDING'",
      options: [
        { id: 'b88e1f00-1111-4aaa-8000-000000000811', value: 'PENDING', label: 'Ожидает', position: 0, color: 'yellow' },
        { id: 'b88e1f00-2222-4aaa-8000-000000000812', value: 'PROCESSING', label: 'В обработке', position: 1, color: 'blue' },
        { id: 'b88e1f00-3333-4aaa-8000-000000000813', value: 'APPLIED', label: 'Проведено', position: 2, color: 'green' },
        { id: 'b88e1f00-4444-4aaa-8000-000000000814', value: 'FAILED_MISSING_RECIPE', label: 'Нет калькуляции', position: 3, color: 'orange' },
        { id: 'b88e1f00-5555-4aaa-8000-000000000815', value: 'FAILED', label: 'Ошибка', position: 4, color: 'red' },
      ],
    },
    { universalIdentifier: INVENTORY_CONSUMPTION_REQUEST_IDEMPOTENCY_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'idempotencyKey', label: 'Ключ идемпотентности', icon: 'IconRepeat', isNullable: false, defaultValue: "''" },
    { universalIdentifier: INVENTORY_CONSUMPTION_REQUEST_ATTEMPT_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.NUMBER, name: 'attemptCount', label: 'Попытки', icon: 'IconRepeat', isNullable: false, defaultValue: 0, universalSettings: { dataType: NumberDataType.INT } },
    { universalIdentifier: INVENTORY_CONSUMPTION_REQUEST_ERROR_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'lastError', label: 'Ошибка', icon: 'IconAlertCircle', isNullable: true, defaultValue: null },
    { universalIdentifier: INVENTORY_CONSUMPTION_REQUEST_PROCESSED_AT_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.DATE_TIME, name: 'processedAt', label: 'Обработано', icon: 'IconClock', isNullable: true, defaultValue: null },
  ],
});
