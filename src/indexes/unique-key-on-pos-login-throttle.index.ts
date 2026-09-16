import { defineIndex } from 'twenty-sdk/define';

import {
  POS_LOGIN_THROTTLE_KEY_FIELD_UNIVERSAL_IDENTIFIER,
  POS_LOGIN_THROTTLE_UNIQUE_KEY_INDEX_FIELD_UNIVERSAL_IDENTIFIER,
  POS_LOGIN_THROTTLE_UNIQUE_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  POS_LOGIN_THROTTLE_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-login-throttle.object';

export default defineIndex({
  universalIdentifier: POS_LOGIN_THROTTLE_UNIQUE_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_LOGIN_THROTTLE_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier:
        POS_LOGIN_THROTTLE_UNIQUE_KEY_INDEX_FIELD_UNIVERSAL_IDENTIFIER,
      fieldUniversalIdentifier: POS_LOGIN_THROTTLE_KEY_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
