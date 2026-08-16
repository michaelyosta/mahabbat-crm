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

const readOnlyObjectPermissions = [
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  ORDER_UNIVERSAL_IDENTIFIER,
  ORDER_ITEM_UNIVERSAL_IDENTIFIER,
  RESERVATION_UNIVERSAL_IDENTIFIER,
  LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
  SALES_SNAPSHOT_LINE_UNIVERSAL_IDENTIFIER,
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
    'Mahabbat read-only demo user: view customers, orders, reservations, loyalty history and dashboard aggregates without writes, settings or tools',
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
