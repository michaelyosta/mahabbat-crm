import { defineIndex } from 'twenty-sdk/define';
import {
  POS_OPERATIONAL_EVENT_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  POS_OPERATIONAL_EVENT_UNIQUE_IDEMPOTENCY_INDEX_UNIVERSAL_IDENTIFIER,
  POS_OPERATIONAL_EVENT_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-operational-event.object';

export default defineIndex({
  universalIdentifier: POS_OPERATIONAL_EVENT_UNIQUE_IDEMPOTENCY_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_OPERATIONAL_EVENT_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '6b4d7f10-2b3c-4d5e-8f60-1234567890b1',
      fieldUniversalIdentifier: POS_OPERATIONAL_EVENT_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
