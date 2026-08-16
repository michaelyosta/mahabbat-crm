import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export const EXTERNAL_ID_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  '32c6f238-bd8d-408d-8fbb-59b610ce0ffd';

export default defineField({
  universalIdentifier: EXTERNAL_ID_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'externalId',
  label: 'Внешний ID',
  description: 'Идентификатор клиента во внешней системе',
  icon: 'IconId',
  isNullable: true,
  isUIEditable: false,
  defaultValue: null,
});
