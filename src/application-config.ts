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
        'Secret used only between the authenticated adjustment route and the app-only server resolver. Configure and rotate before production use.',
      isSecret: true,
      isRequired: true,
    },
  },
});
