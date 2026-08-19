import { defineIndex } from 'twenty-sdk/define';

import {
  POS_STOP_LIST_ENTRY_MENU_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
  POS_STOP_LIST_ENTRY_UNIQUE_MENU_ITEM_INDEX_UNIVERSAL_IDENTIFIER,
  POS_STOP_LIST_ENTRY_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-stop-list-entry.object';

export default defineIndex({
  universalIdentifier: POS_STOP_LIST_ENTRY_UNIQUE_MENU_ITEM_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_STOP_LIST_ENTRY_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: 'bc85cab7-16f1-4050-8f02-d9cd93bf2740',
      fieldUniversalIdentifier:
        POS_STOP_LIST_ENTRY_MENU_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
