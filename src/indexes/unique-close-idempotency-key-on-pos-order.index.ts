import { defineIndex } from 'twenty-sdk/define';

import {
  POS_ORDER_CLOSE_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  POS_ORDER_UNIQUE_CLOSE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  POS_ORDER_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-order.object';

export default defineIndex({
  universalIdentifier: POS_ORDER_UNIQUE_CLOSE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_ORDER_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '8a4d7f10-2b3c-4d5e-8f60-1234567890d5',
      fieldUniversalIdentifier: POS_ORDER_CLOSE_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
