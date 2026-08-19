import { defineIndex } from 'twenty-sdk/define';

import {
  POS_PRECHECK_ACTIVE_ORDER_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  POS_PRECHECK_UNIQUE_ACTIVE_ORDER_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  POS_PRECHECK_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-precheck.object';

export default defineIndex({
  universalIdentifier: POS_PRECHECK_UNIQUE_ACTIVE_ORDER_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_PRECHECK_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '9e3c4f56-7a89-4f01-8123-456789abcd22',
      fieldUniversalIdentifier: POS_PRECHECK_ACTIVE_ORDER_KEY_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
