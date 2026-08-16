import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useRecordId } from 'twenty-sdk/front-component';

import { CUSTOMER_360_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

type Money = { amountMicros?: number | string | null; currencyCode?: string | null };
type Connection<T> = { edges?: Array<{ node?: T | null } | null> | null };
type OrderItem = { id: string; orderId?: string | null; name?: string | null; quantity?: number | null; total?: Money | null };
type Order = { id: string; name?: string | null; channel?: string | null; status?: string | null; orderedAt?: string | null; total?: Money | null; items?: OrderItem[] | null };
type Reservation = { id: string; reservationTime?: string | null; guestCount?: number | null; status?: string | null; zone?: string | null; table?: string | null };
type LedgerEntry = { id: string; entryType?: string | null; amount?: number | null; occurredAt?: string | null; reason?: string | null };
type LoyaltyAdjustmentRequest = { id: string; status?: string | null; error?: string | null };
type LoyaltyAdjustmentRequestQueryResult = {
  loyaltyAdjustmentRequests?: Connection<LoyaltyAdjustmentRequest> | null;
};
type LoyaltyAdjustmentRequestRouteResult = { id?: string; status?: string };
type CoreQueryClient = { query: <T>(query: unknown) => Promise<T> };
type SectionStatus = 'loading' | 'ready' | 'error';
type Customer = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  phones?: { primaryPhoneNumber?: string | null } | null;
  normalizedPhone?: string | null;
  customerStatus?: string | null;
  customerSource?: string | null;
  firstInteractionAt?: string | null;
  lastActivityAt?: string | null;
};

const statusLabel: Record<string, string> = {
  DINE_IN: 'В зале', DELIVERY: 'Доставка', PICKUP: 'Самовывоз',
  PENDING: 'Ожидает', CONFIRMED: 'Подтверждён', PREPARING: 'Готовится',
  READY: 'Готов', COMPLETED: 'Завершён', CANCELLED: 'Отменён', REJECTED: 'Отклонён',
  PLANNED: 'Запланирована', NO_SHOW: 'Не пришёл', EARN: 'Начисление',
  REDEEM: 'Списание', ADJUSTMENT: 'Корректировка',
  NEW: 'Новый', ACTIVE: 'Активный', VIP: 'VIP', INACTIVE: 'Неактивный',
  BLOCKED: 'Заблокирован', WEBSITE: 'Сайт', INSTAGRAM: 'Instagram',
  WHATSAPP: 'WhatsApp', PHONE: 'Звонок', RECOMMENDATION: 'Рекомендация',
  WALK_IN: 'Пришёл в ресторан', PARTNER: 'Партнёр', OTHER: 'Другое',
};

const dateTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat('ru-KZ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—';

const money = (value?: Money | null) => {
  if (value?.amountMicros === null || value?.amountMicros === undefined) return '—';
  const tenge = BigInt(String(value.amountMicros)) / 1_000_000n;
  return new Intl.NumberFormat('ru-KZ', { style: 'currency', currency: value.currencyCode ?? 'KZT', maximumFractionDigits: 0 }).format(tenge);
};

const cardStyle = { border: '1px solid #e8e8e8', borderRadius: '8px', padding: '14px', background: '#fff' };
const retryButtonStyle = { marginLeft: '8px', padding: '4px 8px', border: '1px solid #98a2b3', borderRadius: '5px', background: '#fff', cursor: 'pointer' };

const nodes = <T,>(connection?: Connection<T> | null): T[] =>
  (connection?.edges ?? []).flatMap((edge) => edge?.node ? [edge.node] : []);

const isValidAdjustmentAmount = (value: string): boolean => {
  if (!/^-?\d+$/.test(value)) return false;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount !== 0 && Math.abs(amount) <= 100_000;
};

const createAdjustmentIdempotencyKey = (): string => {
  const bytes = new Uint8Array(16);
  const webCrypto = globalThis.crypto;

  try {
    if (typeof webCrypto?.getRandomValues !== 'function') throw new Error('getRandomValues unavailable');
    webCrypto.getRandomValues(bytes);
  } catch {
    const seed = Date.now();
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (seed + index * 31 + Math.floor(Math.random() * 256)) & 0xff;
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => { setTimeout(resolve, milliseconds); });

const Customer360 = () => {
  const recordId = useRecordId();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersStatus, setOrdersStatus] = useState<SectionStatus>('loading');
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationsStatus, setReservationsStatus] = useState<SectionStatus>('loading');
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loyaltyStatus, setLoyaltyStatus] = useState<SectionStatus>('loading');
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [adjustmentNotice, setAdjustmentNotice] = useState<string | null>(null);
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);
  const adjustmentIdempotencyKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!recordId) {
      setLoading(false);
      setError('Не выбран клиент.');
      return;
    }
    setLoading(true);
    setError(null);
    setOrdersStatus('loading');
    setOrdersError(null);
    setReservationsStatus('loading');
    setReservationsError(null);
    setLoyaltyStatus('loading');
    setLoyaltyError(null);

    const client = new CoreApiClient() as unknown as CoreQueryClient;

    try {
      const personResult = await client.query<{ person?: Customer | null }>({
        person: {
          __args: { filter: { id: { eq: recordId } } },
          id: true,
          name: { firstName: true, lastName: true },
          phones: { primaryPhoneNumber: true },
          normalizedPhone: true,
          customerStatus: true,
          customerSource: true,
          firstInteractionAt: true,
          lastActivityAt: true,
        },
      });
      const person = personResult.person;
      if (!person) {
        setCustomer(null);
        return;
      }
      setCustomer(person);
    } catch (loadError) {
      setCustomer(null);
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить данные клиента.');
      return;
    } finally {
      setLoading(false);
    }

    const loadOrders = async () => {
      try {
        const ordersResult = await client.query<{ orders?: Connection<Order> | null }>({
          orders: {
            __args: { filter: { customerId: { eq: recordId } }, first: 100 },
            edges: {
              node: {
                id: true, name: true, channel: true, status: true, orderedAt: true,
                total: { amountMicros: true, currencyCode: true },
              },
            },
          },
        });
        const orderIds = nodes(ordersResult.orders).map((order) => order.id);
        const itemsByOrder = new Map<string, OrderItem[]>();

        if (orderIds.length > 0) {
          const itemsResult = await client.query<{ orderItems?: Connection<OrderItem> | null }>({
            orderItems: {
              __args: { filter: { orderId: { in: orderIds } }, first: 100 },
              edges: { node: { id: true, orderId: true, name: true, quantity: true, total: { amountMicros: true, currencyCode: true } } },
            },
          });

          for (const item of nodes(itemsResult.orderItems)) {
            if (!item.orderId) continue;
            itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
          }
        }

        setOrders(
          nodes(ordersResult.orders).map((order) => ({
            ...order,
            items: itemsByOrder.get(order.id) ?? [],
          })),
        );
        setOrdersStatus('ready');
      } catch (ordersFailure) {
        setOrdersError(ordersFailure instanceof Error ? ordersFailure.message : 'Не удалось загрузить заказы.');
        setOrdersStatus('error');
      }
    };

    const loadReservations = async () => {
      try {
        const reservationsResult = await client.query<{ reservations?: Connection<Reservation> | null }>({
          reservations: {
            __args: { filter: { customerId: { eq: recordId } }, first: 100 },
            edges: { node: { id: true, reservationTime: true, guestCount: true, status: true, zone: true, table: true } },
          },
        });
        setReservations(nodes(reservationsResult.reservations));
        setReservationsStatus('ready');
      } catch (reservationsFailure) {
        setReservationsError(reservationsFailure instanceof Error ? reservationsFailure.message : 'Не удалось загрузить бронирования.');
        setReservationsStatus('error');
      }
    };

    const loadLoyalty = async () => {
      try {
        const ledgerResult = await client.query<{ loyaltyLedgerEntries?: Connection<LedgerEntry> | null }>({
          loyaltyLedgerEntries: {
            __args: { filter: { customerId: { eq: recordId } }, first: 100 },
            edges: { node: { id: true, entryType: true, amount: true, occurredAt: true, reason: true } },
          },
        });
        setLedger(nodes(ledgerResult.loyaltyLedgerEntries));
        setLoyaltyStatus('ready');
      } catch (loyaltyFailure) {
        setLoyaltyError(loyaltyFailure instanceof Error ? loyaltyFailure.message : 'Не удалось загрузить операции лояльности.');
        setLoyaltyStatus('error');
      }
    };

    await Promise.all([loadOrders(), loadReservations(), loadLoyalty()]);
  }, [recordId]);

  useEffect(() => { void load(); }, [load]);

  const findAdjustmentRequest = async (idempotencyKey: string) => {
    const client = new CoreApiClient() as unknown as {
      query: (query: unknown) => Promise<LoyaltyAdjustmentRequestQueryResult>;
    };
    const result = await client.query({
      loyaltyAdjustmentRequests: {
        __args: { filter: { idempotencyKey: { eq: idempotencyKey } }, first: 1 },
        edges: { node: { id: true, status: true, error: true } },
      },
    });

    return nodes(result.loyaltyAdjustmentRequests)[0] ?? null;
  };

  const waitForAdjustment = async (idempotencyKey: string) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const request = await findAdjustmentRequest(idempotencyKey);

      if (request?.status === 'APPLIED') return 'APPLIED' as const;
      if (request?.status === 'REJECTED') {
        throw new Error(request.error ?? 'Заявка на корректировку отклонена.');
      }

      await wait(500);
    }

    return 'PENDING' as const;
  };

  const handleLoyaltyAdjustment = async () => {
    if (isSubmittingAdjustment) return;

    const amountText = adjustmentAmount.trim();
    const reason = adjustmentReason.trim();

    if (!recordId || !isValidAdjustmentAmount(amountText)) {
      setAdjustmentError('Введите целое число от -100000 до 100000, кроме нуля.');
      return;
    }

    if (reason.length === 0 || reason.length > 240) {
      setAdjustmentError('Укажите причину длиной до 240 символов.');
      return;
    }

    const idempotencyKey = adjustmentIdempotencyKey.current ?? createAdjustmentIdempotencyKey();
    adjustmentIdempotencyKey.current = idempotencyKey;
    setIsSubmittingAdjustment(true);
    setAdjustmentError(null);
    setAdjustmentNotice(null);

    try {
      const result = await new RestApiClient().post<LoyaltyAdjustmentRequestRouteResult>(
        '/s/loyalty/adjustments',
        { customerId: recordId, amount: Number(amountText), reason, idempotencyKey },
      );

      if (!result.id) {
        throw new Error('Сервер не вернул идентификатор заявки.');
      }

      adjustmentIdempotencyKey.current = null;
      setAdjustmentAmount('');
      setAdjustmentReason('');

      const outcome = await waitForAdjustment(idempotencyKey);
      if (outcome === 'APPLIED') {
        setAdjustmentNotice('Корректировка сохранена в истории лояльности.');
        await load();
      } else {
        setAdjustmentNotice('Заявка принята и ещё обрабатывается. Обновите карточку позже.');
      }
    } catch (adjustmentFailure) {
      try {
        const existingRequest = await findAdjustmentRequest(idempotencyKey);
        if (existingRequest) {
          const outcome = await waitForAdjustment(idempotencyKey);
          adjustmentIdempotencyKey.current = null;
          if (outcome === 'APPLIED') {
            setAdjustmentNotice('Корректировка уже была принята и сохранена в истории лояльности.');
            await load();
            return;
          }
          setAdjustmentNotice('Заявка уже принята и ещё обрабатывается.');
          return;
        }
      } catch (recoveryFailure) {
        setAdjustmentError(
          recoveryFailure instanceof Error
            ? recoveryFailure.message
            : 'Не удалось сохранить корректировку.',
        );
        return;
      }

      setAdjustmentError(
        adjustmentFailure instanceof Error
          ? adjustmentFailure.message
          : 'Не удалось сохранить корректировку.',
      );
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  if (loading) return <div role="status" style={{ padding: '20px', fontFamily: 'sans-serif' }}>Загружаем историю клиента…</div>;
  if (error) return <div role="alert" style={{ padding: '20px', color: '#b42318', fontFamily: 'sans-serif' }}>Ошибка: {error}<button type="button" onClick={() => void load()} style={retryButtonStyle}>Повторить</button></div>;
  if (!customer) return <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>Клиент не найден.</div>;

  const ordersList = [...orders].sort((a, b) => String(b.orderedAt).localeCompare(String(a.orderedAt)));
  const reservationsList = [...reservations].sort((a, b) => String(b.reservationTime).localeCompare(String(a.reservationTime)));
  const ledgerList = [...ledger].sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)));
  const balance = loyaltyStatus === 'ready'
    ? ledgerList.reduce((sum, entry) => sum + (Number.isInteger(entry.amount) ? Number(entry.amount) : 0), 0)
    : null;
  const title = [customer.name?.firstName, customer.name?.lastName].filter(Boolean).join(' ') || 'Клиент';

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif', color: '#242424', display: 'grid', gap: '12px' }}>
      <section style={cardStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '20px' }}>{title}</h2>
          <strong style={{ color: balance === null ? '#667085' : balance < 0 ? '#b42318' : '#067647' }}>
            {balance === null
              ? (loyaltyStatus === 'error' ? 'Текущий баланс: недоступен' : 'Текущий баланс: …')
              : `Текущий бонусный баланс: ${balance} баллов`}
          </strong>
        </div>
        <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', fontSize: '13px' }}>
          <span>Телефон: {customer.phones?.primaryPhoneNumber ?? '—'}</span>
          <span>Телефон в едином формате: {customer.normalizedPhone ?? '—'}</span>
          <span>Статус: {statusLabel[customer.customerStatus ?? ''] ?? customer.customerStatus ?? '—'}</span>
          <span>Источник: {statusLabel[customer.customerSource ?? ''] ?? customer.customerSource ?? '—'}</span>
          <span>Первый контакт: {dateTime(customer.firstInteractionAt)}</span>
          <span>Последняя активность: {dateTime(customer.lastActivityAt)}</span>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#667085' }}>Баланс вычислен из истории лояльности, а не хранится отдельным полем.</p>
      </section>
      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 10px' }}>Заказы ({ordersStatus === 'ready' ? ordersList.length : '…'})</h3>
        {ordersStatus === 'loading' ? <span role="status">Загружаем заказы…</span> : null}
        {ordersStatus === 'error' ? <span role="alert" style={{ color: '#b42318' }}>Не удалось загрузить заказы. {ordersError ?? 'Попробуйте обновить страницу.'}<button type="button" onClick={() => void load()} style={retryButtonStyle}>Повторить загрузку</button></span> : null}
        {ordersStatus === 'ready' && ordersList.length === 0 ? <span>Заказов пока нет.</span> : null}
        {ordersStatus === 'ready' && ordersList.length > 0 ? ordersList.slice(0, 8).map((order) => {
          const items = order.items ?? [];
          return <div key={order.id} style={{ padding: '8px 0', borderTop: '1px solid #f0f0f0', fontSize: '13px', display: 'grid', gap: '4px' }}><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between' }}><span>{order.name ?? 'Заказ'} · {dateTime(order.orderedAt)}</span><span>{statusLabel[order.channel ?? ''] ?? order.channel} · {statusLabel[order.status ?? ''] ?? order.status} · <strong>{money(order.total)}</strong></span></div><span style={{ color: '#667085' }}>{items.length ? items.map((item) => `${item.name ?? 'Позиция'} ×${item.quantity ?? 0} (${money(item.total)})`).join(', ') : 'Позиций заказа пока нет.'}</span></div>;
        }) : null}
      </section>
      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 10px' }}>Бронирования ({reservationsStatus === 'ready' ? reservationsList.length : '…'})</h3>
        {reservationsStatus === 'loading' ? <span role="status">Загружаем бронирования…</span> : null}
        {reservationsStatus === 'error' ? <span role="alert" style={{ color: '#b42318' }}>Не удалось загрузить бронирования. {reservationsError ?? 'Попробуйте обновить страницу.'}<button type="button" onClick={() => void load()} style={retryButtonStyle}>Повторить загрузку</button></span> : null}
        {reservationsStatus === 'ready' && reservationsList.length === 0 ? <span>Бронирований пока нет.</span> : null}
        {reservationsStatus === 'ready' && reservationsList.length > 0 ? reservationsList.slice(0, 8).map((reservation) => <div key={reservation.id} style={{ padding: '8px 0', borderTop: '1px solid #f0f0f0', fontSize: '13px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between' }}><span>{dateTime(reservation.reservationTime)} · {reservation.guestCount ?? '—'} гостей</span><span>{statusLabel[reservation.status ?? ''] ?? reservation.status} · {reservation.zone ?? '—'}, {reservation.table ?? '—'}</span></div>) : null}
      </section>
      <section style={cardStyle}>
        <h3 style={{ margin: '0 0 10px' }}>Лояльность ({loyaltyStatus === 'ready' ? ledgerList.length : '…'})</h3>
        <div aria-label="Корректировка бонусов" style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 180px) minmax(220px, 1fr) auto', gap: '8px', alignItems: 'end', marginBottom: '12px' }}>
          <label style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
            Корректировка, баллы
            <input aria-label="Баллы корректировки" inputMode="numeric" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} disabled={isSubmittingAdjustment} style={{ padding: '7px', border: '1px solid #d0d5dd', borderRadius: '5px' }} />
          </label>
          <label style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
            Причина
            <input aria-label="Причина корректировки" maxLength={240} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} disabled={isSubmittingAdjustment} style={{ padding: '7px', border: '1px solid #d0d5dd', borderRadius: '5px' }} />
          </label>
          <button type="button" onClick={handleLoyaltyAdjustment} disabled={isSubmittingAdjustment} style={{ padding: '8px 12px', border: 0, borderRadius: '5px', background: '#175cd3', color: '#fff', cursor: isSubmittingAdjustment ? 'wait' : 'pointer' }}>{isSubmittingAdjustment ? 'Сохраняем…' : 'Сохранить'}</button>
        </div>
        {adjustmentError ? <p role="alert" style={{ margin: '0 0 10px', color: '#b42318', fontSize: '12px' }}>{adjustmentError}</p> : null}
        {adjustmentNotice ? <p role="status" style={{ margin: '0 0 10px', color: '#067647', fontSize: '12px' }}>{adjustmentNotice}</p> : null}
        <p style={{ margin: '0 0 10px', color: '#667085', fontSize: '12px' }}>Корректировка создаёт отдельную операцию в истории лояльности; текущий баланс пересчитывается из истории.</p>
        {loyaltyStatus === 'loading' ? <span role="status">Загружаем операции…</span> : null}
        {loyaltyStatus === 'error' ? <span role="alert" style={{ color: '#b42318' }}>Не удалось загрузить операции лояльности. {loyaltyError ?? 'Попробуйте обновить страницу.'}<button type="button" onClick={() => void load()} style={retryButtonStyle}>Повторить загрузку</button></span> : null}
        {loyaltyStatus === 'ready' && ledgerList.length === 0 ? <span>Операций пока нет.</span> : null}
        {loyaltyStatus === 'ready' && ledgerList.length > 0 ? ledgerList.slice(0, 10).map((entry) => <div key={entry.id} style={{ padding: '8px 0', borderTop: '1px solid #f0f0f0', fontSize: '13px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between' }}><span>{dateTime(entry.occurredAt)} · {statusLabel[entry.entryType ?? ''] ?? entry.entryType}</span><span>{entry.reason ?? '—'} · <strong style={{ color: (entry.amount ?? 0) < 0 ? '#b42318' : '#067647' }}>{entry.amount ?? 0} баллов</strong></span></div>) : null}
      </section>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: CUSTOMER_360_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'customer-360',
  description: 'История заказов, бронирований и лояльности клиента Mahabbat',
  component: Customer360,
});
