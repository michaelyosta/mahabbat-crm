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

export const filterPosMenu = (
  rows: PosRow[],
  searchValue: string,
  category: string,
): PosRow[] => {
  const search = searchValue.trim().toLocaleLowerCase('ru');

  return rows.filter((item) => {
    const matchesSearch = String(item.name ?? '')
      .toLocaleLowerCase('ru')
      .includes(search);

    if (search) return matchesSearch;
    return category === 'Все' || item.category === category;
  });
};

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
    canDecrease: unsentQuantity > 0,
  };
};

export const findMergeablePosLine = (
  lines: PosRow[],
  guestId: string,
  menuItemId: string,
): PosRow | undefined =>
  [...lines]
    .reverse()
    .find(
      (line) =>
        line.status === 'ACTIVE' &&
        line.guestId === guestId &&
        line.menuItemId === menuItemId,
    );

const POS_ERROR_MESSAGES: Record<string, string> = {
  ROUTE_UNAVAILABLE: 'Нет связи с сервером. Проверьте сеть и попробуйте снова',
  INVALID_POS_CREDENTIALS: 'Неверный PIN. Попробуйте ещё раз',
  COMMAND_FORBIDDEN: 'Действие доступно только администратору',
  INVALID_STAFF: 'Сотрудник не найден или отключён',
  SHIFT_REQUIRED: 'Сначала откройте смену',
  SHIFT_NOT_FOUND: 'Смена не найдена. Обновите экран',
  SHIFT_ALREADY_CLOSED: 'Смена уже закрыта',
  SHIFT_NOT_OWNED: 'Эта смена открыта другим сотрудником',
  SHIFT_HAS_OPEN_ORDERS: 'Смена не закрыта: есть открытые заказы. Закройте их и повторите попытку',
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
  LINE_ALREADY_SENT: 'Отправленную позицию нельзя изменить обычным действием — попросите администратора отменить её через «Отмену блюда»',
  STOP_LIST_NOT_FOUND: 'Позиция уже снята со стоп-листа',
  KITCHEN_TICKET_NOT_FOUND: 'Кухонный тикет не найден. Отправьте блюда на кухню заново',
  PRINT_JOB_NOT_FOUND: 'Задание печати не найдено. Отправьте печать заново',
  PRINTER_DEVICE_NOT_FOUND: 'Принтер не найден. Проверьте настройку печати',
  PRODUCTION_STATION_NOT_FOUND: 'Место печати не найдено. Проверьте маршруты печати',
  PRINT_CONFIG_INVALID: 'Настройка печати некорректна. Проверьте устройство и ширину бумаги',
  UNKNOWN_REPRINT_NOT_CONFIRMED: 'Сначала проверьте бумагу в принтере и подтвердите повтор вводом его названия',
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
  POS_STAFF_LOCKED: 'Смена заблокирована: слишком много неверных попыток входа. Подождите и попробуйте снова',
  POS_STAFF_INACTIVE: 'Сотрудник отключён администратором. Обратитесь к администратору',
  POS_SESSION_EXPIRED: 'Сессия завершена. Войдите по PIN снова',
  POS_SESSION_INVALID: 'Сессия недействительна. Войдите по PIN снова',
  POS_SESSION_REQUIRED: 'Войдите по PIN, чтобы продолжить',
  POS_LOGIN_RATE_LIMITED: 'Слишком много попыток входа. Подождите и попробуйте снова',
  GUEST_TRANSFER_INVALID: 'Позиции можно перенести только между гостями одного заказа',
  VOID_LINE_INVALID: 'Выбранную позицию нельзя отменить',
  TOTALS_NOT_CONVERGED: 'Суммы заказа не сошлись из-за параллельного изменения. Обновите экран и повторите',
  PRECHECK_NOT_PRINTED: 'Пречек ещё не напечатан. Дождитесь печати',
  INVALID_SIGNATURE: 'Нет связи с сервером. Проверьте сеть и попробуйте снова',
  RELEASE_INFO_UNAVAILABLE: 'Данные о версии недоступны',
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
): string => {
  const total = micros(value);
  const whole = Math.trunc(total / 1_000_000);
  const tiyin = Math.abs(total % 1_000_000);
  const head = new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(whole);
  if (!tiyin) return `${head} ₸`;
  const cents = String(Math.round(tiyin / 10_000)).padStart(2, '0');
  return `${head},${cents} ₸`;
};

export const summarizePosDayPayments = ({
  payments,
  orders,
  now = Date.now(),
}: {
  payments: PosRow[];
  orders: PosRow[];
  now?: number;
}): {
  totalMicros: number;
  cashMicros: number;
  cashlessMicros: number;
  paymentCount: number;
} => {
  const currentDay = new Date(now);
  const visibleOrderIds = new Set(orders.map((order) => String(order.id)));
  let cashMicros = 0;
  let cashlessMicros = 0;
  let paymentCount = 0;

  for (const payment of payments) {
    const createdAt = new Date(String(payment.createdAt ?? ''));
    const amountMicros = micros(payment.amount);
    const isToday =
      Number.isFinite(createdAt.getTime()) &&
      createdAt.getFullYear() === currentDay.getFullYear() &&
      createdAt.getMonth() === currentDay.getMonth() &&
      createdAt.getDate() === currentDay.getDate();

    if (
      payment.status !== 'SUCCESS' ||
      !visibleOrderIds.has(String(payment.orderId ?? '')) ||
      !isToday ||
      !Number.isSafeInteger(amountMicros) ||
      amountMicros <= 0
    ) {
      continue;
    }

    if (payment.paymentMethodTypeSnapshot === 'CASH') {
      cashMicros += amountMicros;
    } else {
      cashlessMicros += amountMicros;
    }
    paymentCount += 1;
  }

  return {
    totalMicros: cashMicros + cashlessMicros,
    cashMicros,
    cashlessMicros,
    paymentCount,
  };
};

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

// --- POS UI states (gauntlet/pos-ui-states): closeShift guard, double-submit,
// about/release. Pure helpers — covered by unit tests. ---

export const russianPlural = (
  count: number,
  one: string,
  few: string,
  many: string,
): string => {
  const mod100 = Math.abs(Math.trunc(count)) % 100;
  const mod10 = mod100 % 10;
  if (mod100 > 10 && mod100 < 20) return many;
  if (mod10 > 1 && mod10 < 5) return few;
  if (mod10 === 1) return one;
  return many;
};

export const formatOpenOrderCount = (count: number): string =>
  `${count} ${russianPlural(count, 'заказ', 'заказа', 'заказов')}`;

// Открытые заказы смены для предпроверки закрытия смены в UI. Сервер
// (executeCloseShift) считает заказы смены со статусом OPEN / IN_PROGRESS /
// PRECHECK_PRINTED; здесь тот же предикат isActiveOrder. Строки posOrders из
// load() переиспользуются — отдельного запроса нет. Если ни одна строка не
// несёт shiftId (ограниченная REST-проекция), честно считаем все активные:
// сервер остаётся источником истины, а его 409 закрывает гонку.
export const countShiftOpenOrders = (
  orders: PosRow[],
  shiftId?: string | null,
): number => {
  const active = orders.filter(
    (order) =>
      isActiveOrder(order) &&
      !isSyntheticPosRecord(order),
  );
  if (!shiftId) return active.length;
  const withShift = active.filter((order) => order.shiftId !== undefined);
  if (withShift.length === 0) return active.length;
  return withShift.filter((order) => order.shiftId === shiftId).length;
};

export type ReleaseImageInfo = {
  immutableTag: string;
  digest: string;
};

export type ReleaseSummary = {
  mahabbatVersion: string;
  windowsFileVersion: string;
  deploymentSha: string;
  crmSha: string;
  backupVersion: number | null;
  images: Record<string, ReleaseImageInfo>;
  changelog: string;
  manifestSha256: string | null;
};

// Нормализует сырой release/mahabbat-release.json в то, что показывает экран
// «О кассе». Значения передаются как есть, без trim/перекодировок, чтобы на
// приёмке совпадать с acceptance packet побайтово. Возвращает null, когда
// обязательные поля отсутствуют (UI показывает честный фолбэк, а не выдумку).
export const summarizeReleaseManifest = (
  raw: unknown,
  manifestSha256?: string | null,
): ReleaseSummary | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const mahabbatVersion = record.mahabbatVersion;
  const crmSha = record.crmSha;
  if (typeof mahabbatVersion !== 'string' || !mahabbatVersion) return null;
  if (typeof crmSha !== 'string' || !crmSha) return null;
  const images: Record<string, ReleaseImageInfo> = {};
  const rawImages = record.images;
  if (rawImages && typeof rawImages === 'object') {
    for (const [name, entry] of Object.entries(
      rawImages as Record<string, unknown>,
    )) {
      if (entry && typeof entry === 'object') {
        const item = entry as Record<string, unknown>;
        images[name] = {
          immutableTag: typeof item.immutableTag === 'string' ? item.immutableTag : '',
          digest: typeof item.digest === 'string' ? item.digest : '',
        };
      }
    }
  }
  return {
    mahabbatVersion,
    windowsFileVersion:
      typeof record.windowsFileVersion === 'string'
        ? record.windowsFileVersion
        : '',
    deploymentSha:
      typeof record.deploymentSha === 'string' ? record.deploymentSha : '',
    crmSha,
    backupVersion:
      typeof record.backupVersion === 'number' ? record.backupVersion : null,
    images,
    changelog:
      typeof record.changelogSource === 'string' ? record.changelogSource : '',
    manifestSha256: manifestSha256 ?? null,
  };
};

// Защита от двойной отправки: синхронный guard на intent. Первый клик
// занимает intent одним idempotencyKey; повторный клик, пока полёт не
// завершён (включая окно до ре-рендера disabled), не шлёт второй запрос.
// После settle intent освобождается — следующая попытка пользователя берёт
// свежий ключ.
export const createSubmitGuard = () => {
  const inflight = new Map<string, string>();
  return {
    acquire: (intent: string, makeKey: () => string): string | null => {
      if (inflight.has(intent)) return null;
      const key = makeKey();
      inflight.set(intent, key);
      return key;
    },
    release: (intent: string): void => {
      inflight.delete(intent);
    },
  };
};

export type SubmitGuard = ReturnType<typeof createSubmitGuard>;
