import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  commandError,
  dateTime,
  formatMicrosForInput,
  formatNegativeTimer,
  formatShiftDuration,
  initials,
  isActiveOrder,
  isOverdueReservation,
  isSyntheticPosRecord,
  isSyntheticPosStaffId,
  micros,
  money,
  parseMoneyInputToMicros,
  sortPosMenu,
  sortPosTables,
  sortPosZones,
  tableVisualState,
  tableDisplayName,
  timeOnly,
  uuid,
  type PosRow,
  type PosSession,
  type PosTableVisualState,
} from 'src/front-components/pos-ui.helpers';
import { POS_UI_CSS } from 'src/front-components/pos-ui.styles';
import type { PosApi } from 'src/pos-ui/PosApi';
import {
  clearPosSession,
  persistPosSession,
  restorePosSession,
} from 'src/pos-ui/PosApi';

type ApiEnvelope = {
  status?: string;
  message?: string;
  code?: string;
  [key: string]: any;
};

type PosAppProps = {
  api: PosApi;
  mode?: 'embedded' | 'standalone';
  initialSession?: PosSession | null;
  onSessionChange?: (session: PosSession | null) => void;
  gatewayBaseUrl?: string;
};

type SheetName =
  | 'reservation'
  | 'payment'
  | 'admin'
  | 'void'
  | 'stop-list'
  | 'session'
  | 'confirm'
  | null;

type PendingAction = {
  title: string;
  description: string;
  command: string;
  payload: Record<string, unknown>;
  success: string;
  returnTo: Exclude<SheetName, 'confirm' | null>;
  danger?: boolean;
};

const CORE_COLLECTIONS = [
  'posZones',
  'posTables',
  'posOrders',
  'posOrderGuests',
  'posOrderLines',
  'posMenuItems',
  'posShifts',
  'posReservations',
  'posStopListEntries',
  'posKitchenTickets',
  'posKitchenTicketLines',
  'posPrechecks',
  'posPayments',
  'posPaymentMethods',
  'posPrepayments',
] as const;

const Sheet = ({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) => (
  <div className="mah-pos-overlay" role="presentation">
    <section
      className={`mah-pos-sheet ${wide ? 'wide' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="mah-pos-sheet-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="mah-pos-icon-btn mah-pos-sheet-close"
          aria-label="Закрыть"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="mah-pos-sheet-body">{children}</div>
      {footer && <footer className="mah-pos-sheet-footer">{footer}</footer>}
    </section>
  </div>
);

const LoginView = ({
  pin,
  busy,
  error,
  onPinChange,
  onLogin,
}: {
  pin: string;
  busy: boolean;
  error: string;
  onPinChange: (value: string) => void;
  onLogin: () => void;
}) => (
  <div className="mah-pos-login">
    <div className="mah-pos-login-card">
      <div className="mah-pos-mark">M</div>
      <h1 className="mah-pos-title">Mahabbat POS</h1>
      <p className="mah-pos-sub">Вход сотрудника в операционную кассу</p>
      <input
        className="mah-pos-input mah-pos-pin-display"
        aria-label="PIN"
        inputMode="numeric"
        type="password"
        value={pin}
        onChange={(event) => onPinChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onLogin();
        }}
        placeholder="••••"
        autoFocus
      />
      <div className="mah-pos-pin">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            type="button"
            key={digit}
            onClick={() => onPinChange(`${pin}${digit}`)}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className="mah-pos-pin-clear"
          onClick={() => onPinChange('')}
        >
          Очистить
        </button>
        <button type="button" onClick={() => onPinChange(pin.slice(0, -1))}>
          ⌫
        </button>
      </div>
      <button
        type="button"
        className="mah-pos-btn primary"
        style={{ width: '100%', marginTop: 14 }}
        disabled={busy}
        onClick={onLogin}
      >
        {busy ? 'Входим…' : 'Войти'}
      </button>
      {error && <div className="mah-pos-toast error">{error}</div>}
      <div className="mah-pos-login-hint">Введите личный PIN сотрудника</div>
    </div>
  </div>
);

const PosHeader = ({
  session,
  activeShift,
  reservationCount,
  overdueCount,
  now,
  syncing,
  onReservation,
  onSessionMenu,
}: {
  session: PosSession;
  activeShift?: PosRow;
  reservationCount: number;
  overdueCount: number;
  now: number;
  syncing: boolean;
  onReservation: () => void;
  onSessionMenu: () => void;
}) => (
  <header className="mah-pos-top">
    <div className="mah-pos-brand">
      <div className="mah-pos-brand-mark">M</div>
      <div>
        Mahabbat
        <small>ресторанная касса</small>
      </div>
    </div>
    <button
      type="button"
      className={`mah-pos-shift-pill ${activeShift ? 'open' : ''}`}
      onClick={onSessionMenu}
    >
      <i className="mah-pos-dot" />
      {activeShift
        ? `Смена открыта · ${formatShiftDuration(activeShift.openedAt, now)}`
        : 'Смена закрыта'}
    </button>
    <button
      type="button"
      className="mah-pos-top-action"
      onClick={onReservation}
    >
      Брони · {reservationCount}
      {overdueCount > 0 && <span>⚠ {overdueCount}</span>}
    </button>
    <div className="mah-pos-top-actions">
      <div className={`mah-pos-sync ${syncing ? 'loading' : ''}`}>
        <i />
        {syncing ? 'Синхронизация' : 'Данные актуальны'}
      </div>
      <div className="mah-pos-staff">
        <div className="mah-pos-avatar">
          {initials(session.staff.displayName)}
        </div>
        <div className="mah-pos-staff-copy">
          <strong>{session.staff.displayName}</strong>
          <small>
            {session.staff.role === 'ADMIN' ? 'Администратор' : 'Официант'}
          </small>
        </div>
      </div>
      <button
        type="button"
        className="mah-pos-icon-btn"
        aria-label="Действия сессии"
        onClick={onSessionMenu}
      >
        ⋯
      </button>
    </div>
  </header>
);

const ZoneNavigation = ({
  zones,
  zoneId,
  reservations,
  now,
  onZone,
  onReservations,
}: {
  zones: PosRow[];
  zoneId: string | null;
  reservations: PosRow[];
  now: number;
  onZone: (id: string) => void;
  onReservations: () => void;
}) => {
  const overdue = reservations.filter((item) =>
    isOverdueReservation(item, now),
  ).length;
  return (
    <aside className="mah-pos-sidebar">
      <div className="mah-pos-section-label">Зоны</div>
      <div className="mah-pos-zones">
        {zones.map((zone) => (
          <button
            type="button"
            className={`mah-pos-zone ${zone.id === zoneId ? 'active' : ''}`}
            key={zone.id}
            onClick={() => onZone(zone.id)}
          >
            {zone.name}
          </button>
        ))}
      </div>
      <div className="mah-pos-sidebar-bottom">
        <button
          type="button"
          className={`mah-pos-sidebar-card ${overdue ? 'alert' : ''}`}
          onClick={onReservations}
        >
          <strong>Брони · {reservations.length}</strong>
          <small>
            {overdue ? `${overdue} просрочено` : 'Открыть список'}
          </small>
        </button>
      </div>
    </aside>
  );
};

const tableStateCopy: Record<
  PosTableVisualState,
  { label: string; icon: string }
> = {
  free: { label: 'Свободен', icon: '○' },
  'my-order': { label: 'Мой заказ', icon: '●' },
  'other-order': { label: 'Другой официант', icon: '◆' },
  reserved: { label: 'Бронь', icon: '◷' },
  overdue: { label: 'Просрочено', icon: '!' },
  precheck: { label: 'Пречек', icon: '▣' },
  payment: { label: 'Частично оплачено', icon: '₸' },
};

const TableBoard = ({
  zoneName,
  tables,
  orders,
  reservations,
  staffNames,
  currentStaffId,
  selectedTableId,
  now,
  loading,
  onSelect,
}: {
  zoneName: string;
  tables: PosRow[];
  orders: PosRow[];
  reservations: PosRow[];
  staffNames: Map<string, string>;
  currentStaffId: string;
  selectedTableId: string | null;
  now: number;
  loading: boolean;
  onSelect: (table: PosRow) => void;
}) => (
  <section className="mah-pos-board">
    <div className="mah-pos-section-head">
      <h2>{zoneName || 'Зал'}</h2>
      <span>Выберите стол</span>
      <div className="mah-pos-spacer" />
      <span className="mah-pos-count">{tables.length} столов</span>
    </div>
    <div className="mah-pos-table-grid">
      {loading
        ? Array.from({ length: 8 }, (_, index) => (
            <div className="mah-pos-skeleton" key={index} />
          ))
        : tables.map((table) => {
            const order = orders.find(
              (row) => row.tableId === table.id && isActiveOrder(row),
            );
            const reservation = reservations.find(
              (row) => row.tableId === table.id,
            );
            const visualState = tableVisualState({
              order,
              reservation,
              currentStaffId,
              now,
            });
            const copy = tableStateCopy[visualState];
            const owner = order?.ownerStaffId
              ? staffNames.get(order.ownerStaffId)
              : null;
            const reservationMeta = reservation
              ? `${timeOnly(reservation.scheduledAt)}${reservation.guestName ? ` · ${reservation.guestName}` : ''}`
              : '';
            const ownerMeta =
              visualState === 'other-order'
                ? owner || 'Другой официант'
                : visualState === 'my-order'
                  ? 'Ваш стол'
                  : '';
            return (
              <button
                type="button"
                className={`mah-pos-table ${visualState} ${selectedTableId === table.id ? 'selected' : ''}`}
                key={table.id}
                aria-label={`${tableDisplayName(table)}: ${copy.label}`}
                onClick={() => onSelect(table)}
              >
                <div className="mah-pos-table-top">
                  <strong>{tableDisplayName(table)}</strong>
                  <span>{copy.icon}</span>
                </div>
                <span className="mah-pos-table-state">{copy.label}</span>
                {(reservationMeta || ownerMeta) && (
                  <span
                    className={`mah-pos-table-meta ${visualState === 'overdue' ? 'mah-pos-negative-time' : ''}`}
                  >
                    {visualState === 'overdue'
                      ? `${formatNegativeTimer(reservation?.scheduledAt, now)}${reservation?.guestName ? ` · ${reservation.guestName}` : ''}`
                      : reservationMeta || ownerMeta}
                  </span>
                )}
                {order && (
                  <span className="mah-pos-table-total">
                    {money(order.total)}
                  </span>
                )}
              </button>
            );
          })}
    </div>
  </section>
);

const MenuBrowser = ({
  menu,
  stopList,
  search,
  category,
  selectedGuest,
  orderLocked,
  busy,
  onSearch,
  onCategory,
  onItem,
  onStopList,
}: {
  menu: PosRow[];
  stopList: Set<string>;
  search: string;
  category: string;
  selectedGuest?: PosRow;
  orderLocked: boolean;
  busy: boolean;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
  onItem: (item: PosRow) => void;
  onStopList: () => void;
}) => {
  const categories = useMemo(
    () => [
      'Все',
      ...Array.from(
        new Set(menu.map((item) => item.category).filter(Boolean)),
      ),
    ],
    [menu],
  );
  const filteredMenu = useMemo(
    () =>
      menu.filter(
        (item) =>
          (category === 'Все' || item.category === category) &&
          String(item.name ?? '')
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [category, menu, search],
  );
  const hasOrder = Boolean(selectedGuest);
  const context = orderLocked
    ? 'Заказ заблокирован пречеком'
    : selectedGuest
      ? `Добавляем: ${selectedGuest.displayNumber ?? selectedGuest.name ?? 'гость'}`
      : 'Сначала выберите или откройте стол';

  return (
    <section className="mah-pos-menu">
      <div className="mah-pos-menu-head">
        <h3>Меню</h3>
        <span className="mah-pos-menu-context">{context}</span>
        <input
          className="mah-pos-input mah-pos-search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Поиск блюда"
          aria-label="Поиск блюда"
        />
      </div>
      <div className="mah-pos-menu-tools">
        <div className="mah-pos-categories">
          {categories.map((item) => (
            <button
              type="button"
              key={item}
              className={`mah-pos-category ${item === category ? 'active' : ''}`}
              onClick={() => onCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`mah-pos-stop-button ${stopList.size > 0 ? 'active' : ''}`}
          onClick={onStopList}
        >
          Стоп-лист · {stopList.size}
        </button>
      </div>
      <div className="mah-pos-menu-grid">
        {filteredMenu.length ? (
          filteredMenu.map((item) => {
            const stopped = stopList.has(item.id);
            return (
              <button
                type="button"
                className={`mah-pos-dish ${stopped ? 'stopped' : ''} ${!hasOrder && !stopped ? 'preview' : ''}`}
                key={item.id}
                disabled={stopped || !hasOrder || orderLocked || busy}
                onClick={() => onItem(item)}
              >
                {stopped && (
                  <span className="mah-pos-stopped-badge">
                    × НЕТ В НАЛИЧИИ
                  </span>
                )}
                <b>{item.name}</b>
                <strong>{money(item.price)}</strong>
              </button>
            );
          })
        ) : (
          <div className="mah-pos-menu-empty">Ничего не найдено</div>
        )}
      </div>
    </section>
  );
};

const EmptyOrderPanel = ({
  session,
  activeShift,
  recentOrders,
  tables,
  onOrder,
  onOpenShift,
}: {
  session: PosSession;
  activeShift?: PosRow;
  recentOrders: PosRow[];
  tables: PosRow[];
  onOrder: (order: PosRow) => void;
  onOpenShift: () => void;
}) => (
  <div className="mah-pos-empty-panel">
    <div className="mah-pos-panel-meta">
      {session.staff.displayName} ·{' '}
      {activeShift ? 'смена открыта' : 'смена закрыта'}
    </div>
    <div className="mah-pos-empty-hero">
      <div className="mah-pos-empty-icon">⌖</div>
      <h2>{activeShift ? 'Выберите стол' : 'Откройте смену'}</h2>
      <p>
        {activeShift
          ? 'Свободный стол можно открыть или забронировать. Занятый стол откроет текущий заказ.'
          : 'После открытия смены станут доступны столы и новые заказы.'}
      </p>
      {!activeShift && (
        <button
          type="button"
          className="mah-pos-btn primary"
          style={{ marginTop: 15 }}
          onClick={onOpenShift}
        >
          Открыть смену
        </button>
      )}
    </div>
    {recentOrders.length > 0 && (
      <div className="mah-pos-recent">
        <h3>Ваши активные столы</h3>
        {recentOrders.slice(0, 3).map((order) => {
          const table = tables.find((item) => item.id === order.tableId);
          return (
            <button type="button" key={order.id} onClick={() => onOrder(order)}>
              <span>{table ? tableDisplayName(table) : 'Стол —'}</span>
              <strong>{money(order.total)}</strong>
            </button>
          );
        })}
      </div>
    )}
  </div>
);

const TableContextPanel = ({
  table,
  reservation,
  activeShift,
  busy,
  now,
  onOpen,
  onReserve,
}: {
  table: PosRow;
  reservation?: PosRow;
  activeShift?: PosRow;
  busy: boolean;
  now: number;
  onOpen: () => void;
  onReserve: () => void;
}) => (
  <div className="mah-pos-table-context">
    <span className="mah-pos-table-context-status">
      {reservation
        ? isOverdueReservation(reservation, now)
          ? 'БРОНЬ ПРОСРОЧЕНА'
          : 'СТОЛ ЗАБРОНИРОВАН'
        : 'СВОБОДНЫЙ СТОЛ'}
    </span>
    <div className="mah-pos-table-context-main">
      <div className="mah-pos-empty-icon">{reservation ? '◷' : '○'}</div>
      <h2>{tableDisplayName(table)}</h2>
      <p>
        {activeShift
          ? 'Выберите действие'
          : 'Для открытия заказа сначала откройте смену'}
      </p>
      {reservation && (
        <div className="mah-pos-reservation-card">
          <strong>
            {isOverdueReservation(reservation, now)
              ? `Просрочено ${formatNegativeTimer(reservation.scheduledAt, now)}`
              : timeOnly(reservation.scheduledAt)}
          </strong>
          <span>{reservation.guestName || 'Имя не указано'}</span>
          {reservation.phone && <span>{reservation.phone}</span>}
        </div>
      )}
    </div>
    <div className="mah-pos-actions">
      <button
        type="button"
        className="mah-pos-btn primary"
        disabled={!activeShift || busy}
        onClick={onOpen}
      >
        {reservation ? 'Открыть заказ' : 'Открыть стол'}
      </button>
      <button
        type="button"
        className="mah-pos-btn"
        disabled={busy}
        onClick={onReserve}
      >
        {reservation ? 'Бронь' : 'Забронировать'}
      </button>
    </div>
  </div>
);

const OrderPanel = ({
  session,
  order,
  table,
  guests,
  lines,
  selectedGuest,
  precheck,
  totalMicros,
  prepaidMicros,
  paidMicros,
  remainingMicros,
  unsentCount,
  sentCount,
  busy,
  onGuest,
  onAddGuest,
  onQuantity,
  onPrint,
  onPrecheck,
  onPayment,
  onCloseOrder,
  onAdmin,
}: {
  session: PosSession;
  order: PosRow;
  table?: PosRow;
  guests: PosRow[];
  lines: PosRow[];
  selectedGuest?: PosRow;
  precheck?: PosRow;
  totalMicros: number;
  prepaidMicros: number;
  paidMicros: number;
  remainingMicros: number;
  unsentCount: number;
  sentCount: number;
  busy: boolean;
  onGuest: (id: string) => void;
  onAddGuest: () => void;
  onQuantity: (line: PosRow, quantity: number) => void;
  onPrint: () => void;
  onPrecheck: () => void;
  onPayment: () => void;
  onCloseOrder: () => void;
  onAdmin: () => void;
}) => {
  const locked = Boolean(precheck);
  return (
    <>
      <header className="mah-pos-panel-head">
        <div className="mah-pos-panel-title">
          <h2>{table ? tableDisplayName(table) : 'Стол —'}</h2>
          <span
            className={`mah-pos-status-chip ${locked ? 'locked' : 'success'}`}
          >
            {locked ? 'ПРЕЧЕК' : 'В РАБОТЕ'}
          </span>
          <div className="mah-pos-spacer" />
          {session.staff.role === 'ADMIN' && (
            <button
              type="button"
              className="mah-pos-icon-btn"
              aria-label="Действия администратора"
              onClick={onAdmin}
            >
              ⋯
            </button>
          )}
        </div>
        <div className="mah-pos-panel-meta">
          {order.ownerStaffId === session.staff.id
            ? `${session.staff.displayName} · ваш заказ`
            : 'Заказ другого официанта'}
        </div>
      </header>
      <div className="mah-pos-guest-list">
        {guests.map((guest) => {
          const guestLines = lines.filter((line) => line.guestId === guest.id);
          return (
            <button
              type="button"
              key={guest.id}
              className={`mah-pos-guest ${guest.id === selectedGuest?.id ? 'active' : ''}`}
              onClick={() => onGuest(guest.id)}
            >
              <strong>
                {guest.displayNumber ?? guest.name ?? `Гость ${guest.ordinal}`}
              </strong>
              <small>
                {guestLines.length} поз. · {money(guest.subtotal)}
              </small>
            </button>
          );
        })}
        <button
          type="button"
          className="mah-pos-guest mah-pos-add-guest"
          disabled={busy || locked}
          onClick={onAddGuest}
        >
          + Гость
        </button>
      </div>
      <div className="mah-pos-lines">
        {guests.length === 0 ? (
          <div className="mah-pos-empty-lines">
            <div>
              <strong>Добавьте первого гостя</strong>
              После этого можно добавлять блюда из меню
            </div>
          </div>
        ) : lines.length === 0 ? (
          <div className="mah-pos-empty-lines">
            <div>
              <strong>Заказ пока пуст</strong>
              Выберите гостя и коснитесь блюда
            </div>
          </div>
        ) : (
          guests.map((guest) => {
            const guestLines = lines.filter((line) => line.guestId === guest.id);
            if (!guestLines.length) return null;
            return (
              <section className="mah-pos-guest-group" key={guest.id}>
                <div
                  className={`mah-pos-guest-group-head ${guest.id === selectedGuest?.id ? 'active' : ''}`}
                >
                  <button type="button" onClick={() => onGuest(guest.id)}>
                    {guest.displayNumber ?? guest.name ?? `Гость ${guest.ordinal}`}
                  </button>
                  <strong>{money(guest.subtotal)}</strong>
                </div>
                {guestLines.map((line) => {
                  const voided = line.status === 'VOIDED';
                  const sent = Number(line.kitchenSentQuantity ?? 0) > 0;
                  return (
                    <div
                      className={`mah-pos-line ${voided ? 'voided' : ''}`}
                      key={line.id}
                    >
                      <div>
                        <strong className="mah-pos-line-name">
                          {line.itemNameSnapshot ?? 'Позиция'}
                        </strong>
                        <div className="mah-pos-line-sub">
                          <span>{money(line.unitPrice)}</span>
                          <span
                            className={`mah-pos-line-state ${voided ? 'voided' : sent ? 'sent' : 'new'}`}
                          >
                            {voided ? '× Отменено' : sent ? '✓ На кухне' : '● Новое'}
                          </span>
                        </div>
                      </div>
                      <div className="mah-pos-line-actions">
                        <button
                          type="button"
                          className="mah-pos-qty-button"
                          aria-label={`Уменьшить ${line.itemNameSnapshot}`}
                          disabled={
                            busy ||
                            locked ||
                            voided ||
                            Number(line.quantity ?? 1) <= 1
                          }
                          onClick={() =>
                            onQuantity(line, Number(line.quantity ?? 1) - 1)
                          }
                        >
                          −
                        </button>
                        <span className="mah-pos-qty">{line.quantity}</span>
                        <button
                          type="button"
                          className="mah-pos-qty-button"
                          aria-label={`Увеличить ${line.itemNameSnapshot}`}
                          disabled={busy || locked || voided}
                          onClick={() =>
                            onQuantity(line, Number(line.quantity ?? 1) + 1)
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })
        )}
      </div>
      {locked && (
        <div className="mah-pos-precheck-banner">
          <strong>ПРЕЧЕК СФОРМИРОВАН</strong>
          <span>Заказ заблокирован. Следующий шаг — оплата.</span>
        </div>
      )}
      <footer className="mah-pos-panel-footer">
        <div className="mah-pos-kitchen-summary">
          <span>
            Новое <b>{unsentCount}</b>
          </span>
          <span>
            На кухне <b>{sentCount}</b>
          </span>
        </div>
        <div className="mah-pos-totals">
          <div className="mah-pos-total-row">
            <span>Итого</span>
            <strong>{money(totalMicros)}</strong>
          </div>
          {prepaidMicros > 0 && (
            <div className="mah-pos-total-row">
              <span>Предоплата</span>
              <strong>− {money(prepaidMicros)}</strong>
            </div>
          )}
          {paidMicros > 0 && (
            <div className="mah-pos-total-row">
              <span>Оплачено</span>
              <strong>− {money(paidMicros)}</strong>
            </div>
          )}
          <div className="mah-pos-total-row total">
            <span>К оплате</span>
            <strong>{money(remainingMicros)}</strong>
          </div>
        </div>
        {locked ? (
          remainingMicros === 0 ? (
            <button
              type="button"
              className="mah-pos-btn success"
              style={{ width: '100%' }}
              disabled={busy}
              onClick={onCloseOrder}
            >
              ОПЛАЧЕНО · ЗАКРЫТЬ СТОЛ
            </button>
          ) : (
            <button
              type="button"
              className="mah-pos-btn primary"
              style={{ width: '100%' }}
              disabled={busy}
              onClick={onPayment}
            >
              ОПЛАТИТЬ · {money(remainingMicros)}
            </button>
          )
        ) : (
          <div className="mah-pos-actions">
            <button
              type="button"
              className="mah-pos-btn primary"
              disabled={busy || unsentCount === 0}
              onClick={onPrint}
            >
              ПЕЧАТЬ · {unsentCount}
            </button>
            <button
              type="button"
              className="mah-pos-btn"
              disabled={busy || lines.every((line) => line.status !== 'ACTIVE')}
              onClick={onPrecheck}
            >
              ПРЕЧЕК
            </button>
          </div>
        )}
      </footer>
    </>
  );
};

export const PosApp = ({ api, mode = 'embedded', initialSession = null, onSessionChange }: PosAppProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const activityRefreshSentAtRef = useRef(0);
  const activityRefreshInFlightRef = useRef(false);
  const [session, setSessionState] = useState<PosSession | null>(() => {
    if (initialSession) return initialSession;
    if (mode === 'standalone') return restorePosSession();
    return null;
  });
  const setSession = useCallback(
    (next: PosSession | null) => {
      setSessionState(next);
      onSessionChange?.(next);
      if (mode === 'standalone') {
        if (next) persistPosSession(next);
        else clearPosSession();
      }
    },
    [onSessionChange, mode],
  );
  const [pin, setPin] = useState('');
  const [rows, setRows] = useState<Record<string, PosRow[]>>({});
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Все');
  const [sheet, setSheet] = useState<SheetName>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [reservationTableId, setReservationTableId] = useState<string | null>(
    null,
  );
  const [reservationName, setReservationName] = useState('');
  const [reservationPhone, setReservationPhone] = useState('');
  const [reservationAt, setReservationAt] = useState('');
  const [reservationPrepayment, setReservationPrepayment] = useState('');
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [voidPreparedState, setVoidPreparedState] = useState<
    'PREPARED' | 'NOT_PREPARED'
  >('NOT_PREPARED');
  const [voidReason, setVoidReason] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyCommand, setBusyCommand] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [shiftCloseConfirm, setShiftCloseConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  useEffect(() => {
    if (mode === 'standalone') {
      const fitViewport = () => {
        const root = rootRef.current;
        if (!root) return;
        // Standalone owns full viewport — no CRM header/sidebar reservation.
        root.style.height = `${globalThis.innerHeight}px`;
      };
      fitViewport();
      globalThis.addEventListener('resize', fitViewport);
      const timer = globalThis.setInterval(fitViewport, 1_000);
      return () => {
        globalThis.removeEventListener('resize', fitViewport);
        globalThis.clearInterval(timer);
      };
    }
    const fitViewport = () => {
      const root = rootRef.current;
      if (!root) return;
      const top = Math.max(0, root.getBoundingClientRect().top);
      root.style.height = `${Math.max(480, globalThis.innerHeight - top)}px`;
    };
    fitViewport();
    globalThis.addEventListener('resize', fitViewport);
    const timer = globalThis.setInterval(fitViewport, 1_000);
    return () => {
      globalThis.removeEventListener('resize', fitViewport);
      globalThis.clearInterval(timer);
    };
  }, [mode]);

  const load = useCallback(async () => {
    setSyncing(true);
    try {
      const values = await Promise.all(
        CORE_COLLECTIONS.map(async (name) => [
          name,
          await api.list(name as any),
        ] as const),
      );
      const nextRows = Object.fromEntries(values) as Record<string, PosRow[]>;
      if (session?.staff.role === 'ADMIN') {
        try {
          nextRows.posStaffs = await api.list('posStaffs' as any);
        } catch {
          nextRows.posStaffs = [];
        }
      }
      setRows(nextRows);
    } catch (value: unknown) {
      const message = commandError(value);
      // Network / gateway unavailable → show operational Russian error, keep chrome stable
      const isNetworkError =
        message.includes('Нет связи') ||
        message.includes('Failed to fetch') ||
        message.includes('NetworkError') ||
        message.includes('load failed');
      if (isNetworkError) {
        setError('Нет связи с сервером. Проверьте сеть и попробуйте снова.');
      }
      throw value;
    } finally {
      setSyncing(false);
    }
  }, [api, session?.staff.role]);

  useEffect(() => {
    if (!session) return;
    void load().catch((value) => {
      const body = (value as unknown as { body?: { code?: string } })?.body;
      const code = String(body?.code ?? '');
      if (['POS_SESSION_EXPIRED', 'POS_SESSION_INVALID', 'POS_SESSION_REQUIRED', 'POS_STAFF_LOCKED', 'POS_STAFF_INACTIVE'].includes(code)) {
        setSession(null);
        setError('Сессия истекла. Введите PIN снова.');
        return;
      }
      const msg = commandError(value);
      const isNetwork = msg.includes('Нет связи') || msg.includes('Failed to fetch') || msg.includes('NetworkError');
      setError(isNetwork ? 'Нет связи с сервером. Проверьте сеть и попробуйте снова.' : msg);
    });
    const refreshTimer = globalThis.setInterval(() => {
      void load().catch((value) => {
        const body = (value as unknown as { body?: { code?: string } })?.body;
        const code = String(body?.code ?? '');
        if (['POS_SESSION_EXPIRED', 'POS_SESSION_INVALID', 'POS_SESSION_REQUIRED'].includes(code)) {
          setSession(null);
          setError('Сессия истекла. Введите PIN снова.');
          globalThis.clearInterval(refreshTimer);
          return;
        }
        setError(commandError(value));
      });
    }, 12_000);
    return () => globalThis.clearInterval(refreshTimer);
  }, [load, session, setSession]);

  useEffect(() => {
    if (!session) return;
    const clockTimer = globalThis.setInterval(() => setNow(Date.now()), 30_000);
    return () => globalThis.clearInterval(clockTimer);
  }, [session]);

  useEffect(() => {
    if (!notice) return;
    const timer = globalThis.setTimeout(() => setNotice(''), 2_800);
    return () => globalThis.clearTimeout(timer);
  }, [notice]);

  const command = useCallback(
    async (name: string, payload: Record<string, unknown>) => {
      return (await api.command(name, payload)) as ApiEnvelope;
    },
    [api],
  );

  useEffect(() => {
    if (!session) {
      activityRefreshSentAtRef.current = 0;
      activityRefreshInFlightRef.current = false;
      return;
    }

    const refreshAfterUserActivity = () => {
      const happenedAt = Date.now();
      if (
        activityRefreshInFlightRef.current ||
        happenedAt - activityRefreshSentAtRef.current < 60_000
      ) {
        return;
      }

      activityRefreshSentAtRef.current = happenedAt;
      activityRefreshInFlightRef.current = true;
      void command('refreshPosSession', {})
        .catch((value) => {
          const code = String(
            (value as unknown as { body?: { code?: string } })?.body?.code ??
              '',
          );
          if (
            [
              'POS_SESSION_EXPIRED',
              'POS_SESSION_INVALID',
              'POS_SESSION_REQUIRED',
            ].includes(code)
          ) {
            setSession(null);
            setError('Сессия истекла. Введите PIN снова.');
          }
        })
        .finally(() => {
          activityRefreshInFlightRef.current = false;
        });
    };

    globalThis.addEventListener('pointerdown', refreshAfterUserActivity, {
      passive: true,
    });
    globalThis.addEventListener('keydown', refreshAfterUserActivity);
    return () => {
      globalThis.removeEventListener('pointerdown', refreshAfterUserActivity);
      globalThis.removeEventListener('keydown', refreshAfterUserActivity);
    };
  }, [command, session, setSession]);

  const run = useCallback(
    async (
      name: string,
      payload: Record<string, unknown>,
      success?: string,
    ): Promise<ApiEnvelope | null> => {
      setBusyCommand(name);
      setError('');
      try {
        const result = await command(name, payload);
        await load();
        if (success) setNotice(success);
        return result;
      } catch (value) {
        const msg = commandError(value);
        const raw = String((value as unknown as { message?: string })?.message ?? '');
        const isFetch = raw.toLowerCase().includes('fetch') || raw.toLowerCase().includes('network') || msg.includes('Нет связи');
        if (isFetch && msg === 'Не удалось выполнить операцию. Обновите данные и попробуйте снова') {
          setError('Нет связи с сервером. Проверьте сеть и попробуйте снова.');
        } else if (String((value as unknown as { body?: { code?: string } })?.body?.code ?? '') === 'POS_SESSION_EXPIRED' || String((value as unknown as { body?: { code?: string } })?.body?.code ?? '') === 'POS_SESSION_INVALID') {
          setSession(null);
          setError('Сессия истекла. Введите PIN снова.');
        } else {
          setError(msg);
        }
        return null;
      } finally {
        setBusyCommand(null);
      }
    },
    [command, load, setSession],
  );

  const login = async () => {
    if (!/^\d{4,8}$/.test(pin)) {
      setError('Введите PIN из 4–8 цифр');
      return;
    }
    setLoginBusy(true);
    setError('');
    try {
      const nextSession = await api.loginWithPin(pin, 'touch-pos');
      setSession(nextSession);
      setPin('');
      setNotice('Добро пожаловать');
    } catch (value) {
      const msg = commandError(value);
      // Preserve existing mapping but surface network case distinctly
      const raw = (value as any)?.body?.message ?? (value as Error)?.message ?? '';
      if (String(raw).toLowerCase().includes('fetch') || String(raw).toLowerCase().includes('network')) {
        setError('Нет связи с сервером. Проверьте сеть и попробуйте снова.');
      } else {
        setError(msg);
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // The local session is still cleared when the remote session expired.
    }
    setSession(null);
    setRows({});
    setOrderId(null);
    setTableId(null);
    setSheet(null);
  };

  const zones = sortPosZones(
    (rows.posZones ?? []).filter(
      (row) => row.isActive !== false && !isSyntheticPosRecord(row),
    ),
  );
  const visibleZoneIds = new Set(zones.map((row) => row.id));
  const allTables = sortPosTables(
    (rows.posTables ?? []).filter(
      (row) =>
        row.isActive !== false &&
        !isSyntheticPosRecord(row) &&
        visibleZoneIds.has(row.zoneId),
    ),
  );
  const visibleTableIds = new Set(allTables.map((row) => row.id));
  const tables = allTables.filter((row) => !zoneId || row.zoneId === zoneId);
  const orders = (rows.posOrders ?? []).filter((row) =>
    visibleTableIds.has(row.tableId) &&
    !isSyntheticPosRecord(row) &&
    !isSyntheticPosStaffId(row.ownerStaffId),
  );
  const activeReservations = (rows.posReservations ?? []).filter(
    (row) =>
      row.status === 'ACTIVE' &&
      visibleTableIds.has(row.tableId) &&
      !isSyntheticPosRecord(row),
  );
  const selectedOrder = orders.find((row) => row.id === orderId);
  const selectedTable = allTables.find((row) => row.id === tableId);
  const selectedReservation = activeReservations.find(
    (row) => row.tableId === tableId,
  );
  const guests = (rows.posOrderGuests ?? [])
    .filter((row) => row.orderId === orderId)
    .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
  const lines = (rows.posOrderLines ?? []).filter(
    (row) => row.orderId === orderId,
  );
  const menu = sortPosMenu(
    (rows.posMenuItems ?? []).filter(
      (row) => row.isActive !== false && !isSyntheticPosRecord(row),
    ),
  );
  const stopList = new Set(
    (rows.posStopListEntries ?? [])
      .filter((row) => row.isActive !== false)
      .map((row) => row.menuItemId),
  );
  const methods = (rows.posPaymentMethods ?? [])
    .filter((row) => row.isActive !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const activeShift = (rows.posShifts ?? []).find(
    (row) => row.staffId === session?.staff.id && row.isOpen === true,
  );
  const orderPrecheck = (rows.posPrechecks ?? []).find(
    (row) => row.orderId === orderId && row.status === 'ACTIVE',
  );
  const payments = (rows.posPayments ?? []).filter(
    (row) => row.orderId === orderId && row.status === 'SUCCESS',
  );
  const orderPrepayments = (rows.posPrepayments ?? []).filter(
    (row) => row.orderId === orderId && row.status === 'APPLIED',
  );
  const totalMicros = micros(selectedOrder?.total);
  const paidMicros = Math.max(
    micros(selectedOrder?.paidTotal),
    payments.reduce((sum, row) => sum + micros(row.amount), 0),
  );
  const prepaidMicros = Math.max(
    micros(selectedOrder?.prepaidTotal),
    orderPrepayments.reduce((sum, row) => sum + micros(row.amount), 0),
  );
  const remainingMicros = Math.max(
    0,
    totalMicros - prepaidMicros - paidMicros,
  );
  const selectedPaymentMethod = methods.find((row) => row.id === paymentMethodId);
  const isCashSelected = selectedPaymentMethod?.methodType === 'CASH';
  const tenderedMicrosPreview = parseMoneyInputToMicros(paymentAmount);
  const changePreviewMicros =
    isCashSelected && tenderedMicrosPreview !== null
      ? Math.max(0, tenderedMicrosPreview - remainingMicros)
      : 0;
  const selectedGuest = guests.find(
    (row) => row.id === (guestId ?? guests[0]?.id),
  );
  const unsentCount = lines
    .filter((line) => line.status === 'ACTIVE')
    .reduce(
      (sum, line) =>
        sum +
        Math.max(
          0,
          Number(line.quantity ?? 0) - Number(line.kitchenSentQuantity ?? 0),
        ),
      0,
    );
  const sentCount = lines
    .filter((line) => line.status === 'ACTIVE')
    .reduce(
      (sum, line) =>
        sum +
        Math.min(
          Number(line.quantity ?? 0),
          Number(line.kitchenSentQuantity ?? 0),
        ),
      0,
    );
  const staffNames = useMemo(
    () =>
      new Map(
        (rows.posStaffs ?? [])
          .filter((staff) => !isSyntheticPosRecord(staff))
          .map((staff) => [
          staff.id,
          String(staff.displayName ?? 'Сотрудник'),
          ]),
      ),
    [rows.posStaffs],
  );
  const recentOrders = orders.filter(
    (order) =>
      isActiveOrder(order) && order.ownerStaffId === session?.staff.id,
  );
  const busy = Boolean(busyCommand);
  const initialLoading = session !== null && !rows.posZones;

  useEffect(() => {
    if (!zoneId && zones[0]) setZoneId(zones[0].id);
  }, [zoneId, zones]);

  useEffect(() => {
    if (!guestId && guests[0]) setGuestId(guests[0].id);
    if (guestId && !guests.some((guest) => guest.id === guestId)) {
      setGuestId(guests[0]?.id ?? null);
    }
  }, [guestId, guests]);

  useEffect(() => {
    if (!paymentMethodId && methods[0]) setPaymentMethodId(methods[0].id);
  }, [methods, paymentMethodId]);

  const selectTable = (table: PosRow) => {
    setTableId(table.id);
    setReservationTableId(table.id);
    setError('');
    const existing = orders.find(
      (row) => row.tableId === table.id && isActiveOrder(row),
    );
    setOrderId(existing?.id ?? null);
  };

  const openTable = async (
    reservation?: PosRow,
    explicitTable?: PosRow,
  ) => {
    const targetTable = explicitTable ?? selectedTable;
    if (!targetTable || !activeShift) {
      setError('Сначала откройте смену');
      return;
    }
    setBusyCommand('openOrder');
    setError('');
    try {
      const result = await command('openOrder', {
        tableId: targetTable.id,
        idempotencyKey: uuid(),
      });
      const nextOrderId = String(result.orderId ?? '');
      if (!nextOrderId) throw new Error('Заказ создан без идентификатора');
      if (reservation) {
        await command('attachReservationToOrder', {
          reservationId: reservation.id,
          orderId: nextOrderId,
          idempotencyKey: uuid(),
        });
      }
      setTableId(targetTable.id);
      setZoneId(targetTable.zoneId ?? zoneId);
      setOrderId(nextOrderId);
      await load();
      setNotice(
        reservation
          ? `Бронь привязана к столу ${targetTable.number}`
          : `Стол ${targetTable.number} открыт`,
      );
      setSheet(null);
    } catch (value) {
      setError(commandError(value));
    } finally {
      setBusyCommand(null);
    }
  };

  const addGuest = async () => {
    if (!orderId) return;
    const result = await run(
      'addGuest',
      {
        orderId,
        idempotencyKey: uuid(),
        name: `Гость ${guests.length + 1}`,
      },
      'Гость добавлен',
    );
    if (result?.guestId) setGuestId(String(result.guestId));
  };

  const addLine = (item: PosRow) => {
    if (!orderId || !selectedGuest || stopList.has(item.id) || orderPrecheck)
      return;
    void run(
      'addLine',
      {
        orderId,
        guestId: selectedGuest.id,
        menuItemId: item.id,
        quantity: 1,
        idempotencyKey: uuid(),
      },
      `${item.name} · добавлено`,
    );
  };

  const changeQuantity = (line: PosRow, quantity: number) => {
    if (orderPrecheck || quantity < 1) return;
    void run(
      'changeLineQuantity',
      { lineId: line.id, quantity },
      'Количество обновлено',
    );
  };

  const createReservation = async () => {
    if (!reservationTableId) {
      setError('Выберите стол для бронирования');
      return;
    }
    const prepayment = reservationPrepayment
      ? parseMoneyInputToMicros(reservationPrepayment)
      : null;
    if (reservationPrepayment && prepayment === null) {
      setError('Введите корректную сумму предоплаты');
      return;
    }
    setBusyCommand('createReservation');
    setError('');
    try {
      const result = await command('createReservation', {
        tableId: reservationTableId,
        ...(reservationAt
          ? { scheduledAt: new Date(reservationAt).toISOString() }
          : {}),
        ...(reservationName.trim() ? { guestName: reservationName.trim() } : {}),
        ...(reservationPhone.trim() ? { phone: reservationPhone.trim() } : {}),
        idempotencyKey: uuid(),
      });
      if (prepayment && result.reservationId) {
        await command('createPrepayment', {
          reservationId: result.reservationId,
          ...(paymentMethodId ? { paymentMethodId } : {}),
          amountMicros: prepayment,
          idempotencyKey: uuid(),
        });
      }
      await load();
      setReservationName('');
      setReservationPhone('');
      setReservationAt('');
      setReservationPrepayment('');
      setNotice(
        prepayment
          ? 'Бронирование и предоплата сохранены'
          : 'Бронирование сохранено',
      );
    } catch (value) {
      setError(commandError(value));
    } finally {
      setBusyCommand(null);
    }
  };

  const recordPayment = async () => {
    const amountMicros = parseMoneyInputToMicros(paymentAmount);
    if (!orderId || !paymentMethodId || amountMicros === null) {
      setError('Введите корректную сумму оплаты');
      return;
    }
    const selectedMethod = (rows.posPaymentMethods ?? []).find((row) => row.id === paymentMethodId);
    const isCash = selectedMethod?.methodType === 'CASH';
    const payload: Record<string, unknown> = {
      orderId,
      paymentMethodId,
      amountMicros,
      idempotencyKey: uuid(),
    };
    if (isCash) payload.tenderedAmountMicros = amountMicros;
    const result = await run('recordPayment', payload, 'Оплата принята');
    if (result) {
      // Show change toast for cash when server returns changeMicros
      const changeMicros = Number((result as any)?.changeMicros ?? 0);
      if (isCash && changeMicros > 0) {
        setNotice(`Сдача ${money(changeMicros)}`);
      }
      setPaymentAmount('');
    }
  };

  const closeOrder = async () => {
    if (!orderId) return;
    const result = await run(
      'closeOrder',
      { orderId, idempotencyKey: uuid() },
      'Заказ закрыт · стол свободен',
    );
    if (result) {
      setOrderId(null);
      setGuestId(null);
      setSheet(null);
    }
  };

  const voidSelectedLines = async () => {
    if (!selectedLineIds.length) return;
    const result = await run(
      'voidOrderLines',
      {
        lineIds: selectedLineIds,
        preparedState: voidPreparedState,
        ...(voidReason.trim() ? { reason: voidReason.trim() } : {}),
        idempotencyKey: uuid(),
      },
      'Позиции отменены',
    );
    if (result) {
      setSelectedLineIds([]);
      setVoidReason('');
      setSheet('admin');
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    const result = await run(action.command, action.payload, action.success);
    if (result) {
      setPendingAction(null);
      setSheet(action.returnTo);
      if (action.command === 'transferOrderLinesToGuest') {
        setSelectedLineIds([]);
      }
    }
  };

  if (!session) {
    return (
      <div className="mah-pos" ref={rootRef}>
        <style>{POS_UI_CSS}</style>
        <LoginView
          pin={pin}
          busy={loginBusy}
          error={error}
          onPinChange={(value) =>
            setPin(value.replace(/\D/g, '').slice(0, 8))
          }
          onLogin={() => void login()}
        />
      </div>
    );
  }

  const currentZoneName = zones.find((zone) => zone.id === zoneId)?.name ?? 'Зал';
  const activeLines = lines.filter((line) => line.status === 'ACTIVE');
  const selectedLines = activeLines.filter((line) =>
    selectedLineIds.includes(line.id),
  );
  const selectedLinesWereSent = selectedLines.some(
    (line) => Number(line.kitchenSentQuantity ?? 0) > 0,
  );

  return (
    <div className="mah-pos" ref={rootRef}>
      <style>{POS_UI_CSS}</style>
      <PosHeader
        session={session}
        activeShift={activeShift}
        reservationCount={activeReservations.length}
        overdueCount={activeReservations.filter((item) => isOverdueReservation(item, now)).length}
        now={now}
        syncing={syncing}
        onReservation={() => {
          setReservationTableId(tableId ?? allTables[0]?.id ?? null);
          setSheet('reservation');
        }}
        onSessionMenu={() => setSheet('session')}
      />
      <div className="mah-pos-shell">
        <ZoneNavigation
          zones={zones}
          zoneId={zoneId}
          reservations={activeReservations}
          now={now}
          onZone={(id) => {
            setZoneId(id);
            setTableId(null);
            setOrderId(null);
          }}
          onReservations={() => setSheet('reservation')}
        />
        <main className="mah-pos-workspace">
          <TableBoard
            zoneName={currentZoneName}
            tables={tables}
            orders={orders}
            reservations={activeReservations}
            staffNames={staffNames}
            currentStaffId={session.staff.id}
            selectedTableId={tableId}
            now={now}
            loading={initialLoading}
            onSelect={selectTable}
          />
          <MenuBrowser
            menu={menu}
            stopList={stopList}
            search={search}
            category={category}
            selectedGuest={selectedGuest}
            orderLocked={Boolean(orderPrecheck)}
            busy={busy}
            onSearch={setSearch}
            onCategory={setCategory}
            onItem={addLine}
            onStopList={() => setSheet('stop-list')}
          />
        </main>
        <aside className="mah-pos-panel">
          {selectedOrder ? (
            <OrderPanel
              session={session}
              order={selectedOrder}
              table={selectedTable}
              guests={guests}
              lines={lines}
              selectedGuest={selectedGuest}
              precheck={orderPrecheck}
              totalMicros={totalMicros}
              prepaidMicros={prepaidMicros}
              paidMicros={paidMicros}
              remainingMicros={remainingMicros}
              unsentCount={unsentCount}
              sentCount={sentCount}
              busy={busy}
              onGuest={setGuestId}
              onAddGuest={() => void addGuest()}
              onQuantity={changeQuantity}
              onPrint={() =>
                void run(
                  'printKitchenTicket',
                  { orderId: selectedOrder.id, idempotencyKey: uuid() },
                  'Новые блюда отправлены на кухню',
                )
              }
              onPrecheck={() =>
                void run(
                  'createPrecheck',
                  { orderId: selectedOrder.id, idempotencyKey: uuid() },
                  'Пречек сформирован · заказ заблокирован',
                )
              }
              onPayment={() => {
                setPaymentAmount(formatMicrosForInput(remainingMicros));
                setSheet('payment');
              }}
              onCloseOrder={() => void closeOrder()}
              onAdmin={() => setSheet('admin')}
            />
          ) : selectedTable ? (
            <TableContextPanel
              table={selectedTable}
              reservation={selectedReservation}
              activeShift={activeShift}
              busy={busy}
              now={now}
              onOpen={() => void openTable(selectedReservation)}
              onReserve={() => {
                setReservationTableId(selectedTable.id);
                setSheet('reservation');
              }}
            />
          ) : (
            <EmptyOrderPanel
              session={session}
              activeShift={activeShift}
              recentOrders={recentOrders}
              tables={allTables}
              onOrder={(order) => {
                setOrderId(order.id);
                setTableId(order.tableId ?? null);
              }}
              onOpenShift={() =>
                void run(
                  'openShift',
                  { idempotencyKey: uuid() },
                  'Смена открыта',
                )
              }
            />
          )}
        </aside>
      </div>

      {sheet === 'payment' && selectedOrder && (
        <Sheet
          title="Оплата"
          subtitle={`Стол ${selectedTable?.number ?? '—'}`}
          onClose={() => setSheet(null)}
          footer={
            remainingMicros === 0 ? (
              <button
                type="button"
                className="mah-pos-btn success"
                style={{ width: '100%' }}
                disabled={busy}
                onClick={() => void closeOrder()}
              >
                ЗАКРЫТЬ СТОЛ
              </button>
            ) : (
              <button
                type="button"
                className="mah-pos-btn primary"
                style={{ width: '100%' }}
                disabled={busy || !paymentMethodId || !paymentAmount}
                onClick={() => void recordPayment()}
              >
                ПРИНЯТЬ ОПЛАТУ
              </button>
            )
          }
        >
          <div className="mah-pos-sheet-section">
            <div className="mah-pos-payment-summary">
              <div className="mah-pos-total-row">
                <span>Итого</span>
                <strong>{money(totalMicros)}</strong>
              </div>
              {prepaidMicros > 0 && (
                <div className="mah-pos-total-row">
                  <span>Предоплата</span>
                  <strong>− {money(prepaidMicros)}</strong>
                </div>
              )}
              {payments.map((payment) => (
                <div className="mah-pos-total-row" key={payment.id}>
                  <span>{payment.paymentMethodNameSnapshot ?? 'Оплата'}</span>
                  <strong>− {money(payment.amount)}</strong>
                </div>
              ))}
              <div className="mah-pos-total-row total">
                <span>Осталось</span>
                <strong>{money(remainingMicros)}</strong>
              </div>
            </div>
          </div>
          {remainingMicros === 0 ? (
            <div className="mah-pos-payment-paid">
              <strong>ОПЛАЧЕНО</strong>
              Все платежи записаны. Стол можно закрыть.
            </div>
          ) : (
            <>
              <div className="mah-pos-sheet-section">
                <h3>Способ оплаты</h3>
                <div className="mah-pos-payment-methods">
                  {methods.map((method) => (
                    <button
                      type="button"
                      key={method.id}
                      className={`mah-pos-payment-method ${paymentMethodId === method.id ? 'selected' : ''}`}
                      onClick={() => setPaymentMethodId(method.id)}
                    >
                      {method.name}
                    </button>
                  ))}
                </div>
              </div>
              {isCashSelected ? (
                <div className="mah-pos-sheet-section">
                  <div className="mah-pos-payment-summary" style={{ marginBottom: 12 }}>
                    <div className="mah-pos-total-row">
                      <span>К оплате</span>
                      <strong>{money(remainingMicros)}</strong>
                    </div>
                  </div>
                  <label className="mah-pos-field">
                    Получено, ₸
                    <input
                      className="mah-pos-input"
                      inputMode="decimal"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder="0"
                      autoFocus
                    />
                  </label>
                  <div
                    className="mah-pos-total-row total"
                    style={{
                      marginTop: 12,
                      padding: '10px 12px',
                      background: changePreviewMicros > 0 ? '#0a6b2a' : '#f3f4f6',
                      color: changePreviewMicros > 0 ? '#fff' : '#111',
                      borderRadius: 10,
                      fontSize: changePreviewMicros > 0 ? '18px' : '16px',
                      fontWeight: 800,
                    }}
                  >
                    <span>Сдача</span>
                    <strong>{money(changePreviewMicros)}</strong>
                  </div>
                  <div className="mah-pos-quick-amounts" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentAmount(formatMicrosForInput(remainingMicros))
                      }
                    >
                      Весь остаток
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentAmount(
                          formatMicrosForInput(remainingMicros + 3000000000),
                        )
                      }
                    >
                      +3 000
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentAmount(
                          formatMicrosForInput(remainingMicros + 5000000000),
                        )
                      }
                    >
                      +5 000
                    </button>
                  </div>
                  {tenderedMicrosPreview !== null && tenderedMicrosPreview < remainingMicros && (
                    <div style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>
                      Частичная оплата · останется {money(remainingMicros - tenderedMicrosPreview)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mah-pos-sheet-section">
                  <h3>Сумма</h3>
                  <label className="mah-pos-field">
                    Сумма, ₸
                    <input
                      className="mah-pos-input"
                      inputMode="decimal"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder="0"
                      autoFocus
                    />
                  </label>
                  <div className="mah-pos-quick-amounts">
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentAmount(formatMicrosForInput(remainingMicros))
                      }
                    >
                      Весь остаток
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentAmount(
                          formatMicrosForInput(Math.floor(remainingMicros / 2)),
                        )
                      }
                    >
                      Половина
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Sheet>
      )}

      {sheet === 'reservation' && (
        <Sheet
          title="Бронирования"
          subtitle="Стол обязателен, остальные поля можно пропустить"
          onClose={() => setSheet(null)}
          wide
        >
          <div className="mah-pos-sheet-section">
            <h3>Новая бронь</h3>
            <div className="mah-pos-form two">
              <label className="mah-pos-field wide">
                Стол
                <select
                  className="mah-pos-select"
                  value={reservationTableId ?? ''}
                  onChange={(event) => setReservationTableId(event.target.value)}
                >
                  <option value="">Выберите стол</option>
                  {allTables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {zones.find((zone) => zone.id === table.zoneId)?.name ?? 'Зал'} · Стол {table.number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mah-pos-field">
                Имя гостя
                <input
                  className="mah-pos-input"
                  value={reservationName}
                  onChange={(event) => setReservationName(event.target.value)}
                  placeholder="Необязательно"
                />
              </label>
              <label className="mah-pos-field">
                Телефон
                <input
                  className="mah-pos-input"
                  value={reservationPhone}
                  onChange={(event) => setReservationPhone(event.target.value)}
                  placeholder="Необязательно"
                />
              </label>
              <label className="mah-pos-field">
                Дата и время
                <input
                  className="mah-pos-input"
                  type="datetime-local"
                  value={reservationAt}
                  onChange={(event) => setReservationAt(event.target.value)}
                />
              </label>
              <label className="mah-pos-field">
                Предоплата, ₸
                <input
                  className="mah-pos-input"
                  inputMode="decimal"
                  value={reservationPrepayment}
                  onChange={(event) =>
                    setReservationPrepayment(event.target.value)
                  }
                  placeholder="Необязательно"
                />
              </label>
              {reservationPrepayment && (
                <label className="mah-pos-field wide">
                  Способ предоплаты
                  <select
                    className="mah-pos-select"
                    value={paymentMethodId ?? ''}
                    onChange={(event) => setPaymentMethodId(event.target.value)}
                  >
                    {methods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="mah-pos-btn primary wide"
                disabled={!reservationTableId || busy}
                onClick={() => void createReservation()}
              >
                ЗАБРОНИРОВАТЬ
              </button>
            </div>
          </div>
          <div className="mah-pos-sheet-section">
            <h3>Активные · {activeReservations.length}</h3>
            <div className="mah-pos-reservation-list">
              {activeReservations.length ? (
                activeReservations.map((reservation) => {
                  const table = allTables.find(
                    (item) => item.id === reservation.tableId,
                  );
                  const overdue = isOverdueReservation(reservation, now);
                  const prepayments = (rows.posPrepayments ?? []).filter(
                    (item) => item.reservationId === reservation.id,
                  );
                  const prepaymentTotal = prepayments.reduce(
                    (sum, item) => sum + micros(item.amount),
                    0,
                  );
                  return (
                    <article
                      className={`mah-pos-reservation-item ${overdue ? 'overdue' : ''}`}
                      key={reservation.id}
                    >
                      <div className="mah-pos-reservation-item-head">
                        <strong>
                          Стол {table?.number ?? '—'} ·{' '}
                          {reservation.guestName || 'Без имени'}
                        </strong>
                        <time className={overdue ? 'mah-pos-negative-time' : ''}>
                          {overdue
                            ? formatNegativeTimer(reservation.scheduledAt, now)
                            : timeOnly(reservation.scheduledAt)}
                        </time>
                      </div>
                      <div className="mah-pos-reservation-item-meta">
                        {reservation.phone && <span>{reservation.phone}</span>}
                        {prepaymentTotal > 0 && (
                          <span>Предоплата {money(prepaymentTotal)}</span>
                        )}
                        {!reservation.scheduledAt && <span>Без времени</span>}
                      </div>
                      <div className="mah-pos-reservation-item-actions">
                        <button
                          type="button"
                          className="mah-pos-btn primary"
                          disabled={!activeShift || busy || !table}
                          onClick={() => {
                            if (table) void openTable(reservation, table);
                          }}
                        >
                          Открыть заказ
                        </button>
                        <button
                          type="button"
                          className="mah-pos-btn"
                          disabled={busy}
                          onClick={() => {
                            setPendingAction({
                              title: 'Отметить гостей как не пришедших?',
                              description:
                                'Бронирование останется в истории со статусом «Не пришли».',
                              command: 'updateReservationStatus',
                              payload: {
                                reservationId: reservation.id,
                                status: 'NO_SHOW',
                                idempotencyKey: uuid(),
                              },
                              success: 'Отмечено: гости не пришли',
                              returnTo: 'reservation',
                              danger: true,
                            });
                            setSheet('confirm');
                          }}
                        >
                          Не пришли
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="mah-pos-empty-lines">
                  Активных бронирований нет
                </div>
              )}
            </div>
          </div>
        </Sheet>
      )}

      {sheet === 'stop-list' && (
        <Sheet
          title="Стоп-лист"
          subtitle="Изменения проверяются сервером при каждом добавлении блюда"
          onClose={() => setSheet(null)}
        >
          <div className="mah-pos-stop-list">
            {menu.map((item) => {
              const stopped = stopList.has(item.id);
              return (
                <div
                  className={`mah-pos-stop-row ${stopped ? 'stopped' : ''}`}
                  key={item.id}
                >
                  <div>
                    <strong>{item.name}</strong>
                    <small>{money(item.price)}</small>
                  </div>
                  <button
                    type="button"
                    className={`mah-pos-btn ${stopped ? 'success' : 'danger'}`}
                    disabled={busy}
                    onClick={() =>
                      void run(
                        stopped
                          ? 'clearStopListEntry'
                          : 'addStopListEntry',
                        { menuItemId: item.id, idempotencyKey: uuid() },
                        stopped
                          ? 'Блюдо снова доступно'
                          : 'Блюдо добавлено в стоп-лист',
                      )
                    }
                  >
                    {stopped ? 'Вернуть' : 'Нет в наличии'}
                  </button>
                </div>
              );
            })}
          </div>
        </Sheet>
      )}

      {sheet === 'admin' && selectedOrder && session.staff.role === 'ADMIN' && (
        <Sheet
          title="Действия администратора"
          subtitle={`Стол ${selectedTable?.number ?? '—'} · изменения попадут в аудит`}
          onClose={() => setSheet(null)}
          wide
        >
          {orderPrecheck && (
            <div className="mah-pos-admin-block danger">
              <h3>Пречек</h3>
              <button
                type="button"
                className="mah-pos-btn danger"
                style={{ width: '100%' }}
                disabled={busy}
                onClick={() => {
                  setPendingAction({
                    title: 'Отменить пречек?',
                    description:
                      'Заказ снова станет доступен для изменений. Действие сохранится в аудите.',
                    command: 'cancelPrecheck',
                    payload: {
                      orderId: selectedOrder.id,
                      idempotencyKey: uuid(),
                    },
                    success: 'Пречек отменён · заказ снова доступен',
                    returnTo: 'admin',
                    danger: true,
                  });
                  setSheet('confirm');
                }}
              >
                Отменить пречек
              </button>
            </div>
          )}
          <div className="mah-pos-admin-block">
            <h3>Перенести заказ</h3>
            <div className="mah-pos-form two">
              <label className="mah-pos-field">
                Другой стол
                <select
                  className="mah-pos-select"
                  defaultValue=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    const targetTable = allTables.find(
                      (table) => table.id === event.target.value,
                    );
                    setPendingAction({
                      title: `Перенести заказ на стол ${targetTable?.number ?? '—'}?`,
                      description:
                        'Текущий стол освободится, а заказ и его история сохранятся.',
                      command: 'transferOrderToTable',
                      payload: {
                        orderId: selectedOrder.id,
                        targetTableId: event.target.value,
                        idempotencyKey: uuid(),
                      },
                      success: 'Заказ перенесён на другой стол',
                      returnTo: 'admin',
                    });
                    setSheet('confirm');
                  }}
                >
                  <option value="">Выберите стол…</option>
                  {allTables
                    .filter(
                      (table) =>
                        table.id !== selectedOrder.tableId &&
                        !orders.some(
                          (order) =>
                            order.tableId === table.id && isActiveOrder(order),
                        ),
                    )
                    .map((table) => (
                      <option key={table.id} value={table.id}>
                        Стол {table.number}
                      </option>
                    ))}
                </select>
              </label>
              <label className="mah-pos-field">
                Другому официанту
                <select
                  className="mah-pos-select"
                  defaultValue=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    const targetStaff = (rows.posStaffs ?? []).find(
                      (staff) => staff.id === event.target.value,
                    );
                    setPendingAction({
                      title: `Передать заказ сотруднику ${targetStaff?.displayName ?? '—'}?`,
                      description:
                        'Новый сотрудник станет владельцем заказа. Изменение сохранится в аудите.',
                      command: 'transferOrderToWaiter',
                      payload: {
                        orderId: selectedOrder.id,
                        targetStaffId: event.target.value,
                        idempotencyKey: uuid(),
                      },
                      success: 'Заказ передан другому официанту',
                      returnTo: 'admin',
                    });
                    setSheet('confirm');
                  }}
                >
                  <option value="">Выберите сотрудника…</option>
                  {(rows.posStaffs ?? [])
                    .filter(
                      (staff) =>
                        staff.isActive !== false &&
                        staff.id !== selectedOrder.ownerStaffId,
                    )
                    .map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.displayName}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>
          <div className="mah-pos-admin-block danger">
            <h3>Позиции заказа</h3>
            <div className="mah-pos-line-picker">
              {activeLines.map((line) => (
                <label className="mah-pos-check-line" key={line.id}>
                  <input
                    type="checkbox"
                    checked={selectedLineIds.includes(line.id)}
                    onChange={(event) =>
                      setSelectedLineIds((current) =>
                        event.target.checked
                          ? [...current, line.id]
                          : current.filter((id) => id !== line.id),
                      )
                    }
                  />
                  <span>
                    {line.itemNameSnapshot} · {line.quantity} ×{' '}
                    {money(line.unitPrice)}
                  </span>
                </label>
              ))}
            </div>
            <div className="mah-pos-actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="mah-pos-btn danger"
                disabled={!selectedLineIds.length}
                onClick={() => setSheet('void')}
              >
                Отменить выбранное
              </button>
              <select
                className="mah-pos-select"
                defaultValue=""
                disabled={!selectedLineIds.length}
                onChange={(event) => {
                  if (!event.target.value) return;
                  const targetGuest = guests.find(
                    (guest) => guest.id === event.target.value,
                  );
                  setPendingAction({
                    title: `Перенести ${selectedLineIds.length} поз. гостю ${targetGuest?.displayNumber ?? targetGuest?.name ?? '—'}?`,
                    description:
                      'Позиции останутся в этом заказе, но изменят гостя. Действие сохранится в аудите.',
                    command: 'transferOrderLinesToGuest',
                    payload: {
                      lineIds: selectedLineIds,
                      targetGuestId: event.target.value,
                      idempotencyKey: uuid(),
                    },
                    success: 'Позиции перенесены другому гостю',
                    returnTo: 'admin',
                  });
                  setSheet('confirm');
                }}
              >
                <option value="">Перенести гостю…</option>
                {guests.map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {guest.displayNumber ?? guest.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Sheet>
      )}

      {sheet === 'void' && session.staff.role === 'ADMIN' && (
        <Sheet
          title="Отмена блюда"
          subtitle={`${selectedLines.length} позиций · запись останется в истории`}
          onClose={() => setSheet('admin')}
          footer={
            <button
              type="button"
              className="mah-pos-btn danger"
              style={{ width: '100%' }}
              disabled={busy || !selectedLines.length}
              onClick={() => void voidSelectedLines()}
            >
              ПОДТВЕРДИТЬ ОТМЕНУ
            </button>
          }
        >
          {selectedLinesWereSent && (
            <div className="mah-pos-confirm">
              <strong>Будет создана отмена для кухни</strong>
              Отправленные позиции попадут в cancellation kitchen ticket.
            </div>
          )}
          <div className="mah-pos-sheet-section" style={{ marginTop: 16 }}>
            <h3>Состояние приготовления</h3>
            <div className="mah-pos-radio-grid">
              {(
                [
                  ['PREPARED', 'Было приготовлено'],
                  ['NOT_PREPARED', 'Не было приготовлено'],
                ] as const
              ).map(([value, label]) => (
                <label
                  className={`mah-pos-radio ${voidPreparedState === value ? 'selected' : ''}`}
                  key={value}
                >
                  <input
                    type="radio"
                    name="prepared-state"
                    checked={voidPreparedState === value}
                    onChange={() => setVoidPreparedState(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <label className="mah-pos-field">
            Причина
            <textarea
              className="mah-pos-textarea"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder="Необязательно"
            />
          </label>
        </Sheet>
      )}

      {sheet === 'confirm' && pendingAction && (
        <Sheet
          title={pendingAction.title}
          subtitle="Проверьте действие перед подтверждением"
          onClose={() => {
            setSheet(pendingAction.returnTo);
            setPendingAction(null);
          }}
          footer={
            <div className="mah-pos-actions">
              <button
                type="button"
                className="mah-pos-btn"
                onClick={() => {
                  setSheet(pendingAction.returnTo);
                  setPendingAction(null);
                }}
              >
                Назад
              </button>
              <button
                type="button"
                className={`mah-pos-btn ${pendingAction.danger ? 'danger' : 'primary'}`}
                disabled={busy}
                onClick={() => void confirmAction()}
              >
                ПОДТВЕРДИТЬ
              </button>
            </div>
          }
        >
          <div className="mah-pos-confirm">
            <strong>{pendingAction.title}</strong>
            {pendingAction.description}
          </div>
        </Sheet>
      )}

      {sheet === 'session' && (
        <Sheet
          title="Смена и сотрудник"
          subtitle={`${session.staff.displayName} · ${session.staff.role === 'ADMIN' ? 'Администратор' : 'Официант'}`}
          onClose={() => {
            setShiftCloseConfirm(false);
            setSheet(null);
          }}
        >
          <div className="mah-pos-sheet-section">
            <div className="mah-pos-payment-summary">
              <div className="mah-pos-total-row">
                <span>Статус</span>
                <strong>{activeShift ? 'Открыта' : 'Закрыта'}</strong>
              </div>
              {activeShift && (
                <>
                  <div className="mah-pos-total-row">
                    <span>Начало</span>
                    <strong>{dateTime(activeShift.openedAt)}</strong>
                  </div>
                  <div className="mah-pos-total-row">
                    <span>Длительность</span>
                    <strong>
                      {formatShiftDuration(activeShift.openedAt, now)}
                    </strong>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="mah-pos-form">
            {!activeShift ? (
              <button
                type="button"
                className="mah-pos-btn primary"
                disabled={busy}
                onClick={() =>
                  void run(
                    'openShift',
                    { idempotencyKey: uuid() },
                    'Смена открыта',
                  )
                }
              >
                Открыть смену
              </button>
            ) : shiftCloseConfirm ? (
              <div className="mah-pos-confirm">
                <strong>Закрыть текущую смену?</strong>
                Открытые заказы и столы останутся активными.
                <div className="mah-pos-actions" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="mah-pos-btn"
                    onClick={() => setShiftCloseConfirm(false)}
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    className="mah-pos-btn danger"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        'closeShift',
                        { shiftId: activeShift.id },
                        'Смена закрыта · открытые столы сохранены',
                      )
                    }
                  >
                    Закрыть смену
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="mah-pos-btn danger"
                onClick={() => setShiftCloseConfirm(true)}
              >
                Закрыть смену
              </button>
            )}
            <button
              type="button"
              className="mah-pos-btn"
              disabled={syncing}
              onClick={() =>
                void load().catch((value) => setError(commandError(value)))
              }
            >
              {syncing ? 'Обновляем…' : 'Обновить данные'}
            </button>
            <button
              type="button"
              className="mah-pos-btn ghost"
              onClick={() => void logout()}
            >
              Выйти из POS
            </button>
          </div>
        </Sheet>
      )}

      {(notice || error) && (
        <div className="mah-pos-toast-stack" aria-live="polite">
          {notice && <div className="mah-pos-toast">{notice}</div>}
          {error && <div className="mah-pos-toast error">{error}</div>}
        </div>
      )}
    </div>
  );
};

export default PosApp;

