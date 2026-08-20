import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';
import {
  MAHABBAT_INVENTORY_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  MAHABBAT_INVENTORY_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: MAHABBAT_INVENTORY_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Склад',
  icon: 'IconBuildingWarehouse',
  position: -2,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: MAHABBAT_INVENTORY_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
