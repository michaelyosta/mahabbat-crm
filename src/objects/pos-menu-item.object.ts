import { defineObject, FieldType, RelationType } from 'twenty-sdk/define';

export const POS_MENU_ITEM_UNIVERSAL_IDENTIFIER =
  'c1523420-522c-48cf-953d-ac10c534488e';
export const POS_MENU_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  'e417fdc6-34fa-4051-a00d-1a4dff731b6f';
export const POS_MENU_ITEM_CATEGORY_FIELD_UNIVERSAL_IDENTIFIER =
  '83af8b72-9390-4de5-ac2e-b68c613d16be';
export const POS_MENU_ITEM_PRICE_FIELD_UNIVERSAL_IDENTIFIER =
  'd3d07468-9aa1-4f91-b7f5-00558705d58c';
export const POS_MENU_ITEM_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER =
  '316ba16d-0add-4cca-a3a1-8f6c8a8ef442';
export const POS_MENU_ITEM_LINES_FIELD_UNIVERSAL_IDENTIFIER =
  'a068393e-a10e-439b-88ba-16ceb29b7991';
export const POS_MENU_ITEM_STOP_LIST_ENTRIES_FIELD_UNIVERSAL_IDENTIFIER =
  '8f1a5790-8226-4870-954c-a2d31f13f10b';

export default defineObject({
  universalIdentifier: POS_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posMenuItem',
  namePlural: 'posMenuItems',
  labelSingular: 'Позиция меню',
  labelPlural: 'Позиции меню',
  description: 'Позиция меню ресторана для залов',
  icon: 'IconFileDescription',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_MENU_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_MENU_ITEM_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Название',
      description: 'Название позиции меню',
      icon: 'IconTag',
      isNullable: false,
      defaultValue: '',
    },
    {
      universalIdentifier: POS_MENU_ITEM_CATEGORY_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'category',
      label: 'Категория',
      description: 'Опциональная категория позиции',
      icon: 'IconFolder',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_MENU_ITEM_PRICE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.CURRENCY,
      name: 'price',
      label: 'Цена',
      description: 'Актуальная цена позиции',
      icon: 'IconCash',
      isNullable: false,
      defaultValue: { amountMicros: '0', currencyCode: 'KZT' },
    },
    {
      universalIdentifier: POS_MENU_ITEM_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Активна',
      description: 'Позиция доступна для добавления в заказ',
      icon: 'IconToggleRight',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: POS_MENU_ITEM_LINES_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'lines',
      label: 'Позиции заказов',
      description: 'Позиции заказов, созданные из этой позиции меню',
      icon: 'IconList',
      relationTargetObjectMetadataUniversalIdentifier:
        'e526ebd1-bc93-42eb-91c7-59430a781d7f',
      relationTargetFieldMetadataUniversalIdentifier:
        '356b729c-e51b-4a6f-ae83-f26e0870e330',
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: POS_MENU_ITEM_STOP_LIST_ENTRIES_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'stopListEntries',
      label: 'Стоп-лист',
      description: 'Записи стоп-листа для этой позиции',
      icon: 'IconBan',
      relationTargetObjectMetadataUniversalIdentifier:
        'd6227cdf-bd96-433f-a267-bf363545a500',
      relationTargetFieldMetadataUniversalIdentifier:
        '6aa9339d-385d-42cd-940f-00e88955e2a1',
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
