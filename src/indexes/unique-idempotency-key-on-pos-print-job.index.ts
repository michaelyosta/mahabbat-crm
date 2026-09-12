import { defineIndex } from 'twenty-sdk/define';

import {
  POS_PRINT_JOB_UNIVERSAL_IDENTIFIER,
  POS_PRINT_JOB_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER,
} from '../objects/pos-print-job.object';

export default defineIndex({
  universalIdentifier: POS_PRINT_JOB_UNIQUE_IDEMPOTENCY_KEY_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: POS_PRINT_JOB_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c4c',
      fieldUniversalIdentifier: 'c3f2e6fa-7b94-4d15-bc83-4f9a0e2d6c3c',
    },
  ],
  isUnique: true,
});
