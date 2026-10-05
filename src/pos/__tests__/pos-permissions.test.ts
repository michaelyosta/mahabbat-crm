import { describe, expect, it } from 'vitest';

import {
  commandAllowedForRole,
  orderCanBeEditedBy,
  shiftCanBeClosedBy,
} from 'src/pos/pos-permissions';

const waiter = { staffId: '10000000-0000-4000-8000-000000000001', role: 'WAITER' as const };
const admin = { staffId: '10000000-0000-4000-8000-000000000002', role: 'ADMIN' as const };

describe('pos permissions', () => {
  it('allows slice-1 commands for both WAITER and ADMIN', () => {
    for (const command of [
      'openShift',
      'closeShift',
      'openOrder',
      'addGuest',
      'addLine',
      'changeLineQuantity',
      'removeUnsentLine',
      'refreshPosSession',
    ] as const) {
      expect(commandAllowedForRole(command, 'WAITER')).toBe(true);
      expect(commandAllowedForRole(command, 'ADMIN')).toBe(true);
    }
  });

  it('lets the owner and admins edit an order', () => {
    expect(orderCanBeEditedBy('10000000-0000-4000-8000-000000000001', waiter)).toBe(true);
    expect(orderCanBeEditedBy('10000000-0000-4000-8000-000000000099', waiter)).toBe(false);
    expect(orderCanBeEditedBy('10000000-0000-4000-8000-000000000099', admin)).toBe(true);
  });

  it('lets only the shift owner or admins close a shift', () => {
    expect(shiftCanBeClosedBy('10000000-0000-4000-8000-000000000001', waiter)).toBe(true);
    expect(shiftCanBeClosedBy('10000000-0000-4000-8000-000000000099', waiter)).toBe(false);
    expect(shiftCanBeClosedBy('10000000-0000-4000-8000-000000000099', admin)).toBe(true);
  });

  it('keeps void and transfer commands ADMIN-only', () => {
    for (const command of [
      'voidOrderLines',
      'transferOrderToTable',
      'transferOrderToWaiter',
      'transferOrderLinesToGuest',
    ] as const) {
      expect(commandAllowedForRole(command, 'WAITER')).toBe(false);
      expect(commandAllowedForRole(command, 'ADMIN')).toBe(true);
    }
  });

  it('keeps stop-list commands ADMIN-only', () => {
    for (const command of ['addStopListEntry', 'clearStopListEntry'] as const) {
      expect(commandAllowedForRole(command, 'WAITER')).toBe(false);
      expect(commandAllowedForRole(command, 'ADMIN')).toBe(true);
    }
  });

  it('keeps printer configuration and explicit reprints ADMIN-only', () => {
    for (const command of [
      'upsertPrinterDevice',
      'upsertProductionStation',
      'setMenuItemProductionStation',
      'retryPrintJob',
    ] as const) {
      expect(commandAllowedForRole(command, 'WAITER')).toBe(false);
      expect(commandAllowedForRole(command, 'ADMIN')).toBe(true);
    }
  });
});
