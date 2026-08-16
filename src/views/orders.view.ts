import {
  defineView,
  ViewOpenRecordIn,
  ViewSortDirection,
  ViewType,
  ViewVisibility,
} from 'twenty-sdk/define';

import { ORDERS_VIEW_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  ORDER_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_CUSTOMER_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_NOTES_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_ORDERED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_SUBTOTAL_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_UNIVERSAL_IDENTIFIER,
} from 'src/objects/order.object';

export default defineView({
  universalIdentifier: ORDERS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Заказы',
  objectUniversalIdentifier: ORDER_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconShoppingCart',
  position: 0,
  visibility: ViewVisibility.WORKSPACE,
  openRecordIn: ViewOpenRecordIn.SIDE_PANEL,
  fields: [
    {
      universalIdentifier: '095e24d3-5d03-41a8-908c-c6928b6d3f88',
      fieldMetadataUniversalIdentifier: ORDER_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
      position: -1,
      isVisible: true,
      size: 160,
    },
    {
      universalIdentifier: '2c192005-f32e-4f61-a2fc-4eeb24659ba0',
      fieldMetadataUniversalIdentifier: ORDER_CUSTOMER_RELATION_FIELD_UNIVERSAL_IDENTIFIER,
      position: 0,
      isVisible: true,
      size: 200,
    },
    {
      universalIdentifier: 'da27d3d7-1a75-430d-82c0-e6db007a8490',
      fieldMetadataUniversalIdentifier: ORDER_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      position: 1,
      isVisible: true,
      size: 140,
    },
    {
      universalIdentifier: 'fee3e908-4ca0-4b2c-90c1-968f52140314',
      fieldMetadataUniversalIdentifier: ORDER_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      position: 2,
      isVisible: true,
      size: 140,
    },
    {
      universalIdentifier: '9cab8a12-b4fb-497e-a1d5-c7ccd2fbf1a5',
      fieldMetadataUniversalIdentifier: ORDER_ORDERED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      position: 3,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier: '38a70f01-cd84-41da-8d00-25fa4b78ad82',
      fieldMetadataUniversalIdentifier: ORDER_SUBTOTAL_FIELD_UNIVERSAL_IDENTIFIER,
      position: 4,
      isVisible: true,
      size: 120,
    },
    {
      universalIdentifier: 'f6def30a-ec6e-4b6c-bc4f-9f7fadf1b9e5',
      fieldMetadataUniversalIdentifier: ORDER_TOTAL_FIELD_UNIVERSAL_IDENTIFIER,
      position: 5,
      isVisible: true,
      size: 120,
    },
    {
      universalIdentifier: '812dc5f5-27a3-4247-9cb9-7c02ba9de24a',
      fieldMetadataUniversalIdentifier: ORDER_NOTES_FIELD_UNIVERSAL_IDENTIFIER,
      position: 6,
      isVisible: true,
      size: 220,
    },
  ],
  sorts: [
    {
      universalIdentifier: 'dd5a98d0-99f3-4c62-a475-0547e922a7bb',
      fieldMetadataUniversalIdentifier: ORDER_ORDERED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      direction: ViewSortDirection.DESC,
    },
  ],
});
