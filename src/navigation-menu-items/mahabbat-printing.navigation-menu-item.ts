import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  MAHABBAT_PRINTING_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  MAHABBAT_PRINTING_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: MAHABBAT_PRINTING_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Печать',
  icon: 'IconPrinter',
  position: -2,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: MAHABBAT_PRINTING_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
