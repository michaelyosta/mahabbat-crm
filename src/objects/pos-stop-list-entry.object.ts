import { defineObject, FieldType, OnDeleteAction, RelationType } from 'twenty-sdk/define';

export const POS_STOP_LIST_ENTRY_UNIVERSAL_IDENTIFIER =
  'd6227cdf-bd96-433f-a267-bf363545a500';
export const POS_STOP_LIST_ENTRY_LABEL_FIELD_UNIVERSAL_IDENTIFIER =
  '4e1fb804-464b-46b4-8eed-57d5554bd169';
export const POS_STOP_LIST_ENTRY_MENU_ITEM_FIELD_UNIVERSAL_IDENTIFIER =
  '6aa9339d-385d-42cd-940f-00e88955e2a1';
export const POS_STOP_LIST_ENTRY_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER =
  'e83decba-b1c7-4603-b550-cadcf977a2bf';
export const POS_STOP_LIST_ENTRY_CREATED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '3e1bad34-b48b-4415-bb45-ea50a28f0b78';
export const POS_STOP_LIST_ENTRY_CLEARED_AT_FIELD_UNIVERSAL_IDENTIFIER =
  '130d3be3-21fb-44f2-bc91-abf221224589';
export const POS_STOP_LIST_ENTRY_CLEARED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER =
  '06cea9b2-1e13-4dc5-9373-25587a3790b7';
export const POS_STOP_LIST_ENTRY_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER =
  '36dab355-7db7-4034-9fd8-de7ef79ccb70';
export const POS_STOP_LIST_ENTRY_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  'bc85cab7-16f1-4050-8f02-d9cd93bf2737';

export default defineObject({
  universalIdentifier: POS_STOP_LIST_ENTRY_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posStopListEntry',
  namePlural: 'posStopListEntries',
  labelSingular: 'Запись стоп-листа',
  labelPlural: 'Стоп-лист',
  description: 'Запись стоп-листа, блокирующая добавление позиции меню',
  icon: 'IconBan',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_STOP_LIST_ENTRY_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_STOP_LIST_ENTRY_LABEL_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'label',
      label: 'Метка',
      description: 'Текстовый идентификатор записи',
      icon: 'IconTag',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_STOP_LIST_ENTRY_MENU_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'menuItem',
      label: 'Позиция меню',
      description: 'Позиция, попавшая в стоп-лист',
      icon: 'IconFileDescription',
      relationTargetObjectMetadataUniversalIdentifier:
        'c1523420-522c-48cf-953d-ac10c534488e',
      relationTargetFieldMetadataUniversalIdentifier:
        '8f1a5790-8226-4870-954c-a2d31f13f10b',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'menuItemId',
      },
    },
    {
      universalIdentifier: POS_STOP_LIST_ENTRY_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Активна',
      description: 'Запись блокирует позицию',
      icon: 'IconToggleRight',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: POS_STOP_LIST_ENTRY_CREATED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'createdByStaffId',
      label: 'Создал',
      description: 'Сотрудник, добавивший запись в стоп-лист',
      icon: 'IconUserPlus',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_STOP_LIST_ENTRY_CLEARED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.DATE_TIME,
      name: 'clearedAt',
      label: 'Время снятия',
      description: 'Момент снятия записи со стоп-листа',
      icon: 'IconClockX',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_STOP_LIST_ENTRY_CLEARED_BY_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'clearedByStaffId',
      label: 'Снял',
      description: 'Сотрудник, снявший запись со стоп-листа',
      icon: 'IconUserX',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_STOP_LIST_ENTRY_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'idempotencyKey',
      label: 'Ключ идемпотентности',
      description: 'Ключ повторяемости команды стоп-листа',
      icon: 'IconRepeat',
      isNullable: true,
      isUIEditable: false,
      defaultValue: null,
    },
  ],
});
