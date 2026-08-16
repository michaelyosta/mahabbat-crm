import { defineIndex } from 'twenty-sdk/define';

import {
  RESERVATION_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
  RESERVATION_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER,
  RESERVATION_UNIVERSAL_IDENTIFIER,
} from 'src/objects/reservation.object';

export const RESERVATION_UNIQUE_PROVIDER_EXTERNAL_ID_INDEX_UNIVERSAL_IDENTIFIER =
  '8a3f1c5e-7b29-4d60-9e42-6f18c3b5a704';

export default defineIndex({
  universalIdentifier: RESERVATION_UNIQUE_PROVIDER_EXTERNAL_ID_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: RESERVATION_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: 'b5d2f8a4-1c67-4e90-9f32-7a18c6e3d504',
      fieldUniversalIdentifier: RESERVATION_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER,
    },
    {
      universalIdentifier: 'd7e3a9f5-2b81-4c60-8e24-6f13a5c9b704',
      fieldUniversalIdentifier: RESERVATION_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
