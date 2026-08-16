import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import { MAHABBAT_DASHBOARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER } from 'src/page-layouts/mahabbat-dashboard.page-layout';

export default defineNavigationMenuItem({
  universalIdentifier: 'f8a7d6c5-b4e3-42f1-9087-6a5b4c3d2e18',
  name: 'Главная',
  icon: 'IconChartBar',
  position: -4,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier:
    MAHABBAT_DASHBOARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
