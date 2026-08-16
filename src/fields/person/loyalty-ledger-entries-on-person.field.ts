import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  LOYALTY_ENTRIES_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  LOYALTY_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
  LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
} from '../../objects/loyalty-ledger-entry.object';

export default defineField({
  universalIdentifier: LOYALTY_ENTRIES_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'loyaltyLedgerEntries',
  label: 'Операции лояльности',
  description: 'Операции лояльности клиента',
  icon: 'IconCards',
  relationTargetObjectMetadataUniversalIdentifier:
    LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    LOYALTY_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
