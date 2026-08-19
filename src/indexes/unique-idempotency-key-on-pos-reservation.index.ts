import { defineIndex } from 'twenty-sdk/define';
import {
  POS_RESERVATION_UNIVERSAL_IDENTIFIER,
  POS_RESERVATION_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  POS_RESERVATION_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-reservation.object';

export default defineIndex({
  universalIdentifier:
    POS_RESERVATION_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_RESERVATION_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '7a4d7f10-2b3c-4d5e-8f60-1234567890b1',
      fieldUniversalIdentifier: POS_RESERVATION_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
