export type Currency = {
  amountMicros?: number | string | null;
  currencyCode?: string | null;
};

export type PosRow = Record<string, any> & { id: string };

export type PosSession = {
  sessionToken: string;
  staff: {
    id: string;
    displayName: string;
    role: 'WAITER' | 'ADMIN';
  };
};

export type PosTableVisualState =
  | 'free'
  | 'my-order'
  | 'other-order'
  | 'reserved'
  | 'overdue'
  | 'precheck'
  | 'payment';

const SYNTHETIC_POS_MARKERS = [
  /^(?:INV|FIXTURE|TECH|ATOMIC)(?:[-_\s]|$)/i,
  /\b(?:POS|Inventory)\s+Acceptance\b/i,
  /\bMissing\s+Recipe\b/i,
  /(?:^|[\s(])(?:проверка|тест[а-яё]*|демо[а-яё]*|test|demo|acceptance|fixture|synthetic|smoke)(?:[\s)]|$)/i,
];

const SYNTHETIC_POS_STAFF_IDS = new Set([
  'a75d336d-ed90-4ee0-abd5-f2326ae4d21f',
  '4b3a3c52-0ba4-446b-af12-67f87a2f6bd4',
]);

export const isSyntheticPosValue = (value: unknown): boolean => {
  const text = String(value ?? '').trim();
  return text.length > 0 && SYNTHETIC_POS_MARKERS.some((marker) => marker.test(text));
};

export const isSyntheticPosRecord = (row: PosRow): boolean =>
  row.layout === 'acceptance-only' ||
  [
    row.name,
    row.number,
    row.category,
    row.label,
    row.guestName,
    row.displayName,
    row.notes,
  ].some(isSyntheticPosValue);

export const isSyntheticPosStaffId = (value: unknown): boolean =>
  SYNTHETIC_POS_STAFF_IDS.has(String(value ?? ''));

export const tableDisplayName = (table?: PosRow): string => {
  const explicit = String(table?.name ?? '').trim();
  if (explicit) return explicit;
  const number = String(table?.number ?? '').trim();
  if (!number) return 'Стол';
  return /^(?:стол|vip)\b/i.test(number) ? number : `Стол ${number}`;
};

const REVIEW_ZONE_ORDER = ['Основной зал', 'VIP', 'Летняя терраса'];
const REVIEW_MENU_CATEGORY_ORDER = [
  'Шашлыки',
  'Горячее',
  'Салаты',
  'Супы',
  'Закуски',
  'Напитки',
  'Десерты',
  'Выпечка',
];

const russianNaturalCompare = (left: unknown, right: unknown): number =>
  String(left ?? '').localeCompare(String(right ?? ''), 'ru', {
    numeric: true,
    sensitivity: 'base',
  });

const preferredRank = (value: unknown, order: string[]): number => {
  const rank = order.indexOf(String(value ?? ''));
  return rank === -1 ? order.length : rank;
};

export const sortPosZones = (rows: PosRow[]): PosRow[] =>
  [...rows].sort(
    (left, right) =>
      preferredRank(left.name, REVIEW_ZONE_ORDER) -
        preferredRank(right.name, REVIEW_ZONE_ORDER) ||
      russianNaturalCompare(left.name, right.name),
  );

export const sortPosTables = (rows: PosRow[]): PosRow[] =>
  [...rows].sort((left, right) =>
    russianNaturalCompare(tableDisplayName(left), tableDisplayName(right)),
  );

export const sortPosMenu = (rows: PosRow[]): PosRow[] =>
  [...rows].sort(
    (left, right) =>
      preferredRank(left.category, REVIEW_MENU_CATEGORY_ORDER) -
        preferredRank(right.category, REVIEW_MENU_CATEGORY_ORDER) ||
      russianNaturalCompare(left.name, right.name),
  );

export const isReservationDraftReady = ({
  tableId,
  scheduledAt,
  guestName,
  phone,
}: {
  tableId?: string | null;
  scheduledAt?: string | null;
  guestName?: string | null;
  phone?: string | null;
}): boolean => {
  const hasContact = Boolean(String(guestName ?? '').trim() || String(phone ?? '').trim());
  const scheduled = String(scheduledAt ?? '').trim();

  return Boolean(
    String(tableId ?? '').trim() &&
      scheduled &&
      Number.isFinite(new Date(scheduled).getTime()) &&
      hasContact,
  );
};

export const posLineQuantityState = (
  quantityValue: unknown,
  kitchenSentQuantityValue: unknown,
): {
  quantity: number;
  sentQuantity: number;
  unsentQuantity: number;
  fullySent: boolean;
  canDecrease: boolean;
} => {
  const parsedQuantity = Number(quantityValue);
  const parsedSentQuantity = Number(kitchenSentQuantityValue);
  const quantity = Math.max(
    1,
    Number.isFinite(parsedQuantity) ? Math.trunc(parsedQuantity) : 1,
  );
  const sentQuantity = Math.min(
    quantity,
    Math.max(
      0,
      Number.isFinite(parsedSentQuantity)
        ? Math.trunc(parsedSentQuantity)
        : 0,
    ),
  );
  const unsentQuantity = quantity - sentQuantity;

  return {
    quantity,
    sentQuantity,
    unsentQuantity,
    fullySent: sentQuantity > 0 && unsentQuantity === 0,
    canDecrease: quantity > Math.max(1, sentQuantity),
  };
};

const POS_ERROR_MESSAGES: Record<string, string> = {
  ROUTE_UNAVAILABLE: 'Нет связи с сервером. Проверьте сеть и попробуйте снова',
  COMMAND_FORBIDDEN: 'Действие доступно только администратору',
  INVALID_STAFF: 'Сотрудник не найден или отключён',
  SHIFT_REQUIRED: 'Сначала откройте смену',
  SHIFT_NOT_FOUND: 'Смена не найдена. Обновите экран',
  SHIFT_ALREADY_CLOSED: 'Смена уже закрыта',
  SHIFT_NOT_OWNED: 'Эта смена открыта другим сотрудником',
  TABLE_NOT_FOUND: 'Стол не найден. Обновите зал',
  TABLE_INACTIVE: 'Этот стол временно недоступен',
  TABLE_NOT_AVAILABLE: 'Стол уже открыт другим сотрудником',
  ORDER_NOT_FOUND: 'Заказ не найден. Обновите экран',
  ORDER_NOT_EDITABLE: 'Заказ заблокирован пречеком или уже закрыт',
  ORDER_NOT_OWNED: 'Заказ принадлежит другому сотруднику',
  ORDER_ALREADY_CLOSED: 'Заказ уже закрыт',
  GUEST_NOT_FOUND: 'Гость не найден. Обновите заказ',
  GUEST_NOT_IN_ORDER: 'Гость относится к другому заказу',
  MENU_ITEM_NOT_FOUND: 'Блюдо больше не найдено в меню',
  MENU_ITEM_INACTIVE: 'Блюдо временно недоступно',
  STOP_LISTED: 'Блюдо находится в стоп-листе',
  LINE_NOT_FOUND: 'Позиция заказа не найдена',
  LINE_NOT_EDITABLE: 'Эту позицию уже нельзя изменить',
  LINE_ALREADY_SENT: 'Отправленную позицию нельзя изменить обычным действием',
  STOP_LIST_NOT_FOUND: 'Позиция уже снята со стоп-листа',
  PRECHECK_NOT_FOUND: 'Активный пречек не найден',
  PRECHECK_NOT_ACTIVE: 'Пречек уже отменён',
  PAYMENT_METHOD_NOT_FOUND: 'Способ оплаты не найден',
  PAYMENT_METHOD_INACTIVE: 'Способ оплаты отключён',
  PAYMENT_IN_PROGRESS: 'Оплата уже обрабатывается на другом терминале',
  PAYMENT_ORDER_STATE: 'Сначала сформируйте пречек',
  OVERPAYMENT: 'Сумма больше остатка к оплате',
  PAYMENT_AMOUNT_INVALID: 'Введите корректную сумму оплаты',
  ORDER_NOT_PAID: 'Заказ нельзя закрыть: осталась сумма к оплате',
  RESERVATION_NOT_FOUND: 'Бронирование не найдено',
  RESERVATION_STATUS_INVALID: 'Бронирование уже завершено или отменено',
  RESERVATION_TABLE_MISMATCH: 'Бронирование относится к другому столу',
  PREPAYMENT_NOT_FOUND: 'Предоплата не найдена',
  PREPAYMENT_ALREADY_APPLIED: 'Предоплата уже использована в другом заказе',
  PREPAYMENT_AMOUNT_INVALID: 'Введите корректную сумму предоплаты',
  PREPAYMENT_EXCEEDS_ORDER: 'Предоплата больше суммы заказа',
  STAFF_NOT_FOUND: 'Сотрудник не найден',
  STAFF_INACTIVE: 'Сотрудник отключён',
  GUEST_TRANSFER_INVALID: 'Позиции можно перенести только между гостями одного заказа',
  VOID_LINE_INVALID: 'Выбранную позицию нельзя отменить',
  IDEMPOTENCY_CONFLICT: 'Повторный запрос не совпал с исходной операцией',
  CONFLICT: 'Данные уже изменились на другом терминале. Обновите экран',
};

export const uuid = (): string => {
  const bytes = new Uint8Array(16);
  try {
    globalThis.crypto?.getRandomValues(bytes);
  } catch {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] =
        (Date.now() + index * 31 + Math.random() * 255) & 255;
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const micros = (
  value: Currency | number | string | null | undefined,
): number => {
  if (typeof value === 'object' && value) {
    return Number(value.amountMicros ?? 0);
  }
  return Number(value ?? 0);
};

export const money = (
  value: Currency | number | string | null | undefined,
): string =>
  `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(
    Math.round(micros(value) / 1_000_000),
  )} ₸`;

export const dateTime = (value?: string | null): string =>
  value
    ? new Intl.DateTimeFormat('ru-KZ', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—';

export const timeOnly = (value?: string | null): string =>
  value
    ? new Intl.DateTimeFormat('ru-KZ', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : 'Без времени';

export const listRows = <T extends PosRow>(
  payload: any,
  plural: string,
): T[] => payload?.data?.[plural] ?? [];

export const isActiveOrder = (order: PosRow | undefined): boolean =>
  Boolean(
    order &&
      ['OPEN', 'IN_PROGRESS', 'PRECHECK_PRINTED'].includes(order.status),
  );

export const isOverdueReservation = (
  reservation: PosRow,
  now = Date.now(),
): boolean =>
  Boolean(
    reservation.scheduledAt &&
      new Date(reservation.scheduledAt).getTime() < now &&
      reservation.status === 'ACTIVE',
  );

export const formatNegativeTimer = (
  scheduledAt?: string | null,
  now = Date.now(),
): string => {
  if (!scheduledAt) return '';
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - new Date(scheduledAt).getTime()) / 60_000),
  );
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return `-${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const formatShiftDuration = (
  openedAt?: string | null,
  now = Date.now(),
): string => {
  if (!openedAt) return '';
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - new Date(openedAt).getTime()) / 60_000),
  );
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return hours ? `${hours}ч ${minutes}м` : `${minutes}м`;
};

export const parseMoneyInputToMicros = (value: string): number | null => {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const match = /^(\d{1,9})(?:\.(\d{0,6}))?$/.exec(normalized);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(6, '0'));
  const amount = whole * 1_000_000 + fraction;
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
};

export const formatMicrosForInput = (value: number): string => {
  const safeValue = Math.max(0, Math.trunc(value));
  const whole = Math.floor(safeValue / 1_000_000);
  const fraction = String(safeValue % 1_000_000)
    .padStart(6, '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
};

export const tableVisualState = ({
  order,
  reservation,
  currentStaffId,
  now = Date.now(),
}: {
  order?: PosRow;
  reservation?: PosRow;
  currentStaffId?: string;
  now?: number;
}): PosTableVisualState => {
  if (order) {
    const paid = micros(order.paidTotal) + micros(order.prepaidTotal);
    if (paid > 0 && paid < micros(order.total)) return 'payment';
    if (order.status === 'PRECHECK_PRINTED') return 'precheck';
    return order.ownerStaffId === currentStaffId ? 'my-order' : 'other-order';
  }
  if (reservation) {
    return isOverdueReservation(reservation, now) ? 'overdue' : 'reserved';
  }
  return 'free';
};

export const commandError = (error: unknown): string => {
  const body = (error as any)?.body;
  const code = String(body?.code ?? '');
  const technicalMessage =
    body?.message || (error instanceof Error ? error.message : '');

  if (code && POS_ERROR_MESSAGES[code]) return POS_ERROR_MESSAGES[code];

  if (code || technicalMessage) {
    console.error('[Mahabbat POS] command failed', {
      code: code || 'UNEXPECTED',
      message: technicalMessage || 'No message',
    });
  }
  return 'Не удалось выполнить операцию. Обновите данные и попробуйте снова';
};

export const initials = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'M';
