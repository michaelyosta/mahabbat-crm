import { defineIndex } from 'twenty-sdk/define';

import {
  POS_SESSION_SESSION_ID_FIELD_UNIVERSAL_IDENTIFIER,
  POS_SESSION_UNIQUE_SESSION_ID_INDEX_UNIVERSAL_IDENTIFIER,
  POS_SESSION_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-session.object';

export default defineIndex({
  universalIdentifier: POS_SESSION_UNIQUE_SESSION_ID_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_SESSION_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: 'f461e0e7-39fe-4005-8f79-3cd56929ff57',
      fieldUniversalIdentifier: POS_SESSION_SESSION_ID_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
