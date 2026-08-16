import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export const EXTERNAL_IDENTITY_KEY_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  'a7e4c9b2-5d18-4f63-9a27-6c40e8b1d503';

export default defineField({
  universalIdentifier: EXTERNAL_IDENTITY_KEY_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'externalIdentityKey',
  label: 'Служебный ключ источника',
  description: 'Системный ключ для защиты от повторного импорта.',
  icon: 'IconKey',
  isNullable: true,
  isUnique: true,
  isUIEditable: false,
  defaultValue: null,
});
