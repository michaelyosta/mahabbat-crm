import { defineIndex } from 'twenty-sdk/define';

import {
  POS_KITCHEN_TICKET_REQUEST_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  POS_KITCHEN_TICKET_UNIQUE_REQUEST_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  POS_KITCHEN_TICKET_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-kitchen-ticket.object';

export default defineIndex({
  universalIdentifier:
    POS_KITCHEN_TICKET_UNIQUE_REQUEST_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_KITCHEN_TICKET_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '7c1a2f34-5b67-4d89-8e01-23456789abf2',
      fieldUniversalIdentifier:
        POS_KITCHEN_TICKET_REQUEST_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
