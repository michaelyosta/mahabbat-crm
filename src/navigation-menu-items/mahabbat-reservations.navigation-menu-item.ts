import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import { RESERVATIONS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { RESERVATION_UNIVERSAL_IDENTIFIER } from 'src/objects/reservation.object';

export default defineNavigationMenuItem({
  universalIdentifier: RESERVATIONS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Бронирования',
  icon: 'IconCalendarEvent',
  position: -2,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: RESERVATION_UNIVERSAL_IDENTIFIER,
});
