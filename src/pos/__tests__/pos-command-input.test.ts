import { describe, expect, it } from 'vitest';

import {
  parseCommandPayload,
  parsePosCommandEnvelope,
} from 'src/pos/pos-command-input';

const STAFF = '10000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';

const validEnvelope = {
  command: 'openShift',
  sessionToken: 'x'.repeat(43),
  payload: { idempotencyKey: KEY },
};

describe('parsePosCommandEnvelope', () => {
  it('accepts a well-formed envelope', () => {
    const parsed = parsePosCommandEnvelope(validEnvelope);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.command).toBe('openShift');
      expect(parsed.data.sessionToken).toHaveLength(43);
    }
  });

  it('rejects non-object bodies', () => {
    expect(parsePosCommandEnvelope('string').ok).toBe(false);
    expect(parsePosCommandEnvelope(null).ok).toBe(false);
  });

  it('rejects unknown commands', () => {
    const parsed = parsePosCommandEnvelope({
      ...validEnvelope,
      command: 'deleteEverything',
    });
    expect(parsed.ok).toBe(false);
  });

  it('rejects client-supplied actor identity and role', () => {
    expect(
      parsePosCommandEnvelope({
        ...validEnvelope,
        actor: { staffId: 'not-a-uuid', role: 'WAITER' },
      }).ok,
    ).toBe(false);
    expect(
      parsePosCommandEnvelope({
        ...validEnvelope,
        actor: { staffId: STAFF, role: 'OWNER' },
      }).ok,
    ).toBe(false);
    expect(
      parsePosCommandEnvelope({ ...validEnvelope, staffId: STAFF }).ok,
    ).toBe(false);
    expect(
      parsePosCommandEnvelope({ ...validEnvelope, role: 'ADMIN' }).ok,
    ).toBe(false);
  });
});

describe('parseCommandPayload', () => {
  it('validates openShift payload', () => {
    expect(
      parseCommandPayload('openShift', { idempotencyKey: KEY }).ok,
    ).toBe(true);
    expect(
      parseCommandPayload('openShift', {
        idempotencyKey: KEY,
      }).ok,
    ).toBe(true);
    expect(
      parseCommandPayload('openShift', {
        idempotencyKey: KEY,
        staffId: STAFF,
      }).ok,
    ).toBe(false);
  });

  it('validates POS login payload without accepting an actor', () => {
    expect(
      parseCommandPayload('authenticatePosStaff', { pin: '1234' }).ok,
    ).toBe(true);
    expect(
      parseCommandPayload('authenticatePosStaff', {
        pin: '1234',
        cardIdentifier: 'CARD-1',
      }).ok,
    ).toBe(false);
    expect(parseCommandPayload('refreshPosSession', {}).ok).toBe(true);
  });

  it('rejects invalid quantities', () => {
    expect(
      parseCommandPayload('addLine', {
        orderId: STAFF,
        guestId: STAFF,
        menuItemId: STAFF,
        quantity: 0,
        idempotencyKey: KEY,
      }).ok,
    ).toBe(false);
    expect(
      parseCommandPayload('addLine', {
        orderId: STAFF,
        guestId: STAFF,
        menuItemId: STAFF,
        quantity: 2.5,
        idempotencyKey: KEY,
      }).ok,
    ).toBe(false);
    expect(
      parseCommandPayload('addLine', {
        orderId: STAFF,
        guestId: STAFF,
        menuItemId: STAFF,
        quantity: 2,
        idempotencyKey: KEY,
      }).ok,
    ).toBe(true);
  });

  it('validates closeShift and changeLineQuantity payloads', () => {
    expect(
      parseCommandPayload('closeShift', { shiftId: STAFF }).ok,
    ).toBe(true);
    expect(
      parseCommandPayload('changeLineQuantity', { lineId: STAFF, quantity: 3 }).ok,
    ).toBe(true);
    expect(
      parseCommandPayload('changeLineQuantity', { lineId: STAFF }).ok,
    ).toBe(false);
  });

  it('rejects blank guest names', () => {
    expect(
      parseCommandPayload('addGuest', {
        orderId: STAFF,
        idempotencyKey: KEY,
        name: '   ',
      }).ok,
    ).toBe(false);
  });

  it('validates bounded void and transfer payloads', () => {
    expect(
      parseCommandPayload('voidOrderLines', {
        lineIds: [STAFF],
        preparedState: 'PREPARED',
        reason: 'mistake',
        idempotencyKey: KEY,
      }).ok,
    ).toBe(true);
    expect(
      parseCommandPayload('voidOrderLines', {
        lineIds: [STAFF, STAFF],
        preparedState: 'PREPARED',
        idempotencyKey: KEY,
      }).ok,
    ).toBe(false);
    expect(
      parseCommandPayload('transferOrderToTable', {
        orderId: STAFF,
        targetTableId: KEY,
        idempotencyKey: KEY,
      }).ok,
    ).toBe(true);
    expect(
      parseCommandPayload('transferOrderLinesToGuest', {
        lineIds: [STAFF],
        targetGuestId: KEY,
        idempotencyKey: KEY,
        role: 'ADMIN',
      }).ok,
    ).toBe(false);
  });

  it('validates physical printing configuration and reprint payloads', () => {
    expect(parseCommandPayload('upsertPrinterDevice', {
      label: 'Кухня', host: '192.168.1.50', port: 9100, isActive: true,
      isPrecheckPrinter: false, paperWidth: '80', encodingProfile: 'CP866',
      escPosCodePage: 17, cutSupport: true,
    }).ok).toBe(true);
    expect(parseCommandPayload('upsertPrinterDevice', {
      label: 'Кухня', host: '192.168.1. 50', port: 9100, isActive: true,
      isPrecheckPrinter: false, paperWidth: '80', encodingProfile: 'CP866',
      cutSupport: true,
    }).ok).toBe(false);
    expect(parseCommandPayload('upsertProductionStation', {
      label: 'Горячий цех', printerDeviceId: null, isActive: true,
    }).ok).toBe(true);
    expect(parseCommandPayload('setMenuItemProductionStation', {
      menuItemId: STAFF, productionStationId: null, idempotencyKey: KEY,
    }).ok).toBe(true);
    expect(parseCommandPayload('retryPrintJob', {
      printJobId: STAFF, idempotencyKey: KEY,
    }).ok).toBe(true);
  });
});
