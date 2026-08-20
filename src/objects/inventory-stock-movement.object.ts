import { defineObject, FieldType, NumberDataType } from 'twenty-sdk/define';

export const INVENTORY_STOCK_MOVEMENT_UNIVERSAL_IDENTIFIER =
  'd44e1f00-aaaa-4aaa-8000-000000000401';
export const INVENTORY_STOCK_MOVEMENT_TYPE_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-bbbb-4aaa-8000-000000000402';
export const INVENTORY_STOCK_MOVEMENT_STOCK_ITEM_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-cccc-4aaa-8000-000000000403';
export const INVENTORY_STOCK_MOVEMENT_LOCATION_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-dddd-4aaa-8000-000000000404';
export const INVENTORY_STOCK_MOVEMENT_QTY_DELTA_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-eeee-4aaa-8000-000000000405';
export const INVENTORY_STOCK_MOVEMENT_UNIT_COST_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-ffff-4aaa-8000-000000000406';
export const INVENTORY_STOCK_MOVEMENT_TOTAL_COST_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-aaaa-4bbb-8000-000000000407';
export const INVENTORY_STOCK_MOVEMENT_SOURCE_TYPE_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-bbbb-4bbb-8000-000000000408';
export const INVENTORY_STOCK_MOVEMENT_SOURCE_ID_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-cccc-4bbb-8000-000000000409';
export const INVENTORY_STOCK_MOVEMENT_RECIPE_VERSION_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-dddd-4bbb-8000-000000000410';
export const INVENTORY_STOCK_MOVEMENT_ORDER_ID_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-eeee-4bbb-8000-000000000411';
export const INVENTORY_STOCK_MOVEMENT_ORDER_LINE_ID_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-ffff-4bbb-8000-000000000412';
export const INVENTORY_STOCK_MOVEMENT_REASON_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-aaaa-4ccc-8000-000000000413';
export const INVENTORY_STOCK_MOVEMENT_ACTOR_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-bbbb-4ccc-8000-000000000414';
export const INVENTORY_STOCK_MOVEMENT_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-cccc-4ccc-8000-000000000415';
export const INVENTORY_STOCK_MOVEMENT_IDEMPOTENCY_FIELD_UNIVERSAL_IDENTIFIER =
  'd44e1f00-dddd-4ccc-8000-000000000416';

export default defineObject({
  universalIdentifier: INVENTORY_STOCK_MOVEMENT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'inventoryStockMovement',
  namePlural: 'inventoryStockMovements',
  labelSingular: 'Движение склада',
  labelPlural: 'Движения склада',
  description: 'Ledger-движение (append-only), источник истины',
  icon: 'IconArrowsExchange',
  labelIdentifierFieldMetadataUniversalIdentifier:
    INVENTORY_STOCK_MOVEMENT_SOURCE_ID_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'movementType',
      label: 'Тип движения',
      description: 'RECEIPT/SALE_CONSUMPTION/...',
      icon: 'IconTag',
      isNullable: false,
      defaultValue: "'RECEIPT'",
      options: [
        { id: 'd44e1f00-1111-4aaa-8000-000000000421', value: 'RECEIPT', label: 'Приход', position: 0, color: 'green' },
        { id: 'd44e1f00-2222-4aaa-8000-000000000422', value: 'SALE_CONSUMPTION', label: 'Продажа', position: 1, color: 'blue' },
        { id: 'd44e1f00-3333-4aaa-8000-000000000423', value: 'PRODUCTION_INPUT', label: 'Произв. вход', position: 2, color: 'orange' },
        { id: 'd44e1f00-4444-4aaa-8000-000000000424', value: 'PRODUCTION_OUTPUT', label: 'Произв. выход', position: 3, color: 'purple' },
        { id: 'd44e1f00-5555-4aaa-8000-000000000425', value: 'WRITE_OFF', label: 'Списание', position: 4, color: 'red' },
        { id: 'd44e1f00-6666-4aaa-8000-000000000426', value: 'TRANSFER_OUT', label: 'Перемещение OUT', position: 5, color: 'yellow' },
        { id: 'd44e1f00-7777-4aaa-8000-000000000427', value: 'TRANSFER_IN', label: 'Перемещение IN', position: 6, color: 'yellow' },
        { id: 'd44e1f00-8888-4aaa-8000-000000000428', value: 'INVENTORY_ADJUSTMENT', label: 'Корректировка', position: 7, color: 'gray' },
        { id: 'd44e1f00-9999-4aaa-8000-000000000429', value: 'PREPARED_VOID_CONSUMPTION', label: 'Void PREPARED', position: 8, color: 'red' },
      ],
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_STOCK_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'stockItemId',
      label: 'Позиция',
      icon: 'IconPackage',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_LOCATION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'locationId',
      label: 'Точка',
      icon: 'IconMapPin',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_QTY_DELTA_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'quantityDeltaMicros',
      label: 'Дельта количества',
      description: 'Signed micros; + приход, − расход',
      icon: 'IconScale',
      isNullable: false,
      defaultValue: 0,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_UNIT_COST_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'unitCostMicros',
      label: 'Цена за ед. (micros)',
      description: 'Snapshot средней цены на момент движения',
      icon: 'IconCash',
      isNullable: true,
      defaultValue: null,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_TOTAL_COST_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'totalCostMicros',
      label: 'Стоимость движения',
      description: 'quantityDelta * unitCost snapshot signed',
      icon: 'IconCalculator',
      isNullable: true,
      defaultValue: null,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_SOURCE_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'sourceType',
      label: 'Тип источника',
      icon: 'IconSourceCode',
      isNullable: false,
      defaultValue: "'RECEIPT'",
      options: [
        { id: 'd44e1f00-aaaa-4bbb-8000-000000004431', value: 'RECEIPT', label: 'Приход', position: 0, color: 'green' },
        { id: 'd44e1f00-bbbb-4bbb-8000-000000004432', value: 'PRODUCTION', label: 'Производство', position: 1, color: 'orange' },
        { id: 'd44e1f00-cccc-4bbb-8000-000000004433', value: 'SALE', label: 'Продажа', position: 2, color: 'blue' },
        { id: 'd44e1f00-dddd-4bbb-8000-000000004434', value: 'VOID', label: 'Void', position: 3, color: 'red' },
        { id: 'd44e1f00-eeee-4bbb-8000-000000004435', value: 'TRANSFER', label: 'Перемещение', position: 4, color: 'yellow' },
        { id: 'd44e1f00-ffff-4bbb-8000-000000004436', value: 'REVISION', label: 'Ревизия', position: 5, color: 'gray' },
        { id: 'd44e1f00-aaaa-4ccc-8000-000000004437', value: 'MANUAL', label: 'Ручное', position: 6, color: 'gray' },
      ],
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_SOURCE_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'sourceId',
      label: 'ID операции',
      description: 'Групповой sourceId (receiptId/productionId/orderId/transferId/revisionId)',
      icon: 'IconHash',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_RECIPE_VERSION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'recipeVersionId',
      label: 'Версия рецепта',
      icon: 'IconFileDescription',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_ORDER_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'orderId',
      label: 'POS заказ',
      icon: 'IconShoppingCart',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_ORDER_LINE_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'orderLineId',
      label: 'POS строка',
      icon: 'IconList',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_REASON_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'reason',
      label: 'Причина/комментарий',
      icon: 'IconMessage',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_ACTOR_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'actorStaffId',
      label: 'Автор',
      icon: 'IconUser',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'occurredAt',
      label: 'Время',
      icon: 'IconClock',
      isNullable: false,
      defaultValue: 'now',
    },
    {
      universalIdentifier: INVENTORY_STOCK_MOVEMENT_IDEMPOTENCY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Ключ идемпотентности',
      icon: 'IconRepeat',
      isNullable: false,
      defaultValue: "''",
    },
  ],
});
