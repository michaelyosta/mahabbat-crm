import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export const LAST_ACTIVITY_AT_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  'e49a60b2-c05f-48b8-85d7-ba6ad17cedfc';

export default defineField({
  universalIdentifier: LAST_ACTIVITY_AT_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.DATE_TIME,
  name: 'lastActivityAt',
  label: 'Последняя активность',
  description: 'Дата последнего взаимодействия с клиентом',
  icon: 'IconHistory',
  isNullable: true,
  defaultValue: null,
});
