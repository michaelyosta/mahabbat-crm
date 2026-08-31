import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  MAHABBAT_PRINTING_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MAHABBAT_PRINTING_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  MAHABBAT_PRINTING_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  MAHABBAT_PRINTING_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default definePageLayout({
  universalIdentifier: MAHABBAT_PRINTING_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Mahabbat Печать',
  type: 'STANDALONE_PAGE',
  tabs: [{
    universalIdentifier: MAHABBAT_PRINTING_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
    title: 'Печать',
    position: 0,
    icon: 'IconPrinter',
    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    widgets: [{
      universalIdentifier: MAHABBAT_PRINTING_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
      title: 'Принтеры и задания',
      type: 'FRONT_COMPONENT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier: MAHABBAT_PRINTING_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
      },
    }],
  }],
});
