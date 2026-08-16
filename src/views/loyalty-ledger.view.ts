import {
  defineView,
  ViewOpenRecordIn,
  ViewSortDirection,
  ViewType,
  ViewVisibility,
} from 'twenty-sdk/define';

import { LOYALTY_LEDGER_VIEW_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  LOYALTY_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
  LOYALTY_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
  LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
  LOYALTY_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  LOYALTY_REASON_FIELD_UNIVERSAL_IDENTIFIER,
  LOYALTY_RELATED_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
  LOYALTY_SOURCE_FIELD_UNIVERSAL_IDENTIFIER,
  LOYALTY_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/objects/loyalty-ledger-entry.object';

export default defineView({
  universalIdentifier: LOYALTY_LEDGER_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Лояльность',
  objectUniversalIdentifier: LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconCards',
  position: 0,
  visibility: ViewVisibility.WORKSPACE,
  openRecordIn: ViewOpenRecordIn.SIDE_PANEL,
  fields: [
    {
      universalIdentifier: '6d75bc0b-2d5f-4287-b674-8918abcb9807',
      fieldMetadataUniversalIdentifier: LOYALTY_REASON_FIELD_UNIVERSAL_IDENTIFIER,
      position: -1,
      isVisible: true,
      size: 220,
    },
    {
      universalIdentifier: 'd3740986-5ced-463e-a689-9d3b072a080a',
      fieldMetadataUniversalIdentifier: LOYALTY_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
      position: 0,
      isVisible: true,
      size: 200,
    },
    {
      universalIdentifier: '8beed4fe-75cf-4396-80aa-a05de2986396',
      fieldMetadataUniversalIdentifier: LOYALTY_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      position: 1,
      isVisible: true,
      size: 140,
    },
    {
      universalIdentifier: 'e3618c5c-cebd-41e8-91c3-10afdea60a20',
      fieldMetadataUniversalIdentifier: LOYALTY_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      position: 2,
      isVisible: true,
      size: 120,
    },
    {
      universalIdentifier: '107dba74-e82e-459c-9790-ea3553df61a4',
      fieldMetadataUniversalIdentifier: LOYALTY_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      position: 3,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier: '5ad57c60-a722-4d12-8b58-a12c5dfb2a16',
      fieldMetadataUniversalIdentifier: LOYALTY_RELATED_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      position: 4,
      isVisible: true,
      size: 160,
    },
    {
      universalIdentifier: '0672e300-953c-4ef8-b47c-9efeea5f2756',
      fieldMetadataUniversalIdentifier: LOYALTY_SOURCE_FIELD_UNIVERSAL_IDENTIFIER,
      position: 5,
      isVisible: true,
      size: 140,
    },
  ],
  sorts: [
    {
      universalIdentifier: '79b63c0a-ff51-41d0-8f3e-3db46182f39b',
      fieldMetadataUniversalIdentifier: LOYALTY_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      direction: ViewSortDirection.DESC,
    },
  ],
});
