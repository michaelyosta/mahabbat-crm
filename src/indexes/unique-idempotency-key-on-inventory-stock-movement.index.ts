import { defineIndex } from 'twenty-sdk/define';

import {
  INVENTORY_STOCK_MOVEMENT_IDEMPOTENCY_FIELD_UNIVERSAL_IDENTIFIER,
  INVENTORY_STOCK_MOVEMENT_UNIVERSAL_IDENTIFIER,
} from '../objects/inventory-stock-movement.object';

export const INVENTORY_STOCK_MOVEMENT_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER =
  'c0ffee00-1111-4aaa-8000-000000000901';

export default defineIndex({
  universalIdentifier:
    INVENTORY_STOCK_MOVEMENT_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: INVENTORY_STOCK_MOVEMENT_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: 'c0ffee00-2222-4aaa-8000-000000000902',
      fieldUniversalIdentifier:
        INVENTORY_STOCK_MOVEMENT_IDEMPOTENCY_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
