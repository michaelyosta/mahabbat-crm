import { defineObject, FieldType, OnDeleteAction, RelationType } from 'twenty-sdk/define';

export const POS_PRODUCTION_STATION_UNIVERSAL_IDENTIFIER =
  'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b22';
export const POS_PRODUCTION_STATION_LABEL_FIELD_UNIVERSAL_IDENTIFIER =
  'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b23';
export const POS_PRODUCTION_STATION_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER =
  'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b24';
export const POS_PRODUCTION_STATION_PRINTER_DEVICE_FIELD_UNIVERSAL_IDENTIFIER =
  'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b25';
export const POS_PRODUCTION_STATION_CREATED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b26';
export const POS_PRODUCTION_STATION_UPDATED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b27';
export const POS_PRODUCTION_STATION_MENU_ITEMS_FIELD_UNIVERSAL_IDENTIFIER =
  'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b28';
export const POS_PRODUCTION_STATION_PRINT_JOBS_FIELD_UNIVERSAL_IDENTIFIER =
  'b2f1d5e9-6a83-4c04-ab72-3e8f9d1c5b29';

export default defineObject({
  universalIdentifier: POS_PRODUCTION_STATION_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posProductionStation',
  namePlural: 'posProductionStations',
  labelSingular: 'Производственная станция',
  labelPlural: 'Производственные станции',
  description: 'Логическое место приготовления и назначения кухонной печати',
  icon: 'IconToolsKitchen2',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_PRODUCTION_STATION_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_PRODUCTION_STATION_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'label',
      label: 'Название',
      description: 'Например, Кухня, Бар или Мангал',
      icon: 'IconTag',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_PRODUCTION_STATION_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Активна',
      description: 'Станция участвует в маршрутизации',
      icon: 'IconToggleRight',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: POS_PRODUCTION_STATION_PRINTER_DEVICE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'printerDevice',
      label: 'Принтер',
      description: 'Физический принтер станции; может быть общим для нескольких станций',
      icon: 'IconPrinter',
      relationTargetObjectMetadataUniversalIdentifier: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b11',
      relationTargetFieldMetadataUniversalIdentifier: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b22',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'printerDeviceId',
      },
    },
    {
      universalIdentifier: POS_PRODUCTION_STATION_CREATED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'createdAt',
      label: 'Создана',
      description: 'Время создания станции',
      icon: 'IconClockPlus',
      isNullable: false,
      defaultValue: 'now',
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRODUCTION_STATION_UPDATED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'updatedAt',
      label: 'Изменена',
      description: 'Время последнего изменения станции',
      icon: 'IconClockEdit',
      isNullable: false,
      defaultValue: 'now',
      isUIEditable: false,
    },
    {
      universalIdentifier: POS_PRODUCTION_STATION_MENU_ITEMS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'menuItems',
      label: 'Позиции меню',
      description: 'Позиции меню, которые готовятся на станции',
      icon: 'IconFileDescription',
      relationTargetObjectMetadataUniversalIdentifier: 'c1523420-522c-48cf-953d-ac10c534488e',
      relationTargetFieldMetadataUniversalIdentifier: 'a1f0c4d8-5e72-4b93-9a61-2d7f8c0e4b2a',
      universalSettings: { relationType: RelationType.ONE_TO_MANY },
    },
    {
      universalIdentifier: POS_PRODUCTION_STATION_PRINT_JOBS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'printJobs',
      label: 'Задания печати',
      description: 'Задания, направленные на станцию',
      icon: 'IconClipboardList',
      relationTargetObjectMetadataUniversalIdentifier: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c33',
      relationTargetFieldMetadataUniversalIdentifier: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c37',
      universalSettings: { relationType: RelationType.ONE_TO_MANY },
    },
  ],
});
