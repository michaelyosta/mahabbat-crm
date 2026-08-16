import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  LOYALTY_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER } from 'src/objects/loyalty-ledger-entry.object';

export default defineNavigationMenuItem({
  universalIdentifier: LOYALTY_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Лояльность',
  icon: 'IconCards',
  position: -1,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
});
