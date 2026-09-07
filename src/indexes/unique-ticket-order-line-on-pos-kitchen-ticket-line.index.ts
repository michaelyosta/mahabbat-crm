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
      universalIdentifier: '2a0203ca-2c0a-4ccc-9612-2b939cf6e35a',
      fieldUniversalIdentifier:
        POS_KITCHEN_TICKET_LINE_TICKET_FIELD_UNIVERSAL_IDENTIFIER,
    },
    {
      universalIdentifier: '34535a04-16ae-41df-93a9-3d8843492bfd',
      fieldUniversalIdentifier:
        POS_KITCHEN_TICKET_LINE_ORDER_LINE_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
