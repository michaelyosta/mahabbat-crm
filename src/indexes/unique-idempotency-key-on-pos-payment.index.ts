import { defineIndex } from 'twenty-sdk/define';

import {
  POS_PAYMENT_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  POS_PAYMENT_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  POS_PAYMENT_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-payment.object';

export default defineIndex({
  universalIdentifier: POS_PAYMENT_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_PAYMENT_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '8a4d7f10-2b3c-4d5e-8f60-1234567890ce',
      fieldUniversalIdentifier: POS_PAYMENT_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
