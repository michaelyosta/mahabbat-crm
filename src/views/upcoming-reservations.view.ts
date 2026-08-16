import {
  defineView,
  ViewFilterOperand,
  ViewOpenRecordIn,
  ViewSortDirection,
  ViewType,
  ViewVisibility,
} from 'twenty-sdk/define';

import {
  RESERVATION_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
  RESERVATION_GUEST_COUNT_FIELD_UNIVERSAL_IDENTIFIER,
  RESERVATION_GUEST_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  RESERVATION_TIME_FIELD_UNIVERSAL_IDENTIFIER,
  RESERVATION_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  RESERVATION_TABLE_FIELD_UNIVERSAL_IDENTIFIER,
  RESERVATION_UNIVERSAL_IDENTIFIER,
  RESERVATION_ZONE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/objects/reservation.object';

export const UPCOMING_RESERVATIONS_VIEW_UNIVERSAL_IDENTIFIER =
  'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b67';

export default defineView({
  universalIdentifier: UPCOMING_RESERVATIONS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Ближайшие бронирования',
  objectUniversalIdentifier: RESERVATION_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconCalendarEvent',
  position: 0,
  visibility: ViewVisibility.WORKSPACE,
  openRecordIn: ViewOpenRecordIn.SIDE_PANEL,
  fields: [
    {
      universalIdentifier: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b68',
      fieldMetadataUniversalIdentifier:
        RESERVATION_GUEST_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      position: 0,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b69',
      fieldMetadataUniversalIdentifier:
        RESERVATION_TIME_FIELD_UNIVERSAL_IDENTIFIER,
      position: 1,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b70',
      fieldMetadataUniversalIdentifier:
        RESERVATION_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
      position: 2,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b71',
      fieldMetadataUniversalIdentifier:
        RESERVATION_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      position: 3,
      isVisible: true,
      size: 140,
    },
    {
      universalIdentifier: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b72',
      fieldMetadataUniversalIdentifier:
        RESERVATION_GUEST_COUNT_FIELD_UNIVERSAL_IDENTIFIER,
      position: 4,
      isVisible: true,
      size: 110,
    },
    {
      universalIdentifier: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b73',
      fieldMetadataUniversalIdentifier:
        RESERVATION_ZONE_FIELD_UNIVERSAL_IDENTIFIER,
      position: 5,
      isVisible: true,
      size: 120,
    },
    {
      universalIdentifier: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b74',
      fieldMetadataUniversalIdentifier:
        RESERVATION_TABLE_FIELD_UNIVERSAL_IDENTIFIER,
      position: 6,
      isVisible: true,
      size: 100,
    },
  ],
  filters: [
    {
      universalIdentifier: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b75',
      fieldMetadataUniversalIdentifier:
        RESERVATION_TIME_FIELD_UNIVERSAL_IDENTIFIER,
      operand: ViewFilterOperand.IS_IN_FUTURE,
      value: true,
      positionInViewFilterGroup: 0,
    },
  ],
  sorts: [
    {
      universalIdentifier: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b76',
      fieldMetadataUniversalIdentifier:
        RESERVATION_TIME_FIELD_UNIVERSAL_IDENTIFIER,
      direction: ViewSortDirection.ASC,
    },
  ],
});
