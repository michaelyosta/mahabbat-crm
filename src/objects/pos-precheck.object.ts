import { defineObject, FieldType, OnDeleteAction, RelationType } from 'twenty-sdk/define';

export const POS_PRECHECK_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcdef';
export const POS_PRECHECK_LABEL_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcdf0';
export const POS_PRECHECK_ORDER_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcdf1';
export const POS_PRECHECK_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcdf2';
export const POS_PRECHECK_SUBTOTAL_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcdf3';
export const POS_PRECHECK_TOTAL_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcdf4';
export const POS_PRECHECK_GUEST_TOTALS_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcdf5';
export const POS_PRECHECK_CREATED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcdf6';
export const POS_PRECHECK_CANCELLED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcdf7';
export const POS_PRECHECK_CANCELLED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcdf8';
export const POS_PRECHECK_ACTIVE_ORDER_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcdf9';
export const POS_PRECHECK_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcd01';
export const POS_PRECHECK_CANCEL_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcd02';
export const POS_PRECHECK_PRINT_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcd03';
export const POS_PRECHECK_GUEST_ITEMS_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcd07';
export const POS_PRECHECK_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcd04';
export const POS_PRECHECK_UNIQUE_ACTIVE_ORDER_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcd05';
export const POS_PRECHECK_UNIQUE_CANCEL_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  '9e3c4f56-7a89-4f01-8123-456789abcd06';

export default defineObject({
  universalIdentifier: POS_PRECHECK_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posPrecheck',
  namePlural: 'posPrechecks',
  labelSingular: 'Пречек POS',
  labelPlural: 'Пречеки POS',
  description: 'Immutable денежный snapshot, блокирующий изменения заказа',
  icon: 'IconReceipt',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_PRECHECK_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_PRECHECK_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'label',
      label: 'Метка',
      description: 'Метка пречека',
      icon: 'IconTag',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_PRECHECK_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'order',
      label: 'Заказ',
      description: 'Заказ, зафиксированный пречеком',
      icon: 'IconShoppingCart',
      relationTargetObjectMetadataUniversalIdentifier:
        'a967e1ff-fea2-4a77-959a-c16460f51377',
      relationTargetFieldMetadataUniversalIdentifier:
        'a2b3c4d5-e6f7-4890-8123-456789abcdef',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'orderId',
      },
    },
    {
      universalIdentifier: POS_PRECHECK_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Статус',
      description: 'Жизненный цикл пречека',
      icon: 'IconStatusChange',
      isNullable: false,
      defaultValue: "'ACTIVE'",
      isUIEditable: false,
      options: [
        {
          id: '9e3c4f56-7a89-4f01-8123-456789abcd11',
          value: 'ACTIVE',
          label: 'Активен',
          position: 0,
          color: 'orange',
        },
        {
          id: '9e3c4f56-7a89-4f01-8123-456789abcd12',
          value: 'CANCELLED',
          label: 'Отменён',
          position: 1,
          color: 'gray',
        },
      ],
    },
    {
      universalIdentifier: POS_PRECHECK_SUBTOTAL_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'subtotalSnapshot',
      label: 'Подытог snapshot',
      description: 'Серверный подытог на момент пречека',
      icon: 'IconCalculator',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRECHECK_TOTAL_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'totalSnapshot',
      label: 'Итог snapshot',
      description: 'Серверный итог на момент пречека',
      icon: 'IconCash',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier:
        POS_PRECHECK_GUEST_TOTALS_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'guestTotalsSnapshot',
      label: 'Итоги гостей snapshot',
      description: 'Детерминированный JSON snapshot guest subtotals',
      icon: 'IconUsers',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier:
        POS_PRECHECK_CREATED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'createdByStaffId',
      label: 'Создал',
      description: 'Actor из PosSession',
      icon: 'IconUserPlus',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRECHECK_CANCELLED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'cancelledAt',
      label: 'Отменён',
      description: 'Время административной отмены',
      icon: 'IconClockX',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier:
        POS_PRECHECK_CANCELLED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'cancelledByStaffId',
      label: 'Отменил',
      description: 'ADMIN actor из PosSession',
      icon: 'IconUserX',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRECHECK_ACTIVE_ORDER_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'activeOrderKey',
      label: 'Ключ активной блокировки',
      description: 'Server-owned order key; null after cancellation',
      icon: 'IconLock',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRECHECK_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Ключ идемпотентности',
      description: 'Ключ createPrecheck',
      icon: 'IconRepeat',
      isNullable: false,
      defaultValue: "''",
      isUIEditable: false,
    },
    {
      universalIdentifier:
        POS_PRECHECK_CANCEL_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'cancelIdempotencyKey',
      label: 'Ключ отмены',
      description: 'Ключ retry-safe cancelPrecheck',
      icon: 'IconRepeat',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRECHECK_PRINT_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'printStatus',
      label: 'Статус печати',
      description: 'Результат bounded precheck adapter',
      icon: 'IconPrinter',
      isNullable: false,
      defaultValue: "'QUEUED'",
      isUIEditable: false,
      options: [
        {
          id: '9e3c4f56-7a89-4f01-8123-456789abcd15',
          value: 'QUEUED',
          label: 'Ожидает отправки',
          position: 0,
          color: 'blue',
        },
        {
          id: '9e3c4f56-7a89-4f01-8123-456789abcd13',
          value: 'PRINTED',
          label: 'Старая запись',
          position: 1,
          color: 'green',
        },
        {
          id: '9e3c4f56-7a89-4f01-8123-456789abcd14',
          value: 'FAILED',
          label: 'Ошибка',
          position: 2,
          color: 'red',
        },
        { id: '9e3c4f56-7a89-4f01-8123-456789abcd16', value: 'DISPATCHING', label: 'Отправляется', position: 3, color: 'yellow' },
        { id: '9e3c4f56-7a89-4f01-8123-456789abcd17', value: 'SENT', label: 'Отправлено', position: 4, color: 'green' },
        { id: '9e3c4f56-7a89-4f01-8123-456789abcd18', value: 'OUTCOME_UNKNOWN', label: 'Результат неизвестен', position: 5, color: 'orange' },
        { id: '9e3c4f56-7a89-4f01-8123-456789abcd19', value: 'CONFIRMED', label: 'Подтверждено', position: 6, color: 'green' },
      ],
    },
    {
      universalIdentifier: POS_PRECHECK_GUEST_ITEMS_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'guestItemsSnapshot',
      label: 'Позиции гостей snapshot',
      description: 'Immutable JSON позиций, названий и цен для пречека',
      icon: 'IconListDetails',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
      universalSettings: { displayedMaxRows: 8 },
    },
  ],
});
