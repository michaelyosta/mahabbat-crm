import { defineObject, FieldType } from 'twenty-sdk/define';

export const INVENTORY_COUNT_UNIVERSAL_IDENTIFIER = 'd00e1f00-aaaa-4aaa-8000-000000001001';
export const INVENTORY_COUNT_LABEL_FIELD_UNIVERSAL_IDENTIFIER = 'd00e1f00-bbbb-4aaa-8000-000000001002';
export const INVENTORY_COUNT_LOCATION_FIELD_UNIVERSAL_IDENTIFIER = 'd00e1f00-cccc-4aaa-8000-000000001003';
export const INVENTORY_COUNT_STATUS_FIELD_UNIVERSAL_IDENTIFIER = 'd00e1f00-dddd-4aaa-8000-000000001004';
export const INVENTORY_COUNT_WATERMARK_FIELD_UNIVERSAL_IDENTIFIER = 'd00e1f00-eeee-4aaa-8000-000000001005';
export const INVENTORY_COUNT_CREATED_BY_FIELD_UNIVERSAL_IDENTIFIER = 'd00e1f00-ffff-4aaa-8000-000000001006';
export const INVENTORY_COUNT_IDEMPOTENCY_FIELD_UNIVERSAL_IDENTIFIER = 'd00e1f00-aaaa-4bbb-8000-000000001007';
export const INVENTORY_COUNT_STARTED_AT_FIELD_UNIVERSAL_IDENTIFIER = 'd00e1f00-bbbb-4bbb-8000-000000001008';

export default defineObject({
  universalIdentifier: INVENTORY_COUNT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'inventoryCount',
  namePlural: 'inventoryCounts',
  labelSingular: 'Ревизия',
  labelPlural: 'Ревизии',
  description: 'Инвентаризация по точке хранения',
  icon: 'IconClipboardCheck',
  labelIdentifierFieldMetadataUniversalIdentifier: INVENTORY_COUNT_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    { universalIdentifier: INVENTORY_COUNT_LABEL_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'label', label: 'Название', icon: 'IconTag', isNullable: false, defaultValue: "''" },
    { universalIdentifier: INVENTORY_COUNT_LOCATION_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'locationId', label: 'Точка', icon: 'IconMapPin', isNullable: false, defaultValue: "''" },
    {
      universalIdentifier: INVENTORY_COUNT_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT, name: 'status', label: 'Статус', icon: 'IconStatusChange', isNullable: false, defaultValue: "'DRAFT'",
      options: [
        { id: 'd00e1f00-1111-4aaa-8000-000000001011', value: 'DRAFT', label: 'Черновик', position: 0, color: 'gray' },
        { id: 'd00e1f00-2222-4aaa-8000-000000001012', value: 'ACTIVE', label: 'Активна', position: 1, color: 'blue' },
        { id: 'd00e1f00-3333-4aaa-8000-000000001013', value: 'POSTED', label: 'Проведена', position: 2, color: 'green' },
      ],
    },
    { universalIdentifier: INVENTORY_COUNT_WATERMARK_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'ledgerWatermark', label: 'Watermark', description: 'ISO timestamp на момент ACTIVE', icon: 'IconClock', isNullable: true, defaultValue: null },
    { universalIdentifier: INVENTORY_COUNT_CREATED_BY_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'createdByStaffId', label: 'Автор', icon: 'IconUser', isNullable: false, defaultValue: "''" },
    { universalIdentifier: INVENTORY_COUNT_IDEMPOTENCY_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'idempotencyKey', label: 'Ключ идемпотентности', icon: 'IconRepeat', isNullable: false, defaultValue: "''" },
    { universalIdentifier: INVENTORY_COUNT_STARTED_AT_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.DATE_TIME, name: 'startedAt', label: 'Старт', icon: 'IconClock', isNullable: true, defaultValue: null },
  ],
});
