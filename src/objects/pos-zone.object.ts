import { defineObject, FieldType, RelationType } from 'twenty-sdk/define';

export const POS_ZONE_UNIVERSAL_IDENTIFIER =
  '89dfd8f2-ae53-41a3-b69f-ad1a0e558662';
export const POS_ZONE_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  '9ef03aea-5c55-43bb-8d87-bd3a7018b16a';
export const POS_ZONE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER =
  'f0b4961f-e7f7-475a-9670-4e9d88bfa612';
export const POS_ZONE_TABLES_FIELD_UNIVERSAL_IDENTIFIER =
  '30621fb1-3286-4817-a73a-a10ea7636e7d';

export default defineObject({
  universalIdentifier: POS_ZONE_UNIVERSAL_IDENTIFIER,
  nameSingular: 'posZone',
  namePlural: 'posZones',
  labelSingular: 'Зона зала',
  labelPlural: 'Зоны зала',
  description: 'Зона зала ресторана, объединяющая столы',
  icon: 'IconLayoutGrid',
  labelIdentifierFieldMetadataUniversalIdentifier:
    POS_ZONE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: POS_ZONE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Название',
      description: 'Название зоны зала',
      icon: 'IconMapPin',
      isNullable: false,
      defaultValue: '',
    },
    {
      universalIdentifier: POS_ZONE_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Активна',
      description: 'Зона доступна для посадки гостей',
      icon: 'IconToggleRight',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: POS_ZONE_TABLES_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.RELATION,
      name: 'tables',
      label: 'Столы',
      description: 'Столы в этой зоне',
      icon: 'IconGridDots',
      relationTargetObjectMetadataUniversalIdentifier:
        '205a888c-c914-4069-9a47-9bdf3021cbb5',
      relationTargetFieldMetadataUniversalIdentifier:
        'd6992a21-d49a-4bc1-ba7c-5fbee4837e10',
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
