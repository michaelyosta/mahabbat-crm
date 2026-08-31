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
      type: FieldType.SELECT,
      name: 'paperWidth',
      label: 'Ширина бумаги',
      description: 'Ширина шаблона печати',
      icon: 'IconRulerMeasure',
      isNullable: false,
      defaultValue: "'80'",
      options: [
        { id: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b32', value: '80', label: '80 мм', position: 0, color: 'blue' },
        { id: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b33', value: '58', label: '58 мм', position: 1, color: 'gray' },
      ],
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
      universalIdentifier: POS_PRINTER_DEVICE_CREATED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'createdAt',
      label: 'Создан',
      description: 'Время создания настройки',
      icon: 'IconClockPlus',
      isNullable: false,
      defaultValue: 'now',
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRINTER_DEVICE_UPDATED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'updatedAt',
      label: 'Изменён',
      description: 'Время последнего изменения настройки',
      icon: 'IconClockEdit',
      isNullable: false,
      defaultValue: 'now',
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
