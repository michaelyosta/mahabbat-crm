import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  RESERVATION_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
  RESERVATION_RESERVATIONS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  RESERVATION_UNIVERSAL_IDENTIFIER,
} from '../../objects/reservation.object';

export default defineField({
  universalIdentifier: RESERVATION_RESERVATIONS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'reservations',
  label: 'Бронирования',
  description: 'Бронирования, оформленные клиентом',
  icon: 'IconCalendarEvent',
  relationTargetObjectMetadataUniversalIdentifier:
    RESERVATION_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    RESERVATION_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
