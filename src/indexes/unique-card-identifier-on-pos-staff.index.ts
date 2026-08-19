import { defineIndex } from 'twenty-sdk/define';

import {
  POS_STAFF_CARD_IDENTIFIER_FIELD_UNIVERSAL_IDENTIFIER,
  POS_STAFF_UNIQUE_CARD_IDENTIFIER_INDEX_UNIVERSAL_IDENTIFIER,
  POS_STAFF_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-staff.object';

export default defineIndex({
  universalIdentifier: POS_STAFF_UNIQUE_CARD_IDENTIFIER_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_STAFF_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '534de510-8a1c-4c94-98f1-679e8e787c82',
      fieldUniversalIdentifier: POS_STAFF_CARD_IDENTIFIER_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
