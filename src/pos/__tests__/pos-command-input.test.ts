import { describe, expect, it } from 'vitest';

import {
  parseCommandPayload,
  parsePosCommandEnvelope,
} from 'src/pos/pos-command-input';

const STAFF = '10000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';

const validEnvelope = {
  command: 'openShift',
  actor: { staffId: STAFF, role: 'WAITER' },
  payload: { staffId: STAFF, idempotencyKey: KEY },
};

describe('parsePosCommandEnvelope', () => {
  it('accepts a well-formed envelope', () => {
    const parsed = parsePosCommandEnvelope(validEnvelope);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.command).toBe('openShift');
      expect(parsed.data.actor.role).toBe('WAITER');
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

  it('rejects malformed actors', () => {
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
  });
});

describe('parseCommandPayload', () => {
  it('validates openShift payload', () => {
    expect(
      parseCommandPayload('openShift', { staffId: STAFF, idempotencyKey: KEY }).ok,
    ).toBe(true);
    expect(
      parseCommandPayload('openShift', {
        staffId: 'bad',
        idempotencyKey: KEY,
      }).ok,
    ).toBe(false);
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
});