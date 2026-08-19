import { defineIndex } from 'twenty-sdk/define';

import {
  POS_SHIFT_IS_OPEN_FIELD_UNIVERSAL_IDENTIFIER,
  POS_SHIFT_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
  POS_SHIFT_UNIQUE_STAFF_IS_OPEN_INDEX_UNIVERSAL_IDENTIFIER,
  POS_SHIFT_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-shift.object';

export default defineIndex({
  universalIdentifier: POS_SHIFT_UNIQUE_STAFF_IS_OPEN_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_SHIFT_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '7d3a1f6e-2b8c-4c0f-8f1d-9a2b3c4d5e02',
      fieldUniversalIdentifier: POS_SHIFT_STAFF_ID_FIELD_UNIVERSAL_IDENTIFIER,
    },
    {
      universalIdentifier: '7d3a1f6e-2b8c-4c0f-8f1d-9a2b3c4d5e03',
      fieldUniversalIdentifier: POS_SHIFT_IS_OPEN_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
