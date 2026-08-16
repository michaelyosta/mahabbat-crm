import { defineIndex } from 'twenty-sdk/define';

import { LOYALTY_UNIQUE_CUSTOMER_OCCURRED_AT_REASON_INDEX_UNIVERSAL_IDENTIFIER } from '../objects/loyalty-ledger-entry.object';

export default defineIndex({
  universalIdentifier:
    LOYALTY_UNIQUE_CUSTOMER_OCCURRED_AT_REASON_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: 'ce455a03-74bd-460f-863b-4da2f2138979',
  isUnique: true,
  fields: [
    {
      universalIdentifier: '0406e5f0-f436-47b6-94c5-14ff40f41e2a',
      fieldUniversalIdentifier: 'ade48490-f3d2-4e6d-88e6-891c928d6945',
    },
    {
      universalIdentifier: 'dd433d5e-001d-4d5e-94ec-c04c45097188',
      fieldUniversalIdentifier: 'bd5e410d-65b4-4ff6-b47b-4254cb88c1c7',
    },
    {
      universalIdentifier: '35c156fd-77a7-4d3c-a49c-2841005083a0',
      fieldUniversalIdentifier: '6647e390-6f37-4ec6-a108-1ed0ecbf84f1',
    },
  ],
});
