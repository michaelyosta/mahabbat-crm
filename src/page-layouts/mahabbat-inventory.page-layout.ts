import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';
import {
  MAHABBAT_INVENTORY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MAHABBAT_INVENTORY_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  MAHABBAT_INVENTORY_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  MAHABBAT_INVENTORY_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default definePageLayout({
  universalIdentifier: MAHABBAT_INVENTORY_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Mahabbat Inventory',
  type: 'STANDALONE_PAGE',
  tabs: [{
    universalIdentifier: MAHABBAT_INVENTORY_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
    title: 'Склад',
    position: 0,
    icon: 'IconBuildingWarehouse',
    layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    widgets: [{
      universalIdentifier: MAHABBAT_INVENTORY_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
      title: 'Склад — остатки и движения',
      type: 'FRONT_COMPONENT',
      configuration: { configurationType: 'FRONT_COMPONENT', frontComponentUniversalIdentifier: MAHABBAT_INVENTORY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER },
    }],
  }],
});
