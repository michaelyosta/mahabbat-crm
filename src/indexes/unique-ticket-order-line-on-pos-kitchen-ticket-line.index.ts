import { defineIndex } from 'twenty-sdk/define';

import {
  POS_KITCHEN_TICKET_LINE_ORDER_LINE_FIELD_UNIVERSAL_IDENTIFIER,
  POS_KITCHEN_TICKET_LINE_TICKET_FIELD_UNIVERSAL_IDENTIFIER,
  POS_KITCHEN_TICKET_LINE_UNIQUE_TICKET_ORDER_LINE_INDEX_UNIVERSAL_IDENTIFIER,
  POS_KITCHEN_TICKET_LINE_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-kitchen-ticket-line.object';

export default defineIndex({
  universalIdentifier:
    POS_KITCHEN_TICKET_LINE_UNIQUE_TICKET_ORDER_LINE_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_KITCHEN_TICKET_LINE_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '8d2b3f45-6c78-4e90-9f12-3456789abceb',
      fieldUniversalIdentifier:
        POS_KITCHEN_TICKET_LINE_TICKET_FIELD_UNIVERSAL_IDENTIFIER,
    },
    {
      universalIdentifier: '8d2b3f45-6c78-4e90-9f12-3456789abcec',
      fieldUniversalIdentifier:
        POS_KITCHEN_TICKET_LINE_ORDER_LINE_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
