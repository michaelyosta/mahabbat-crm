import {
  definePageLayoutTab,
  PageLayoutTabLayoutMode,
  STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CUSTOMER_360_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  CUSTOMER_360_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  CUSTOMER_360_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default definePageLayoutTab({
  universalIdentifier: CUSTOMER_360_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  pageLayoutUniversalIdentifier:
    STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.personRecordPage
      .universalIdentifier,
  title: 'Клиент 360',
  position: 1000,
  icon: 'IconUserStar',
  layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
  widgets: [
    {
      universalIdentifier: CUSTOMER_360_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
      title: 'История клиента',
      type: 'FRONT_COMPONENT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier:
          CUSTOMER_360_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
      },
    },
  ],
});
