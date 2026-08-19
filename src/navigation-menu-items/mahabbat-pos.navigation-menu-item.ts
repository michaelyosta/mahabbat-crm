import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import {
  MAHABBAT_POS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  MAHABBAT_POS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: MAHABBAT_POS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Касса',
  icon: 'IconToolsKitchen2',
  position: -3,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: MAHABBAT_POS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
