import { defineObject, FieldType, OnDeleteAction, RelationType } from 'twenty-sdk/define';

export const POS_TABLE_UNIVERSAL_IDENTIFIER =
  '205a888c-c914-4069-9a47-9bdf3021cbb5';
export const POS_TABLE_NUMBER_FIELD_UNIVERSAL_IDENTIFIER =
  '7a02a6fa-2384-4a8a-a8b4-9f616547955f';
export const POS_TABLE_ZONE_FIELD_UNIVERSAL_IDENTIFIER =
  'd6992a21-d49a-4bc1-ba7c-5fbee4837e10';
export const POS_TABLE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER =
  'b4987798-a320-450e-a645-2498082b103c';
export const POS_TABLE_LAYOUT_FIELD_UNIVERSAL_IDENTIFIER =
  '2dbcb53f-6e19-4006-8baa-5f73fa66cc22';
export const POS_TABLE_ORDERS_FIELD_UNIVERSAL_IDENTIFIER =
  '98d21aeb-6efa-49f4-87d4-4a7b8fd4f9f9';

export default defineObject({
  universalIdentifier: POS_TABLE_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posTable',
  namePlural: 'posTables',
  labelSingular: 'Стол',
  labelPlural: 'Столы',
  description: 'Стол в зале ресторана',
  icon: 'IconGridDots',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_TABLE_NUMBER_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_TABLE_NUMBER_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'number',
      label: 'Номер',
      description: 'Номер или название стола',
      icon: 'IconHash',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: POS_TABLE_ZONE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'zone',
      label: 'Зона',
      description: 'Зона зала, в которой находится стол',
      icon: 'IconMapPin',
      relationTargetObjectMetadataUniversalIdentifier:
        '89dfd8f2-ae53-41a3-b69f-ad1a0e558662',
      relationTargetFieldMetadataUniversalIdentifier:
        '30621fb1-3286-4817-a73a-a10ea7636e7d',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.RESTRICT,
        joinColumnName: 'zoneId',
      },
    },
    {
      universalIdentifier: POS_TABLE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Активен',
      description: 'Стол доступен для посадки гостей',
      icon: 'IconToggleRight',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: POS_TABLE_LAYOUT_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'layout',
      label: 'Расположение',
      description: 'Опциональное описание расположения стола',
      icon: 'IconMap',
      isNullable: true,
      defaultValue: null,
    },
    {
      universalIdentifier: POS_TABLE_ORDERS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'orders',
      label: 'Заказы',
      description: 'Заказы, размещённые на этом столе',
      icon: 'IconShoppingCart',
      relationTargetObjectMetadataUniversalIdentifier:
        'a967e1ff-fea2-4a77-959a-c16460f51377',
      relationTargetFieldMetadataUniversalIdentifier:
        '87844b37-ded0-45a4-a5df-5fb3bffba5e0',
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
