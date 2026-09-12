import { defineObject, FieldType, NumberDataType, RelationType } from 'twenty-sdk/define';

export const POS_PRINTER_DEVICE_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b11';
export const POS_PRINTER_DEVICE_LABEL_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b12';
export const POS_PRINTER_DEVICE_CONNECTION_TYPE_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b13';
export const POS_PRINTER_DEVICE_HOST_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b14';
export const POS_PRINTER_DEVICE_PORT_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b15';
export const POS_PRINTER_DEVICE_SYSTEM_QUEUE_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '6caab906-97be-4554-aad0-b61e8a5d6018';
export const POS_PRINTER_DEVICE_SYSTEM_PRINTER_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  'ddcb17d1-52fc-450f-b76c-776087d157ac';
export const POS_PRINTER_DEVICE_SYSTEM_DRIVER_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  'd1af189d-da76-4006-bf06-aaebf8681c90';
export const POS_PRINTER_DEVICE_SYSTEM_PORT_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '90e3db9a-04c0-49c2-b84c-221a37c3a127';
export const POS_PRINTER_DEVICE_CAPABILITY_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  '91e50edf-b160-4499-a9e0-aba7641bbcdf';
export const POS_PRINTER_DEVICE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b16';
export const POS_PRINTER_DEVICE_IS_PRECHECK_PRINTER_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b17';
export const POS_PRINTER_DEVICE_PAPER_WIDTH_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b18';
export const POS_PRINTER_DEVICE_ENCODING_PROFILE_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b19';
export const POS_PRINTER_DEVICE_ESC_POS_CODE_PAGE_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b1a';
export const POS_PRINTER_DEVICE_CUT_SUPPORT_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b1b';
export const POS_PRINTER_DEVICE_STATUS_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b1c';
export const POS_PRINTER_DEVICE_LAST_SEEN_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b1d';
export const POS_PRINTER_DEVICE_LAST_ERROR_CODE_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b1e';
export const POS_PRINTER_DEVICE_LAST_ERROR_MESSAGE_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b1f';
export const POS_PRINTER_DEVICE_CREATED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b20';
export const POS_PRINTER_DEVICE_UPDATED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b21';
export const POS_PRINTER_DEVICE_STATIONS_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b22';
export const POS_PRINTER_DEVICE_PRINT_JOBS_FIELD_UNIVERSAL_IDENTIFIER =
  'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b23';

export default defineObject({
  universalIdentifier: POS_PRINTER_DEVICE_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posPrinterDevice',
  namePlural: 'posPrinterDevices',
  labelSingular: 'Принтер',
  labelPlural: 'Принтеры',
  description: 'Настройка локального Ethernet ESC/POS принтера',
  icon: 'IconPrinter',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_PRINTER_DEVICE_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_PRINTER_DEVICE_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'label',
      label: 'Название',
      description: 'Название принтера для сотрудников',
      icon: 'IconTag',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_CONNECTION_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'connectionType',
      label: 'Подключение',
      description: 'Поддерживаемый транспорт принтера',
      icon: 'IconPlugConnected',
      isNullable: false,
      defaultValue: "'ETHERNET_RAW_TCP'",
      options: [
        { id: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b31', value: 'ETHERNET_RAW_TCP', label: 'Ethernet', position: 0, color: 'blue' },
        { id: 'e27818dd-6e34-4c7a-acf7-45b435e6ea60', value: 'WINDOWS_SPOOLER', label: 'Системный принтер Windows', position: 1, color: 'green' },
      ],
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_HOST_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'host',
      label: 'IP / host',
      description: 'Адрес принтера в локальной сети',
      icon: 'IconWorld',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_PORT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'port',
      label: 'Port',
      description: 'TCP порт RAW ESC/POS, обычно 9100',
      icon: 'IconNetwork',
      isNullable: false,
      defaultValue: 9100,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_SYSTEM_QUEUE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'systemQueueName',
      label: 'Системное имя принтера',
      description: 'Стабильное имя очереди Windows; выбирается из обнаруженных устройств',
      icon: 'IconPrinter',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_SYSTEM_PRINTER_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'systemPrinterName',
      label: 'Имя устройства Windows',
      description: 'Снимок имени устройства, показанный пользователю',
      icon: 'IconTag',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_SYSTEM_DRIVER_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'systemDriverName',
      label: 'Драйвер Windows',
      description: 'Техническая диагностика, полученная от Windows',
      icon: 'IconSettings',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_SYSTEM_PORT_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'systemPortName',
      label: 'Порт Windows',
      description: 'Техническая диагностика очереди Windows',
      icon: 'IconNetwork',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_CAPABILITY_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'capabilityStatus',
      label: 'Совместимость',
      description: 'Совместимость с ESC/POS; Windows не всегда предоставляет эту информацию',
      icon: 'IconQuestionMark',
      isNullable: false,
      defaultValue: "'UNKNOWN'",
      isUIEditable: false,
      options: [
        { id: '161a03c8-325a-4252-ab2d-95ac3b39407c', value: 'SUPPORTED', label: 'Поддерживается', position: 0, color: 'green' },
        { id: 'd1b9735e-f049-4ecc-88da-975727cfde68', value: 'UNKNOWN', label: 'Не проверена', position: 1, color: 'yellow' },
        { id: '7f56969c-229a-4a25-b075-e43cc2b8e714', value: 'UNSUPPORTED', label: 'Не поддерживается', position: 2, color: 'red' },
      ],
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Активен',
      description: 'Устройство участвует в доставке печати',
      icon: 'IconToggleRight',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_IS_PRECHECK_PRINTER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isPrecheckPrinter',
      label: 'Принтер пречеков',
      description: 'Использовать для печати пречеков',
      icon: 'IconReceipt',
      isNullable: false,
      defaultValue: false,
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_PAPER_WIDTH_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'paperWidth',
      label: 'Ширина бумаги',
      description: 'Ширина шаблона печати',
      icon: 'IconRulerMeasure',
      isNullable: false,
      defaultValue: "'80'",
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_ENCODING_PROFILE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'encodingProfile',
      label: 'Кодировка',
      description: 'Профиль кодировки Cyrillic для конкретного принтера',
      icon: 'IconLanguage',
      isNullable: false,
      defaultValue: "'CP866'",
      options: [
        { id: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b34', value: 'CP866', label: 'CP866', position: 0, color: 'blue' },
        { id: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b35', value: 'WINDOWS1251', label: 'Windows-1251', position: 1, color: 'yellow' },
        { id: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b36', value: 'UTF8', label: 'UTF-8', position: 2, color: 'gray' },
      ],
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_ESC_POS_CODE_PAGE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.NUMBER,
      name: 'escPosCodePage',
      label: 'ESC/POS code page',
      description: 'Необязательный номер code page команды ESC t',
      icon: 'IconCode',
      isNullable: true,
      defaultValue: null,
      universalSettings: { dataType: NumberDataType.INT },
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_CUT_SUPPORT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'cutSupport',
      label: 'Автоотрезка',
      description: 'Принтер поддерживает команду отрезки',
      icon: 'IconScissors',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Статус',
      description: 'Best-effort состояние соединения без заявления PAPER_OK',
      icon: 'IconActivityHeartbeat',
      isNullable: false,
      defaultValue: "'CONFIGURED'",
      isUIEditable: false,
      options: [
        { id: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b37', value: 'CONFIGURED', label: 'Настроен', position: 0, color: 'gray' },
        { id: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b38', value: 'REACHABLE', label: 'Доступен', position: 1, color: 'green' },
        { id: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b39', value: 'UNREACHABLE', label: 'Нет связи', position: 2, color: 'red' },
        { id: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b3a', value: 'UNKNOWN', label: 'Неизвестно', position: 3, color: 'yellow' },
      ],
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_LAST_SEEN_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'lastSeenAt',
      label: 'Последняя связь',
      description: 'Время последнего успешного соединения',
      icon: 'IconClock',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_LAST_ERROR_CODE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'lastErrorCode',
      label: 'Код ошибки',
      description: 'Последний безопасный код ошибки без секретов',
      icon: 'IconAlertTriangle',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_LAST_ERROR_MESSAGE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'lastErrorMessage',
      label: 'Последняя ошибка',
      description: 'Последняя операционная ошибка соединения',
      icon: 'IconAlertCircle',
      isNullable: true,
      defaultValue: null,
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_STATIONS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'stations',
      label: 'Станции',
      description: 'Производственные станции, направленные на принтер',
      icon: 'IconToolsKitchen2',
      relationTargetObjectMetadataUniversalIdentifier: 'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b22',
      relationTargetFieldMetadataUniversalIdentifier: 'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b25',
      universalSettings: { relationType: RelationType.ONE_TO_MANY },
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_PRINT_JOBS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'printJobs',
      label: 'Задания печати',
      description: 'История заданий этого принтера',
      icon: 'IconClipboardList',
      relationTargetObjectMetadataUniversalIdentifier: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c33',
      relationTargetFieldMetadataUniversalIdentifier: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c36',
      universalSettings: { relationType: RelationType.ONE_TO_MANY },
    },
  ],
});
