import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export const NORMALIZED_PHONE_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  '9f617f73-f0f2-4f56-97f5-e5add2b8815e';

export default defineField({
  universalIdentifier: NORMALIZED_PHONE_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'normalizedPhone',
  label: 'Нормализованный телефон',
  description: 'Телефон в едином формате; нормализация выполняется сервером',
  icon: 'IconPhone',
  isNullable: true,
  defaultValue: null,
});
