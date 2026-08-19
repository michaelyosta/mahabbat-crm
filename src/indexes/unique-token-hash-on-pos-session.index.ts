import { defineIndex } from 'twenty-sdk/define';

import {
  POS_SESSION_TOKEN_HASH_FIELD_UNIVERSAL_IDENTIFIER,
  POS_SESSION_UNIQUE_TOKEN_HASH_INDEX_UNIVERSAL_IDENTIFIER,
  POS_SESSION_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-session.object';

export default defineIndex({
  universalIdentifier: POS_SESSION_UNIQUE_TOKEN_HASH_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_SESSION_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: '30b6ba0c-4446-41ba-8ae5-3fe480e4ae44',
      fieldUniversalIdentifier: POS_SESSION_TOKEN_HASH_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
