import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';
import {
  MAHABBAT_POS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MAHABBAT_POS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  MAHABBAT_POS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  MAHABBAT_POS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default definePageLayout({
  universalIdentifier: MAHABBAT_POS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Mahabbat POS',
  type: 'STANDALONE_PAGE',
  tabs: [{
    universalIdentifier: MAHABBAT_POS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
    title: 'Касса',
    position: 0,
    icon: 'IconToolsKitchen2',
    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    widgets: [{
      universalIdentifier: MAHABBAT_POS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
      title: 'Операционная касса',
      type: 'FRONT_COMPONENT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier: MAHABBAT_POS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
      },
    }],
  }],
});
