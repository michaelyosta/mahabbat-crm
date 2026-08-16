import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export const EXTERNAL_PROVIDER_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  '7f9c3a27-bd36-4d54-8b37-27c0f5f84a10';

export default defineField({
  universalIdentifier: EXTERNAL_PROVIDER_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'provider',
  label: 'Система-источник',
  description: 'Система, из которой получены данные клиента.',
  icon: 'IconWorld',
  isNullable: true,
  isUIEditable: false,
  defaultValue: null,
});
