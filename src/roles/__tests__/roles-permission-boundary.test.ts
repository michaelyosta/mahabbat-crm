import { describe, expect, it } from 'vitest';
import { STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import mahabbatDemoUserRole from 'src/roles/mahabbat-demo-user.role';
import mahabbatStaffRole from 'src/roles/mahabbat-staff.role';
import { LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER } from 'src/objects/loyalty-ledger-entry.object';
import { ORDER_ITEM_UNIVERSAL_IDENTIFIER } from 'src/objects/order-item.object';
import { ORDER_UNIVERSAL_IDENTIFIER } from 'src/objects/order.object';
import { RESERVATION_UNIVERSAL_IDENTIFIER } from 'src/objects/reservation.object';

const staffConfig = mahabbatStaffRole.config;
const demoUserConfig = mahabbatDemoUserRole.config;

const OPERATIONAL_OBJECT_IDS = [
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  ORDER_UNIVERSAL_IDENTIFIER,
  ORDER_ITEM_UNIVERSAL_IDENTIFIER,
  RESERVATION_UNIVERSAL_IDENTIFIER,
];

describe('Mahabbat Staff role boundary', () => {
  it('validates without manifest errors', () => {
    expect(mahabbatStaffRole.success).toBe(true);
    expect(mahabbatStaffRole.errors).toEqual([]);
  });

  it('keeps operational records editable for staff', () => {
    for (const objectUniversalIdentifier of OPERATIONAL_OBJECT_IDS) {
      const permission = staffConfig.objectPermissions?.find(
        (entry) => entry.objectUniversalIdentifier === objectUniversalIdentifier,
      );
      expect(permission, objectUniversalIdentifier).toBeTruthy();
      expect(permission?.canReadObjectRecords).toBe(true);
      expect(permission?.canUpdateObjectRecords).toBe(true);
    }
  });

  it('does not let staff delete or destroy operational records', () => {
    for (const objectUniversalIdentifier of OPERATIONAL_OBJECT_IDS) {
      const permission = staffConfig.objectPermissions?.find(
        (entry) => entry.objectUniversalIdentifier === objectUniversalIdentifier,
      );
      expect(
        permission?.canSoftDeleteObjectRecords,
        `${objectUniversalIdentifier} soft delete`,
      ).toBe(false);
      expect(
        permission?.canDestroyObjectRecords,
        `${objectUniversalIdentifier} destroy`,
      ).toBe(false);
    }
  });

  it('keeps the loyalty ledger and adjustment requests read-only for staff', () => {
    for (const objectUniversalIdentifier of [
      LOYALTY_LEDGER_ENTRY_UNIVERSAL_IDENTIFIER,
    ]) {
      const permission = staffConfig.objectPermissions?.find(
        (entry) => entry.objectUniversalIdentifier === objectUniversalIdentifier,
      );
      expect(permission).toBeTruthy();
      expect(permission?.canReadObjectRecords).toBe(true);
      expect(permission?.canUpdateObjectRecords).toBe(false);
      expect(permission?.canSoftDeleteObjectRecords).toBe(false);
      expect(permission?.canDestroyObjectRecords).toBe(false);
    }
  });

  it('denies any global write that could bypass per-object rules', () => {
    expect(staffConfig.canReadAllObjectRecords).toBe(false);
    expect(staffConfig.canUpdateAllObjectRecords).toBe(false);
    expect(staffConfig.canSoftDeleteAllObjectRecords).toBe(false);
    expect(staffConfig.canDestroyAllObjectRecords).toBe(false);
  });
});

describe('Mahabbat Demo User role boundary', () => {
  it('validates without manifest errors', () => {
    expect(mahabbatDemoUserRole.success).toBe(true);
    expect(mahabbatDemoUserRole.errors).toEqual([]);
  });

  it('keeps the demo user read-only on every configured object', () => {
    expect(demoUserConfig.objectPermissions?.length).toBeGreaterThan(0);
    for (const permission of demoUserConfig.objectPermissions ?? []) {
      expect(permission.canReadObjectRecords).toBe(true);
      expect(permission.canUpdateObjectRecords).toBe(false);
      expect(permission.canSoftDeleteObjectRecords).toBe(false);
      expect(permission.canDestroyObjectRecords).toBe(false);
    }
  });
});