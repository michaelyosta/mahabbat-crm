import { defineIndex } from 'twenty-sdk/define';

import {
  POS_ORDER_GUEST_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  POS_ORDER_GUEST_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  POS_ORDER_GUEST_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-order-guest.object';

export default defineIndex({
  universalIdentifier:
    POS_ORDER_GUEST_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_ORDER_GUEST_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '7d3a1f6e-2b8c-4c0f-8f1d-9a2b3c4d5e07',
      fieldUniversalIdentifier: POS_ORDER_GUEST_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
