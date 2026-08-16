import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  ORDER_CUSTOMER_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_ORDERS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_UNIVERSAL_IDENTIFIER,
} from '../../objects/order.object';

export default defineField({
  universalIdentifier: ORDER_ORDERS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'orders',
  label: 'Заказы',
  description: 'Заказы, оформленные клиентом',
  icon: 'IconShoppingCart',
  relationTargetObjectMetadataUniversalIdentifier: ORDER_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    ORDER_CUSTOMER_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
