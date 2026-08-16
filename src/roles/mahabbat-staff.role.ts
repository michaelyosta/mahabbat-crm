import {
  defineRole,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { MAHABBAT_STAFF_ROLE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER, LOYALTY_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_TYPE_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_RELATED_ORDER_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_SOURCE_REQUEST_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_REASON_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_ACTOR_SOURCE_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_SOURCE_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER } from 'src/objects/loyalty-ledger-entry.object';
import { LOYALTY_ADJUSTMENT_REQUEST_UNIVERSAL_IDENTIFIER, LOYALTY_ADJUSTMENT_REQUEST_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_ADJUSTMENT_REQUEST_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_ADJUSTMENT_REQUEST_REASON_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_ADJUSTMENT_REQUEST_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_ADJUSTMENT_REQUEST_STATUS_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_ADJUSTMENT_REQUEST_PROCESSED_AT_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_ADJUSTMENT_REQUEST_ERROR_FIELD_UNIVERSAL_IDENTIFIER, LOYALTY_ADJUSTMENT_REQUEST_LEDGER_ENTRIES_FIELD_UNIVERSAL_IDENTIFIER } from 'src/objects/loyalty-adjustment-request.object';
import { ORDER_ITEM_UNIVERSAL_IDENTIFIER } from 'src/objects/order-item.object';
import {
  ORDER_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER,
  ORDER_UNIVERSAL_IDENTIFIER,
} from 'src/objects/order.object';
import {
  RESERVATION_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
  RESERVATION_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER,
  RESERVATION_UNIVERSAL_IDENTIFIER,
} from 'src/objects/reservation.object';
import { EXTERNAL_IDENTITY_KEY_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER } from 'src/fields/person/external-identity-key-on-person.field';
import { EXTERNAL_ID_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER } from 'src/fields/person/external-id-on-person.field';
import { EXTERNAL_PROVIDER_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER } from 'src/fields/person/external-provider-on-person.field';

export default defineRole({
  universalIdentifier: MAHABBAT_STAFF_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'Mahabbat Staff',
  description:
    'Mahabbat staff: full CRUD on customers, orders, order items and reservations; loyalty ledger is strictly read-only',
  canReadAllObjectRecords: false,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canBeAssignedToUsers: true,
  canBeAssignedToAgents: false,
  canBeAssignedToApiKeys: false,
  objectPermissions: [
    {
      objectUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: true,
      canDestroyObjectRecords: true,
    },
    {
      objectUniversalIdentifier: ORDER_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: true,
      canDestroyObjectRecords: true,
    },
    {
      objectUniversalIdentifier: ORDER_ITEM_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: true,
      canDestroyObjectRecords: true,
    },
    {
      objectUniversalIdentifier: RESERVATION_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: true,
      canSoftDeleteObjectRecords: true,
      canDestroyObjectRecords: true,
    },
    {
      objectUniversalIdentifier: LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: false,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
    {
      objectUniversalIdentifier: LOYALTY_ADJUSTMENT_REQUEST_UNIVERSAL_IDENTIFIER,
      canReadObjectRecords: true,
      canUpdateObjectRecords: false,
      canSoftDeleteObjectRecords: false,
      canDestroyObjectRecords: false,
    },
  ],
  fieldPermissions: [
    ...[
      EXTERNAL_ID_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      EXTERNAL_PROVIDER_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      EXTERNAL_IDENTITY_KEY_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
    ].map((fieldUniversalIdentifier) => ({
      objectUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      fieldUniversalIdentifier,
      canReadFieldValue: true,
      canUpdateFieldValue: false,
    })),
    ...[
      ORDER_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
      ORDER_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER,
    ].map((fieldUniversalIdentifier) => ({
      objectUniversalIdentifier: ORDER_UNIVERSAL_IDENTIFIER,
      fieldUniversalIdentifier,
      canReadFieldValue: true,
      canUpdateFieldValue: false,
    })),
    ...[
      RESERVATION_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
      RESERVATION_PROVIDER_FIELD_UNIVERSAL_IDENTIFIER,
    ].map((fieldUniversalIdentifier) => ({
      objectUniversalIdentifier: RESERVATION_UNIVERSAL_IDENTIFIER,
      fieldUniversalIdentifier,
      canReadFieldValue: true,
      canUpdateFieldValue: false,
    })),
    ...[
      LOYALTY_ADJUSTMENT_REQUEST_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_ADJUSTMENT_REQUEST_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_ADJUSTMENT_REQUEST_REASON_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_ADJUSTMENT_REQUEST_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_ADJUSTMENT_REQUEST_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_ADJUSTMENT_REQUEST_PROCESSED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_ADJUSTMENT_REQUEST_ERROR_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_ADJUSTMENT_REQUEST_LEDGER_ENTRIES_FIELD_UNIVERSAL_IDENTIFIER,
    ].map((fieldUniversalIdentifier) => ({
      objectUniversalIdentifier: LOYALTY_ADJUSTMENT_REQUEST_UNIVERSAL_IDENTIFIER,
      fieldUniversalIdentifier,
      canReadFieldValue: true,
      canUpdateFieldValue: false,
    })),
    ...[
      LOYALTY_CUSTOMER_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_OCCURRED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_RELATED_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_SOURCE_REQUEST_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_REASON_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_ACTOR_SOURCE_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_SOURCE_FIELD_UNIVERSAL_IDENTIFIER,
      LOYALTY_IDEMPOTENCY_KEY_FIELD_UNIVERSAL_IDENTIFIER,
    ].map((fieldUniversalIdentifier) => ({
      objectUniversalIdentifier: LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
      fieldUniversalIdentifier,
      canReadFieldValue: true,
      canUpdateFieldValue: false,
    })),
  ],
});
