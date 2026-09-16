import { defineIndex } from 'twenty-sdk/define';

import {
  POS_STAFF_PIN_LOOKUP_FIELD_UNIVERSAL_IDENTIFIER,
  POS_STAFF_PIN_LOOKUP_INDEX_UNIVERSAL_IDENTIFIER,
  POS_STAFF_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-staff.object';

export default defineIndex({
  universalIdentifier: POS_STAFF_PIN_LOOKUP_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_STAFF_UNIVERSAL_IDENTIFIER,
  isUnique: false,
  fields: [
    {
      universalIdentifier: '9f8e7d6c-5b4a-4938-8271-6a5b4c3d2e1f',
      fieldUniversalIdentifier: POS_STAFF_PIN_LOOKUP_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
