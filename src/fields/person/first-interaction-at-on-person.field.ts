import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

export const FIRST_INTERACTION_AT_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER =
  '76d1020a-7382-4497-95a2-7a6d1daab5cf';

export default defineField({
  universalIdentifier:
    FIRST_INTERACTION_AT_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.DATE_TIME,
  name: 'firstInteractionAt',
  label: 'Первое взаимодействие',
  description: 'Дата первого контакта с клиентом',
  icon: 'IconCalendarPlus',
  isNullable: true,
  defaultValue: null,
});
