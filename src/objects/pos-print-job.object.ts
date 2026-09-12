import { defineObject, FieldType, NumberDataType, OnDeleteAction, RelationType } from 'twenty-sdk/define';

export const POS_PRINT_JOB_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c33';
export const POS_PRINT_JOB_LABEL_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c34';
export const POS_PRINT_JOB_SOURCE_TYPE_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c35';
export const POS_PRINT_JOB_PRINTER_DEVICE_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c36';
export const POS_PRINT_JOB_PRODUCTION_STATION_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c37';
export const POS_PRINT_JOB_SOURCE_ID_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c38';
export const POS_PRINT_JOB_DOCUMENT_TYPE_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c39';
export const POS_PRINT_JOB_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c3a';
export const POS_PRINT_JOB_PAYLOAD_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c3b';
export const POS_PRINT_JOB_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c3c';
export const POS_PRINT_JOB_ATTEMPT_COUNT_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c3d';
export const POS_PRINT_JOB_LAST_ATTEMPT_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c3e';
export const POS_PRINT_JOB_LAST_ERROR_CODE_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c3f';
export const POS_PRINT_JOB_LAST_ERROR_MESSAGE_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c40';
export const POS_PRINT_JOB_CREATED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c41';
export const POS_PRINT_JOB_SENT_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c42';
export const POS_PRINT_JOB_CONFIRMED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c43';
export const POS_PRINT_JOB_CLAIM_TOKEN_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c44';
export const POS_PRINT_JOB_CLAIMED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c45';
export const POS_PRINT_JOB_GATEWAY_ID_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c46';
export const POS_PRINT_JOB_REPRINT_OF_JOB_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c47';
export const POS_PRINT_JOB_REQUESTED_BY_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c48';
export const POS_PRINT_JOB_REQUESTED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c49';
export const POS_PRINT_JOB_REPRINTED_JOBS_FIELD_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c4b';
export const POS_PRINT_JOB_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c4a';

const statusOptions: Array<{ id: string; value: string; label: string; position: number; color: 'blue' | 'yellow' | 'green' | 'red' | 'orange' }> = [
  { id: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c51', value: 'QUEUED', label: 'Ожидает', position: 0, color: 'blue' },
  { id: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c52', value: 'DISPATCHING', label: 'Отправляется', position: 1, color: 'yellow' },
  { id: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c53', value: 'SENT', label: 'Отправлено', position: 2, color: 'green' },
  { id: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c54', value: 'FAILED', label: 'Ошибка', position: 3, color: 'red' },
  { id: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c55', value: 'OUTCOME_UNKNOWN', label: 'Результат неизвестен', position: 4, color: 'orange' },
  { id: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c56', value: 'CONFIRMED', label: 'Подтверждено', position: 5, color: 'green' },
];

export default defineObject({
  universalIdentifier: POS_PRINT_JOB_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posPrintJob',
  namePlural: 'posPrintJobs',
  labelSingular: 'Задание печати',
  labelPlural: 'Задания печати',
  description: 'Долговечное задание локальной печати с immutable snapshot и audit trail',
  icon: 'IconPrinter',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_PRINT_JOB_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    { universalIdentifier: POS_PRINT_JOB_LABEL_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'label', label: 'Задание', description: 'Человекочитаемая метка задания', icon: 'IconTag', isNullable: false, defaultValue: "''", isUIEditable: false },
    {
      universalIdentifier: POS_PRINT_JOB_SOURCE_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'sourceType',
      label: 'Источник',
      description: 'Тип исходного доменного документа',
      icon: 'IconLink',
      isNullable: false,
      defaultValue: "'KITCHEN_TICKET'",
      isUIEditable: false,
      options: [
        { id: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c61', value: 'KITCHEN_TICKET', label: 'Кухонная фиша', position: 0, color: 'blue' },
        { id: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c62', value: 'PRECHECK', label: 'Пречек', position: 1, color: 'orange' },
        { id: 'c54eb7f4-acdd-4e37-9cc7-6d3ed6d90c61', value: 'TEST_PRINT', label: 'Тестовая печать', position: 2, color: 'gray' },
      ],
    },
    {
      universalIdentifier: POS_PRINT_JOB_PRINTER_DEVICE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'printerDevice',
      label: 'Принтер',
      description: 'Целевой физический принтер; null для ошибки маршрута',
      icon: 'IconPrinter',
      relationTargetObjectMetadataUniversalIdentifier: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b11',
      relationTargetFieldMetadataUniversalIdentifier: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b23',
      universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'printerDeviceId' },
    },
    {
      universalIdentifier: POS_PRINT_JOB_PRODUCTION_STATION_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'productionStation',
      label: 'Станция',
      description: 'Логическая станция документа',
      icon: 'IconToolsKitchen2',
      relationTargetObjectMetadataUniversalIdentifier: 'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b22',
      relationTargetFieldMetadataUniversalIdentifier: 'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b29',
      universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'productionStationId' },
    },
    { universalIdentifier: POS_PRINT_JOB_SOURCE_ID_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'sourceId', label: 'Источник задания', description: 'ID исходной фиши или пречека', icon: 'IconLink', isNullable: false, defaultValue: "''", isUIEditable: false },
    {
      universalIdentifier: POS_PRINT_JOB_DOCUMENT_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'documentType',
      label: 'Документ',
      description: 'Операционный тип печатного документа',
      icon: 'IconFileDescription',
      isNullable: false,
      defaultValue: "'KITCHEN_NEW'",
      isUIEditable: false,
      options: [
        { id: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c63', value: 'KITCHEN_NEW', label: 'Кухня · новое', position: 0, color: 'blue' },
        { id: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c64', value: 'KITCHEN_CANCEL', label: 'Кухня · отмена', position: 1, color: 'red' },
        { id: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c65', value: 'PRECHECK', label: 'Пречек', position: 2, color: 'orange' },
        { id: '857dc8a3-010a-4c91-a679-7f0edd9cf88f', value: 'TEST_PRINT', label: 'Тестовая печать', position: 3, color: 'gray' },
      ],
    },
    { universalIdentifier: POS_PRINT_JOB_STATUS_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.SELECT, name: 'status', label: 'Статус', description: 'Состояние доставки; SENT не означает подтверждённую бумагу', icon: 'IconStatusChange', isNullable: false, defaultValue: "'QUEUED'", isUIEditable: false, options: statusOptions },
    { universalIdentifier: POS_PRINT_JOB_PAYLOAD_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'payloadSnapshot', label: 'Snapshot документа', description: 'Immutable JSON для повторяемого рендера исторического документа', icon: 'IconDatabase', isNullable: false, defaultValue: "''", isUIEditable: false, universalSettings: { displayedMaxRows: 8 } },
    { universalIdentifier: POS_PRINT_JOB_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'idempotencyKey', label: 'Ключ задания', description: 'Детерминированный ключ обычной доставки', icon: 'IconRepeat', isNullable: false, defaultValue: "''", isUIEditable: false },
    { universalIdentifier: POS_PRINT_JOB_ATTEMPT_COUNT_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.NUMBER, name: 'attemptCount', label: 'Попытки', description: 'Число начатых dispatch попыток', icon: 'IconRepeat', isNullable: false, defaultValue: 0, isUIEditable: false, universalSettings: { dataType: NumberDataType.INT } },
    { universalIdentifier: POS_PRINT_JOB_LAST_ATTEMPT_AT_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.DATE_TIME, name: 'lastAttemptAt', label: 'Последняя попытка', description: 'Время последней dispatch попытки', icon: 'IconClock', isNullable: true, defaultValue: null, isUIEditable: false },
    { universalIdentifier: POS_PRINT_JOB_LAST_ERROR_CODE_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'lastErrorCode', label: 'Код ошибки', description: 'Безопасный код ошибки доставки', icon: 'IconAlertTriangle', isNullable: true, defaultValue: null, isUIEditable: false },
    { universalIdentifier: POS_PRINT_JOB_LAST_ERROR_MESSAGE_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'lastErrorMessage', label: 'Ошибка', description: 'Операционное сообщение без секретов', icon: 'IconAlertCircle', isNullable: true, defaultValue: null, isUIEditable: false },
    { universalIdentifier: POS_PRINT_JOB_SENT_AT_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.DATE_TIME, name: 'sentAt', label: 'Отправлено', description: 'Время, когда gateway завершил передачу bytes', icon: 'IconSend', isNullable: true, defaultValue: null, isUIEditable: false },
    { universalIdentifier: POS_PRINT_JOB_CONFIRMED_AT_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.DATE_TIME, name: 'confirmedAt', label: 'Подтверждено', description: 'Только если профиль принтера вернул надёжный status', icon: 'IconCheck', isNullable: true, defaultValue: null, isUIEditable: false },
    { universalIdentifier: POS_PRINT_JOB_CLAIM_TOKEN_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'claimToken', label: 'Claim', description: 'Внутренний lease gateway', icon: 'IconLock', isNullable: true, defaultValue: null, isUIEditable: false },
    { universalIdentifier: POS_PRINT_JOB_CLAIMED_AT_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.DATE_TIME, name: 'claimedAt', label: 'Взято gateway', description: 'Время claim задания', icon: 'IconClock', isNullable: true, defaultValue: null, isUIEditable: false },
    { universalIdentifier: POS_PRINT_JOB_GATEWAY_ID_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'gatewayId', label: 'Gateway', description: 'Идентификатор локального print gateway', icon: 'IconServer', isNullable: true, defaultValue: null, isUIEditable: false },
    { universalIdentifier: POS_PRINT_JOB_REPRINT_OF_JOB_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.RELATION, name: 'reprintOfJob', label: 'Повтор задания', description: 'Исходная попытка явной повторной печати', icon: 'IconCopy', relationTargetObjectMetadataUniversalIdentifier: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c33', relationTargetFieldMetadataUniversalIdentifier: POS_PRINT_JOB_REPRINTED_JOBS_FIELD_UNIVERSAL_IDENTIFIER, universalSettings: { relationType: RelationType.MANY_TO_ONE, onDelete: OnDeleteAction.SET_NULL, joinColumnName: 'reprintOfJobId' } },
    { universalIdentifier: POS_PRINT_JOB_REQUESTED_BY_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.TEXT, name: 'requestedBy', label: 'Запросил повтор', description: 'Actor explicit reprint', icon: 'IconUser', isNullable: true, defaultValue: null, isUIEditable: false },
    { universalIdentifier: POS_PRINT_JOB_REQUESTED_AT_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.DATE_TIME, name: 'requestedAt', label: 'Время повтора', description: 'Время explicit reprint', icon: 'IconClock', isNullable: true, defaultValue: null, isUIEditable: false },
    { universalIdentifier: POS_PRINT_JOB_REPRINTED_JOBS_FIELD_UNIVERSAL_IDENTIFIER, type: FieldType.RELATION, name: 'reprintedJobs', label: 'Повторные задания', description: 'Повторные задания, созданные для этой попытки печати', icon: 'IconCopy', relationTargetObjectMetadataUniversalIdentifier: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c33', relationTargetFieldMetadataUniversalIdentifier: POS_PRINT_JOB_REPRINT_OF_JOB_FIELD_UNIVERSAL_IDENTIFIER, universalSettings: { relationType: RelationType.ONE_TO_MANY } },
  ],
});
