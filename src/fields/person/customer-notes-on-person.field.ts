import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export const CUSTOMER_NOTES_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  '16d02819-e748-47e3-87bd-efc816939c07';

export default defineField({
  universalIdentifier: CUSTOMER_NOTES_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RICH_TEXT,
  name: 'customerNotes',
  label: 'Заметки о клиенте',
  description: 'Свободные заметки и предпочтения клиента',
  icon: 'IconNotes',
  isNullable: true,
  defaultValue: null,
});
