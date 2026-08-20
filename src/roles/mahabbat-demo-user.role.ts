import {
  defineRole,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { MAHABBAT_DEMO_USER_ROLE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER } from 'src/objects/loyalty-ledger-entry.object';
import { ORDER_ITEM_UNIVERSAL_IDENTIFIER } from 'src/objects/order-item.object';
import { ORDER_UNIVERSAL_IDENTIFIER } from 'src/objects/order.object';
import { RESERVATION_UNIVERSAL_IDENTIFIER } from 'src/objects/reservation.object';
import { SALES_SNAPSHOT_LINE_UNIVERSAL_IDENTIFIER } from 'src/objects/sales-snapshot-line.object';
import { POS_MENU_ITEM_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-menu-item.object';
import { POS_ORDER_GUEST_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-order-guest.object';
import { POS_ORDER_LINE_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-order-line.object';
import { POS_ORDER_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-order.object';
import { POS_SHIFT_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-shift.object';
import { POS_STOP_LIST_ENTRY_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-stop-list-entry.object';
import { POS_TABLE_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-table.object';
import { POS_ZONE_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-zone.object';
import { POS_PRECHECK_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-precheck.object';
import { POS_PAYMENT_METHOD_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-payment-method.object';
import { POS_PAYMENT_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-payment.object';
import { POS_RESERVATION_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-reservation.object';
import { POS_PREPAYMENT_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-prepayment.object';
import { POS_OPERATIONAL_EVENT_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-operational-event.object';
import { INVENTORY_STOCK_LOCATION_UNIVERSAL_IDENTIFIER } from 'src/objects/inventory-stock-location.object';
import { INVENTORY_STOCK_ITEM_UNIVERSAL_IDENTIFIER } from 'src/objects/inventory-stock-item.object';
import { INVENTORY_STOCK_BALANCE_UNIVERSAL_IDENTIFIER } from 'src/objects/inventory-stock-balance.object';
import { INVENTORY_STOCK_MOVEMENT_UNIVERSAL_IDENTIFIER } from 'src/objects/inventory-stock-movement.object';
import { INVENTORY_RECIPE_UNIVERSAL_IDENTIFIER } from 'src/objects/inventory-recipe.object';
import { INVENTORY_RECIPE_VERSION_UNIVERSAL_IDENTIFIER } from 'src/objects/inventory-recipe-version.object';
import { INVENTORY_RECIPE_LINE_UNIVERSAL_IDENTIFIER } from 'src/objects/inventory-recipe-line.object';
import { INVENTORY_CONSUMPTION_REQUEST_UNIVERSAL_IDENTIFIER } from 'src/objects/inventory-consumption-request.object';
import { INVENTORY_CONSUMPTION_ISSUE_UNIVERSAL_IDENTIFIER } from 'src/objects/inventory-consumption-issue.object';
import { INVENTORY_COUNT_UNIVERSAL_IDENTIFIER } from 'src/objects/inventory-count.object';
import { INVENTORY_COUNT_LINE_UNIVERSAL_IDENTIFIER } from 'src/objects/inventory-count-line.object';
import { POS_KITCHEN_TICKET_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-kitchen-ticket.object';
import { POS_KITCHEN_TICKET_LINE_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-kitchen-ticket-line.object';

const readOnlyObjectPermissions = [
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  ORDER_UNIVERSAL_IDENTIFIER,
  ORDER_ITEM_UNIVERSAL_IDENTIFIER,
  RESERVATION_UNIVERSAL_IDENTIFIER,
  LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
  SALES_SNAPSHOT_LINE_UNIVERSAL_IDENTIFIER,
  POS_SHIFT_UNIVERSAL_IDENTIFIER,
  POS_ZONE_UNIVERSAL_IDENTIFIER,
  POS_TABLE_UNIVERSAL_IDENTIFIER,
  POS_ORDER_UNIVERSAL_IDENTIFIER,
  POS_ORDER_GUEST_UNIVERSAL_IDENTIFIER,
  POS_ORDER_LINE_UNIVERSAL_IDENTIFIER,
  POS_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  POS_STOP_LIST_ENTRY_UNIVERSAL_IDENTIFIER,
  POS_PRECHECK_UNIVERSAL_IDENTIFIER,
  POS_PAYMENT_METHOD_UNIVERSAL_IDENTIFIER,
  POS_PAYMENT_UNIVERSAL_IDENTIFIER,
  POS_RESERVATION_UNIVERSAL_IDENTIFIER,
  POS_PREPAYMENT_UNIVERSAL_IDENTIFIER,
  POS_KITCHEN_TICKET_UNIVERSAL_IDENTIFIER,
  POS_KITCHEN_TICKET_LINE_UNIVERSAL_IDENTIFIER,
  POS_OPERATIONAL_EVENT_UNIVERSAL_IDENTIFIER,
  INVENTORY_STOCK_LOCATION_UNIVERSAL_IDENTIFIER,
  INVENTORY_STOCK_ITEM_UNIVERSAL_IDENTIFIER,
  INVENTORY_STOCK_BALANCE_UNIVERSAL_IDENTIFIER,
  INVENTORY_STOCK_MOVEMENT_UNIVERSAL_IDENTIFIER,
  INVENTORY_RECIPE_UNIVERSAL_IDENTIFIER,
  INVENTORY_RECIPE_VERSION_UNIVERSAL_IDENTIFIER,
  INVENTORY_RECIPE_LINE_UNIVERSAL_IDENTIFIER,
  INVENTORY_CONSUMPTION_REQUEST_UNIVERSAL_IDENTIFIER,
  INVENTORY_CONSUMPTION_ISSUE_UNIVERSAL_IDENTIFIER,
  INVENTORY_COUNT_UNIVERSAL_IDENTIFIER,
  INVENTORY_COUNT_LINE_UNIVERSAL_IDENTIFIER,
].map((objectUniversalIdentifier) => ({
  objectUniversalIdentifier,
  canReadObjectRecords: true,
  canUpdateObjectRecords: false,
  canSoftDeleteObjectRecords: false,
  canDestroyObjectRecords: false,
}));

export default defineRole({
  universalIdentifier: MAHABBAT_DEMO_USER_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Mahabbat Demo User',
  description:
    'Mahabbat read-only demo user: view CRM and POS operational screens without writes, settings, tools or access to POS authentication records',
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canAccessAllTools: false,
  canBeAssignedToUsers: true,
  canBeAssignedToAgents: false,
  canBeAssignedToApiKeys: false,
  objectPermissions: readOnlyObjectPermissions,
});
