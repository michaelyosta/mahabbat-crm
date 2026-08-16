import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  ORDERS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { ORDER_UNIVERSAL_IDENTIFIER } from 'src/objects/order.object';

export default defineNavigationMenuItem({
  universalIdentifier: ORDERS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Заказы',
  icon: 'IconShoppingCart',
  position: -3,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: ORDER_UNIVERSAL_IDENTIFIER,
});
