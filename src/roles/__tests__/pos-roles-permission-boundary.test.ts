import { describe, expect, it } from 'vitest';

import defaultRole from 'src/default-role';
import mahabbatPosWaiterRole from 'src/roles/mahabbat-pos-waiter.role';
import { POS_MENU_ITEM_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-menu-item.object';
import { POS_ORDER_GUEST_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-order-guest.object';
import { POS_ORDER_LINE_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-order-line.object';
import { POS_ORDER_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-order.object';
import { POS_SHIFT_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-shift.object';
import { POS_STOP_LIST_ENTRY_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-stop-list-entry.object';
import { POS_TABLE_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-table.object';
import { POS_ZONE_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-zone.object';
import { POS_STAFF_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-staff.object';
import { POS_SESSION_UNIVERSAL_IDENTIFIER } from 'src/objects/pos-session.object';

const POS_OBJECT_IDS = [
  POS_SHIFT_UNIVERSAL_IDENTIFIER,
  POS_ZONE_UNIVERSAL_IDENTIFIER,
  POS_TABLE_UNIVERSAL_IDENTIFIER,
  POS_ORDER_UNIVERSAL_IDENTIFIER,
  POS_ORDER_GUEST_UNIVERSAL_IDENTIFIER,
  POS_ORDER_LINE_UNIVERSAL_IDENTIFIER,
  POS_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  POS_STOP_LIST_ENTRY_UNIVERSAL_IDENTIFIER,
];

describe('Mahabbat POS Waiter role boundary', () => {
  it('validates without manifest errors', () => {
    expect(mahabbatPosWaiterRole.success).toBe(true);
    expect(mahabbatPosWaiterRole.errors).toEqual([]);
  });

  it('keeps POS objects read-only for the waiter', () => {
    expect(mahabbatPosWaiterRole.config.objectPermissions?.length).toBe(
      POS_OBJECT_IDS.length,
    );

    for (const objectUniversalIdentifier of POS_OBJECT_IDS) {
      const permission =
        mahabbatPosWaiterRole.config.objectPermissions?.find(
          (entry) => entry.objectUniversalIdentifier === objectUniversalIdentifier,
        );

      expect(permission, objectUniversalIdentifier).toBeTruthy();
      expect(permission?.canReadObjectRecords).toBe(true);
      expect(permission?.canUpdateObjectRecords).toBe(false);
      expect(permission?.canSoftDeleteObjectRecords).toBe(false);
      expect(permission?.canDestroyObjectRecords).toBe(false);
    }
  });

  it('denies global write access that could bypass per-object rules', () => {
    expect(mahabbatPosWaiterRole.config.canReadAllObjectRecords).toBe(false);
    expect(mahabbatPosWaiterRole.config.canUpdateAllObjectRecords).toBe(false);
  });
});

describe('default function role POS write boundary', () => {
  it('gives the function role write access to POS objects for the resolver', () => {
    for (const objectUniversalIdentifier of [
      ...POS_OBJECT_IDS,
      POS_STAFF_UNIVERSAL_IDENTIFIER,
      POS_SESSION_UNIVERSAL_IDENTIFIER,
    ]) {
      const permission = defaultRole.config.objectPermissions?.find(
        (entry) => entry.objectUniversalIdentifier === objectUniversalIdentifier,
      );

      expect(permission, objectUniversalIdentifier).toBeTruthy();
      expect(permission?.canReadObjectRecords).toBe(true);
      expect(permission?.canUpdateObjectRecords).toBe(true);
      expect(permission?.canSoftDeleteObjectRecords).toBe(false);
      expect(permission?.canDestroyObjectRecords).toBe(false);
    }
  });

  it('keeps global write access disabled', () => {
    expect(defaultRole.config.canUpdateAllObjectRecords).toBe(false);
  });
});
