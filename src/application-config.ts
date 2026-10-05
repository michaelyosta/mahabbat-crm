import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  serverVariables: {
    MAHABBAT_INTERNAL_ROUTE_SECRET: {
      description:
        'Primary secret for internal route HMAC (v1=<hex>). Rotate via MAHABBAT_INTERNAL_ROUTE_SECRET_PREVIOUS grace: set the previous value there, deploy, then switch primary.',
      isSecret: true,
      isRequired: true,
    },
    MAHABBAT_INTERNAL_ROUTE_SECRET_PREVIOUS: {
      description:
        'Previous internal route secret accepted alongside the primary during rotation grace. Empty outside rotation.',
      isSecret: true,
      isRequired: false,
    },
  },
});
