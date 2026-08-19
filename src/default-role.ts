import {
  defineApplicationRole,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER } from 'src/objects/loyalty-ledger-entry.object';
import { LOYALTY_ADJUSTMENT_REQUEST_UNIVERSAL_IDENTIFIER } from 'src/objects/loyalty-adjustment-request.object';
import { ORDER_ITEM_UNIVERSAL_IDENTIFIER } from 'src/objects/order-item.object';
import { ORDER_UNIVERSAL_IDENTIFIER } from 'src/objects/order.object';
import { RESERVATION_UNIVERSAL_IDENTIFIER } from 'src/objects/reservation.object';
import { POS_MENU_ITEM_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-menu-item.object';
import { POS_ORDER_GUEST_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-order-guest.object';
import { POS_ORDER_LINE_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-order-line.object';
import { POS_ORDER_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-order.object';
import { POS_SHIFT_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-shift.object';
import { POS_STOP_LIST_ENTRY_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-stop-list-entry.object';
import { POS_KITCHEN_TICKET_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-kitchen-ticket.object';
import { POS_KITCHEN_TICKET_LINE_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-kitchen-ticket-line.object';
import { POS_PRECHECK_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-precheck.object';
import { POS_PAYMENT_METHOD_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-payment-method.object';
import { POS_PAYMENT_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-payment.object';
import { POS_STAFF_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-staff.object';
import { POS_SESSION_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-session.object';
import { POS_TABLE_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-table.object';
import { POS_ZONE_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-zone.object';
import { POS_RESERVATION_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-reservation.object';
import { POS_PREPAYMENT_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-prepayment.object';

export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: `${APP_DISPLAY_NAME} default function role`,
  description: `${APP_DISPLAY_NAME} app function role: read access to foundation objects plus controlled loyalty ledger creation via app logic`,
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canBeAssignedToUsers: false,
  canBeAssignedToAgents: false,
  canBeAssignedToApiKeys: false,
  objectPermissions: [
    {
      objectUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      canReadObjectRecords: true,
      canUpdateObjectRecords: false,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
      canReadObjectRecords: true,
      canUpdateObjectRecords: false,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: ORDER_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: false,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: ORDER_ITEM_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: false,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: RESERVATION_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: false,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: LOYALTY_ADJUSTMENT_REQUEST_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    ...[
      POS_SHIFT_UNIVERSAL_IDENTIFIER,
      POS_ZONE_UNIVERSAL_IDENTIFIER,
      POS_TABLE_UNIVERSAL_IDENTIFIER,
      POS_ORDER_UNIVERSAL_IDENTIFIER,
      POS_ORDER_GUEST_UNIVERSAL_IDENTIFIER,
      POS_ORDER_LINE_UNIVERSAL_IDENTIFIER,
      POS_MENU_ITEM_UNIVERSAL_IDENTIFIER,
      POS_STOP_LIST_ENTRY_UNIVERSAL_IDENTIFIER,
      POS_KITCHEN_TICKET_UNIVERSAL_IDENTIFIER,
      POS_KITCHEN_TICKET_LINE_UNIVERSAL_IDENTIFIER,
      POS_PRECHECK_UNIVERSAL_IDENTIFIER,
      POS_PAYMENT_METHOD_UNIVERSAL_IDENTIFIER,
      POS_PAYMENT_UNIVERSAL_IDENTIFIER,
      POS_STAFF_UNIVERSAL_IDENTIFIER,
      POS_SESSION_UNIVERSAL_IDENTIFIER,
      POS_RESERVATION_UNIVERSAL_IDENTIFIER,
      POS_PREPAYMENT_UNIVERSAL_IDENTIFIER,
    ].map((objectUniversalIdentifier) => ({
      objectUniversalIdentifier,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    })),
  ],
});
