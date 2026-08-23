import { describe, expect, it } from 'vitest';

import {
  commandError,
  formatMicrosForInput,
  formatNegativeTimer,
  isReservationDraftReady,
  isSyntheticPosRecord,
  isSyntheticPosStaffId,
  isSyntheticPosValue,
  isOverdueReservation,
  parseMoneyInputToMicros,
  posLineQuantityState,
  sortPosMenu,
  sortPosTables,
  sortPosZones,
  tableDisplayName,
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

  it('keeps acceptance fixtures out of the human POS presentation', () => {
    expect(isSyntheticPosValue('INV-1787277711610 POS zone')).toBe(true);
    expect(isSyntheticPosValue('Inventory Acceptance')).toBe(true);
    expect(isSyntheticPosValue('Missing Recipe')).toBe(true);
    expect(isSyntheticPosValue('Салат (проверка)')).toBe(true);
    expect(isSyntheticPosRecord({ id: 'table', layout: 'acceptance-only' })).toBe(
      true,
    );

    expect(isSyntheticPosValue('Основной зал')).toBe(false);
    expect(isSyntheticPosValue('Салат «Цезарь»')).toBe(false);
    expect(isSyntheticPosValue('Тестовая нарезка')).toBe(true);
    expect(isSyntheticPosValue('Демо официант')).toBe(true);
    expect(
      isSyntheticPosStaffId('a75d336d-ed90-4ee0-abd5-f2326ae4d21f'),
    ).toBe(true);
    expect(isSyntheticPosStaffId('review-staff')).toBe(false);
  });

  it('uses a restaurant-facing table name when one is configured', () => {
    expect(tableDisplayName({ id: '1', number: '3' })).toBe('Стол 3');
    expect(tableDisplayName({ id: '2', number: 'VIP 1' })).toBe('VIP 1');
    expect(
      tableDisplayName({ id: '3', number: '7', name: 'Стол у окна' }),
    ).toBe('Стол у окна');
  });

  it('keeps review navigation and menu in an operational order', () => {
    expect(
      sortPosZones([
        { id: 'terrace', name: 'Летняя терраса' },
        { id: 'vip', name: 'VIP' },
        { id: 'main', name: 'Основной зал' },
      ]).map((row) => row.name),
    ).toEqual(['Основной зал', 'VIP', 'Летняя терраса']);

    expect(
      sortPosTables([
        { id: '10', number: '10' },
        { id: '2', number: '2' },
        { id: '1', number: '1' },
      ]).map((row) => row.number),
    ).toEqual(['1', '2', '10']);

    expect(
      sortPosMenu([
        { id: 'tea', category: 'Напитки', name: 'Чай' },
        { id: 'plov', category: 'Горячее', name: 'Плов' },
        { id: 'kebab', category: 'Шашлыки', name: 'Люля-кебаб' },
      ]).map((row) => row.id),
    ).toEqual(['kebab', 'plov', 'tea']);
  });

  it('requires a table, time and guest contact for a review booking', () => {
    const base = {
      tableId: 'table-1',
      scheduledAt: '2026-08-23T19:30',
      guestName: 'Айдар',
      phone: '',
    };

    expect(isReservationDraftReady(base)).toBe(true);
    expect(isReservationDraftReady({ ...base, guestName: '', phone: '+7 700 000 00 00' })).toBe(true);
    expect(isReservationDraftReady({ ...base, tableId: '' })).toBe(false);
    expect(isReservationDraftReady({ ...base, scheduledAt: '' })).toBe(false);
    expect(isReservationDraftReady({ ...base, guestName: '', phone: '' })).toBe(false);
  });

  it('keeps sent kitchen quantities honest in the line controls', () => {
    expect(posLineQuantityState(1, 1)).toEqual({
      quantity: 1,
      sentQuantity: 1,
      unsentQuantity: 0,
      fullySent: true,
      canDecrease: false,
    });
    expect(posLineQuantityState(2, 1)).toEqual({
      quantity: 2,
      sentQuantity: 1,
      unsentQuantity: 1,
      fullySent: false,
      canDecrease: true,
    });
    expect(posLineQuantityState(1, 0)).toEqual({
      quantity: 1,
      sentQuantity: 0,
      unsentQuantity: 1,
      fullySent: false,
      canDecrease: false,
    });
  });
});
