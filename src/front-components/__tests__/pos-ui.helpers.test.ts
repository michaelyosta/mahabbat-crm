import { describe, expect, it } from 'vitest';

import {
  commandError,
  formatMicrosForInput,
  formatNegativeTimer,
  isOverdueReservation,
  parseMoneyInputToMicros,
  tableVisualState,
} from 'src/front-components/pos-ui.helpers';

describe('POS UI presentation helpers', () => {
  it('parses money input without binary floating-point arithmetic', () => {
    expect(parseMoneyInputToMicros('12 345,67')).toBe(12_345_670_000);
    expect(parseMoneyInputToMicros('0.000001')).toBe(1);
    expect(parseMoneyInputToMicros('0')).toBeNull();
    expect(parseMoneyInputToMicros('1.0000001')).toBeNull();
    expect(parseMoneyInputToMicros('not-money')).toBeNull();
  });

  it('round-trips micros into the payment input format', () => {
    expect(formatMicrosForInput(12_345_670_000)).toBe('12345.67');
    expect(formatMicrosForInput(1)).toBe('0.000001');
    expect(formatMicrosForInput(10_000_000)).toBe('10');
  });

  it('derives reservation overdue state and negative timer', () => {
    const now = Date.parse('2026-08-20T10:30:00.000Z');
    const reservation = {
      id: 'reservation',
      scheduledAt: '2026-08-20T10:05:00.000Z',
      status: 'ACTIVE',
    };
    expect(isOverdueReservation(reservation, now)).toBe(true);
    expect(formatNegativeTimer(reservation.scheduledAt, now)).toBe('-00:25');
  });

  it('uses operational precedence for table states', () => {
    const order = {
      id: 'order',
      ownerStaffId: 'waiter-a',
      status: 'IN_PROGRESS',
      total: { amountMicros: 10_000_000 },
      paidTotal: { amountMicros: 0 },
      prepaidTotal: { amountMicros: 0 },
    };
    expect(
      tableVisualState({ order, currentStaffId: 'waiter-a' }),
    ).toBe('my-order');
    expect(
      tableVisualState({ order, currentStaffId: 'waiter-b' }),
    ).toBe('other-order');
    expect(
      tableVisualState({
        order: { ...order, status: 'PRECHECK_PRINTED' },
        currentStaffId: 'waiter-a',
      }),
    ).toBe('precheck');
    expect(
      tableVisualState({
        order: {
          ...order,
          paidTotal: { amountMicros: 4_000_000 },
        },
        currentStaffId: 'waiter-a',
      }),
    ).toBe('payment');
    expect(
      tableVisualState({
        order: {
          ...order,
          status: 'PRECHECK_PRINTED',
          paidTotal: { amountMicros: 4_000_000 },
        },
        currentStaffId: 'waiter-a',
      }),
    ).toBe('payment');
  });

  it('maps technical command errors to operational Russian copy', () => {
    expect(commandError({ body: { code: 'STOP_LISTED' } })).toBe(
      'Блюдо находится в стоп-листе',
    );
    expect(commandError({ body: { code: 'ORDER_NOT_EDITABLE' } })).toBe(
      'Заказ заблокирован пречеком или уже закрыт',
    );
    expect(commandError({ body: { code: 'COMMAND_FORBIDDEN' } })).toBe(
      'Действие доступно только администратору',
    );
  });
});
