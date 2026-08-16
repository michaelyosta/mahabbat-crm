import {
  defineView,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
  ViewFilterGroupLogicalOperator,
  ViewFilterOperand,
  ViewOpenRecordIn,
  ViewSortDirection,
  ViewType,
  ViewVisibility,
} from 'twenty-sdk/define';

import {
  CUSTOMER_STATUS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/fields/person/customer-status-on-person.field';
import {
  LAST_ACTIVITY_AT_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/fields/person/last-activity-at-on-person.field';
import {
  NORMALIZED_PHONE_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/fields/person/normalized-phone-on-person.field';

export const CUSTOMERS_NOT_RETURNED_VIEW_UNIVERSAL_IDENTIFIER =
  'b1c2d3e4-f5a6-47b8-9c0d-2e3f4a5b6c78';
const CUSTOMERS_NOT_RETURNED_FILTER_GROUP_UNIVERSAL_IDENTIFIER =
  'b1c2d3e4-f5a6-47b8-9c0d-2e3f4a5b6c79';

export default defineView({
  universalIdentifier: CUSTOMERS_NOT_RETURNED_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Не возвращались 30 дней',
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: ViewType.TABLE,
  icon: 'IconUserOff',
  position: 0,
  visibility: ViewVisibility.WORKSPACE,
  openRecordIn: ViewOpenRecordIn.SIDE_PANEL,
  fields: [
    {
      universalIdentifier: 'b1c2d3e4-f5a6-47b8-9c0d-2e3f4a5b6c85',
      fieldMetadataUniversalIdentifier: '20202020-3875-44d5-8c33-a6239011cab8',
      position: -1,
      isVisible: true,
      size: 200,
    },
    {
      universalIdentifier: 'b1c2d3e4-f5a6-47b8-9c0d-2e3f4a5b6c80',
      fieldMetadataUniversalIdentifier:
        LAST_ACTIVITY_AT_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      position: 0,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier: 'b1c2d3e4-f5a6-47b8-9c0d-2e3f4a5b6c81',
      fieldMetadataUniversalIdentifier:
        CUSTOMER_STATUS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      position: 1,
      isVisible: true,
      size: 140,
    },
    {
      universalIdentifier: 'b1c2d3e4-f5a6-47b8-9c0d-2e3f4a5b6c82',
      fieldMetadataUniversalIdentifier:
        NORMALIZED_PHONE_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      position: 2,
      isVisible: true,
      size: 160,
    },
  ],
  filterGroups: [
    {
      universalIdentifier:
        CUSTOMERS_NOT_RETURNED_FILTER_GROUP_UNIVERSAL_IDENTIFIER,
      logicalOperator: ViewFilterGroupLogicalOperator.NOT,
      positionInViewFilterGroup: 0,
    },
  ],
  filters: [
    {
      universalIdentifier: 'b1c2d3e4-f5a6-47b8-9c0d-2e3f4a5b6c83',
      fieldMetadataUniversalIdentifier:
        LAST_ACTIVITY_AT_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS_RELATIVE,
      value: 'PAST_30_DAY',
      viewFilterGroupUniversalIdentifier:
        CUSTOMERS_NOT_RETURNED_FILTER_GROUP_UNIVERSAL_IDENTIFIER,
      positionInViewFilterGroup: 0,
    },
  ],
  sorts: [
    {
      universalIdentifier: 'b1c2d3e4-f5a6-47b8-9c0d-2e3f4a5b6c84',
      fieldMetadataUniversalIdentifier:
        LAST_ACTIVITY_AT_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      direction: ViewSortDirection.ASC,
    },
  ],
});
