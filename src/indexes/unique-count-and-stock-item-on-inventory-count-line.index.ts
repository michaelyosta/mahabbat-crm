import { defineIndex } from 'twenty-sdk/define';

import {
  INVENTORY_COUNT_LINE_COUNT_FIELD_UNIVERSAL_IDENTIFIER,
  INVENTORY_COUNT_LINE_STOCK_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
  INVENTORY_COUNT_LINE_UNIVERSAL_IDENTIFIER,
} from '../objects/inventory-count-line.object';

export const INVENTORY_COUNT_LINE_UNIQUE_COUNT_STOCK_ITEM_INDEX_UNIVERSAL_IDENTIFIER =
  'e00e1f00-1111-4bbb-8000-000000001109';

export default defineIndex({
  universalIdentifier:
    INVENTORY_COUNT_LINE_UNIQUE_COUNT_STOCK_ITEM_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: INVENTORY_COUNT_LINE_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: 'e00e1f00-1111-4bbb-8000-00000000110a',
      fieldUniversalIdentifier:
        INVENTORY_COUNT_LINE_COUNT_FIELD_UNIVERSAL_IDENTIFIER,
    },
    {
      universalIdentifier: 'e00e1f00-1111-4bbb-8000-00000000110b',
      fieldUniversalIdentifier:
        INVENTORY_COUNT_LINE_STOCK_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
