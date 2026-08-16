import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  LOYALTY_ADJUSTMENT_REQUEST_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
  LOYALTY_ADJUSTMENT_REQUESTS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  LOYALTY_ADJUSTMENT_REQUEST_UNIVERSAL_IDENTIFIER,
} from 'src/objects/loyalty-adjustment-request.object';

export default defineField({
  universalIdentifier:
    LOYALTY_ADJUSTMENT_REQUESTS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'loyaltyAdjustmentRequests',
  label: 'Заявки на корректировку лояльности',
  description: 'Внутренние заявки на изменение бонусных баллов клиента',
  icon: 'IconReceipt2',
  relationTargetObjectMetadataUniversalIdentifier:
    LOYALTY_ADJUSTMENT_REQUEST_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    LOYALTY_ADJUSTMENT_REQUEST_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
