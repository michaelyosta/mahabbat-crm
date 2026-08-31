import { defineRole } from 'twenty-sdk/define';

import { MAHABBAT_POS_WAITER_ROLE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
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
import { POS_KITCHEN_TICKET_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-kitchen-ticket.object';
import { POS_KITCHEN_TICKET_LINE_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-kitchen-ticket-line.object';
import { POS_PRINTER_DEVICE_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-printer-device.object';
import { POS_PRODUCTION_STATION_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-production-station.object';
import { POS_PRINT_JOB_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-print-job.object';

export default defineRole({
  universalIdentifier: MAHABBAT_POS_WAITER_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Mahabbat POS Waiter',
  description:
    'POS официант: read-only доступ к операционным объектам POS; все записи выполняются только через серверный command boundary',
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canBeAssignedToUsers: true,
  canBeAssignedToAgents: false,
  canBeAssignedToApiKeys: false,
  objectPermissions: [
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
    POS_PRINTER_DEVICE_UNIVERSAL_IDENTIFIER,
    POS_PRODUCTION_STATION_UNIVERSAL_IDENTIFIER,
    POS_PRINT_JOB_UNIVERSAL_IDENTIFIER,
  ].map((objectUniversalIdentifier) => ({
    objectUniversalIdentifier,
    canReadObjectRecords: true,
    canUpdateObjectRecords: false,
    canSoftDeleteObjectRecords: false,
    canDestroyObjectRecords: false,
  })),
});
