import { useCallback, useEffect, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';

import { MAHABBAT_POS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

type Currency = { amountMicros?: number | string | null; currencyCode?: string | null };
type AnyRow = Record<string, any> & { id: string };
type Session = { sessionToken: string; staff: { id: string; displayName: string; role: 'WAITER' | 'ADMIN' } };
type ApiEnvelope = { status?: string; message?: string; code?: string; [key: string]: any };

const rest = new RestApiClient();

const css = `
  .mah-pos{min-height:100%;height:100%;overflow:auto;background:#0b0b0c;color:#f5f2eb;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .mah-pos *{box-sizing:border-box}.mah-pos button,.mah-pos input,.mah-pos select{font:inherit}.mah-pos button{cursor:pointer}
  .mah-pos-login{min-height:100%;display:grid;place-items:center;padding:24px;background:radial-gradient(850px 500px at 50% -15%,rgba(128,91,55,.24),transparent 60%),#0b0b0c}
  .mah-pos-login-card{width:min(440px,100%);border:1px solid #39352f;border-radius:22px;background:#151517;padding:30px;box-shadow:0 18px 45px rgba(0,0,0,.34)}
  .mah-pos-mark{width:48px;height:48px;border:1px solid #66553a;border-radius:15px;display:grid;place-items:center;color:#c8ad77;font:700 27px Georgia,serif;background:#201b13;margin-bottom:18px}
  .mah-pos-title{font-size:28px;margin:0 0 5px;letter-spacing:-.03em}.mah-pos-sub{color:#96928a;margin:0 0 24px}
  .mah-pos-pin{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:15px}.mah-pos-pin button{height:56px;border:1px solid #39393e;border-radius:12px;background:#202024;color:#f5f2eb;font-size:20px}.mah-pos-pin button:hover{border-color:#c8ad77;background:#29241c}
  .mah-pos-pin-clear{grid-column:span 2}.mah-pos-input,.mah-pos-select{width:100%;height:48px;border:1px solid #39393e;border-radius:11px;background:#111113;color:#f5f2eb;padding:0 12px;outline:none}.mah-pos-input:focus,.mah-pos-select:focus{border-color:#c8ad77}
  .mah-pos-top{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:18px;min-height:70px;padding:10px 18px;border-bottom:1px solid #29292d;background:rgba(11,11,12,.96);backdrop-filter:blur(12px)}
  .mah-pos-brand{display:flex;align-items:center;gap:10px;min-width:190px;font-weight:720}.mah-pos-brand b{color:#c8ad77;font:700 25px Georgia,serif}.mah-pos-brand small{display:block;color:#96928a;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
  .mah-pos-top-actions{display:flex;align-items:center;gap:8px;margin-left:auto}.mah-pos-status{display:flex;align-items:center;gap:8px;color:#b9b4ab;font-size:13px}.mah-pos-dot{width:8px;height:8px;border-radius:50%;background:#7fc29a;box-shadow:0 0 0 4px rgba(127,194,154,.1)}
  .mah-pos-shell{display:grid;grid-template-columns:minmax(160px,220px) minmax(370px,1fr) minmax(340px,420px);min-height:calc(100vh - 70px)}
  .mah-pos-sidebar{padding:14px 10px;border-right:1px solid #29292d;background:#0f0f10}.mah-pos-section-label{padding:8px 9px;color:#6f6c66;font-size:11px;letter-spacing:.12em;text-transform:uppercase}.mah-pos-zone{width:100%;min-height:50px;padding:0 12px;margin:3px 0;text-align:left;border:1px solid transparent;border-radius:11px;background:transparent;color:#aca9a3}.mah-pos-zone.active,.mah-pos-zone:hover{background:#1a1815;border-color:#3b3429;color:#f4efe5}.mah-pos-mini{margin-top:16px;padding:12px;border:1px solid #29292d;border-radius:12px;background:#111113;color:#aaa69e;font-size:12px}.mah-pos-mini strong{display:block;color:#f5f2eb;font-size:13px;margin-bottom:4px}
  .mah-pos-main{min-width:0;padding:17px;overflow:auto}.mah-pos-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:15px}.mah-pos-toolbar h2{margin:0;font-size:20px;letter-spacing:-.025em}.mah-pos-toolbar span{color:#96928a;font-size:12px}.mah-pos-spacer{flex:1}
  .mah-pos-table-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:11px}.mah-pos-table{min-height:112px;padding:14px;text-align:left;border:1px solid #35353a;border-radius:15px;background:linear-gradient(180deg,#19191b,#151517);color:#f5f2eb}.mah-pos-table:hover{border-color:#c8ad77;transform:translateY(-1px)}.mah-pos-table.occupied{border-color:#704b52}.mah-pos-table.reserved{border-color:#a77c3d}.mah-pos-table strong{display:block;font-size:18px}.mah-pos-table small{display:block;color:#96928a;margin-top:8px}.mah-pos-table .mah-pos-table-total{color:#c8ad77;font-weight:700;margin-top:8px}
  .mah-pos-menu{margin-top:22px}.mah-pos-menu-head{display:flex;align-items:end;gap:10px;margin-bottom:10px}.mah-pos-menu-head h3{margin:0;font-size:17px}.mah-pos-menu-head span{color:#96928a;font-size:12px}.mah-pos-search{max-width:260px;margin-left:auto}.mah-pos-menu-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.mah-pos-dish{min-height:122px;padding:13px;text-align:left;border:1px solid #29292d;border-radius:14px;background:#151517;color:#f5f2eb}.mah-pos-dish:hover{border-color:#c8ad77;background:#1b1a1a}.mah-pos-dish.disabled{opacity:.42;cursor:not-allowed}.mah-pos-dish b{display:block;line-height:1.25}.mah-pos-dish small{display:block;margin-top:8px;color:#96928a}.mah-pos-dish strong{display:block;margin-top:15px;color:#e6dfd2}.mah-pos-category{display:inline-flex;min-height:38px;align-items:center;padding:0 12px;margin:0 5px 8px 0;border:1px solid #29292d;border-radius:10px;background:#111113;color:#96928a}.mah-pos-category.active{border-color:#6b593b;color:#f4efe5;background:#201b13}
  .mah-pos-panel{padding:17px;border-left:1px solid #29292d;background:#111113;overflow:auto}.mah-pos-panel h2{margin:0;font-size:19px}.mah-pos-panel h3{margin:17px 0 9px;font-size:14px;color:#c8ad77}.mah-pos-muted{color:#96928a;font-size:12px}.mah-pos-guest-list{display:flex;gap:7px;overflow:auto;padding:9px 0}.mah-pos-guest{min-width:87px;min-height:48px;padding:8px;text-align:left;border:1px solid #39393e;border-radius:10px;background:#1a1a1d;color:#b9b4ab}.mah-pos-guest.active{border-color:#c8ad77;color:#f4efe5;background:#201b13}.mah-pos-lines{display:grid;gap:7px}.mah-pos-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px;border:1px solid #29292d;border-radius:10px;background:#151517}.mah-pos-line b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mah-pos-line small{color:#96928a}.mah-pos-line-actions{display:flex;align-items:center;gap:4px}.mah-pos-line-actions button{width:32px;height:32px;border:1px solid #39393e;border-radius:8px;background:#202024;color:#f5f2eb}.mah-pos-chip{display:inline-flex;align-items:center;min-height:24px;padding:0 7px;border-radius:6px;font-size:10px;background:#242429;color:#96928a}.mah-pos-chip.sent{color:#7fc29a}.mah-pos-chip.unsent{color:#d0a96c}.mah-pos-chip.voided{color:#d57a7a}.mah-pos-totals{display:grid;gap:5px;margin:14px 0;padding-top:12px;border-top:1px solid #29292d}.mah-pos-total-row{display:flex;justify-content:space-between;gap:12px;color:#b9b4ab}.mah-pos-total-row.total{font-size:20px;font-weight:750;color:#f4efe5}.mah-pos-total-row.total strong{color:#c8ad77}.mah-pos-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}.mah-pos-btn{min-height:48px;padding:0 13px;border:1px solid #3a393a;border-radius:10px;background:#202024;color:#f5f2eb}.mah-pos-btn:hover{border-color:#c8ad77}.mah-pos-btn.primary{border-color:#765f39;background:#3a2b18;color:#f4efe5}.mah-pos-btn.danger{border-color:#70454d;color:#efb3b3;background:#28171b}.mah-pos-btn:disabled{opacity:.42;cursor:not-allowed}.mah-pos-notice{margin:9px 0;padding:10px 12px;border:1px solid #4a4437;border-radius:9px;background:#211c14;color:#dbc69f;font-size:12px}.mah-pos-error{margin:9px 0;padding:10px 12px;border:1px solid #70454d;border-radius:9px;background:#28171b;color:#efb3b3;font-size:12px}.mah-pos-form{display:grid;gap:8px}.mah-pos-pay{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mah-pos-pay label{color:#96928a;font-size:11px}.mah-pos-pay label>*{margin-top:4px}.mah-pos-reservation{padding:12px;border:1px solid #29292d;border-radius:12px;background:#151517}.mah-pos-reservation-row{display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:6px 0;border-bottom:1px solid #29292d}.mah-pos-reservation-row:last-child{border-bottom:0}.mah-pos-overdue{color:#d57a7a}.mah-pos-divider{height:1px;background:#29292d;margin:16px 0}
  @media(max-width:1050px){.mah-pos-shell{grid-template-columns:150px minmax(300px,1fr)}.mah-pos-panel{grid-column:1/-1;border-left:0;border-top:1px solid #29292d}.mah-pos-brand{min-width:150px}}@media(max-width:700px){.mah-pos-top{flex-wrap:wrap}.mah-pos-shell{display:block}.mah-pos-sidebar{display:flex;overflow:auto;border-right:0;border-bottom:1px solid #29292d}.mah-pos-zone{min-width:120px}.mah-pos-main,.mah-pos-panel{padding:12px}.mah-pos-menu-grid,.mah-pos-table-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mah-pos-top-actions{margin-left:0}}
  .mah-pos-admin-transfer-waiter,.mah-pos-panel .mah-pos-form > .mah-pos-select:nth-child(2){display:none}
`;

const uuid = (): string => {
  const bytes = new Uint8Array(16);
  try { globalThis.crypto?.getRandomValues(bytes); } catch { for (let i = 0; i < bytes.length; i += 1) bytes[i] = (Date.now() + i * 31 + Math.random() * 255) & 255; }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const micros = (value: Currency | number | string | null | undefined): number => {
  if (typeof value === 'object' && value) return Number(value.amountMicros ?? 0);
  return Number(value ?? 0);
};
const money = (value: Currency | number | string | null | undefined): string =>
  `${new Intl.NumberFormat('ru-KZ', { maximumFractionDigits: 0 }).format(Math.round(micros(value) / 1_000_000))} ₸`;
const dateTime = (value?: string | null): string => value ? new Intl.DateTimeFormat('ru-KZ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
const listRows = <T extends AnyRow>(payload: any, plural: string): T[] => payload?.data?.[plural] ?? [];
const activeOrder = (order: AnyRow | undefined): boolean => Boolean(order && ['OPEN', 'IN_PROGRESS', 'PRECHECK_PRINTED'].includes(order.status));
const isOverdue = (reservation: AnyRow): boolean => Boolean(reservation.scheduledAt && new Date(reservation.scheduledAt).getTime() < Date.now() && reservation.status === 'ACTIVE');
const commandError = (error: unknown): string => {
  const body = (error as any)?.body;
  return body?.message || body?.code || (error instanceof Error ? error.message : 'Операция не выполнена');
};

const PosFrontComponent = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [pin, setPin] = useState('');
  const [rows, setRows] = useState<Record<string, AnyRow[]>>({});
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Все');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [reservationName, setReservationName] = useState('');
  const [reservationPhone, setReservationPhone] = useState('');
  const [reservationAt, setReservationAt] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);

  const load = useCallback(async () => {
    const names = ['posZones', 'posTables', 'posOrders', 'posOrderGuests', 'posOrderLines', 'posMenuItems', 'posShifts', 'posReservations', 'posStopListEntries', 'posKitchenTickets', 'posKitchenTicketLines', 'posPrechecks', 'posPayments', 'posPaymentMethods', 'posPrepayments'];
    const values = await Promise.all(names.map(async (name) => [name, listRows(await rest.get(`/rest/${name}`, { query: { limit: 200 } }), name)] as const));
    setRows(Object.fromEntries(values));
  }, []);

  useEffect(() => { if (session) void load().catch((value) => setError(commandError(value))); }, [load, session]);

  const command = useCallback(async (name: string, payload: Record<string, unknown>) => {
    const body: Record<string, unknown> = { command: name, payload };
    if (session?.sessionToken) body.sessionToken = session.sessionToken;
    return rest.post<ApiEnvelope>('/s/pos/command', body);
  }, [session]);

  const run = useCallback(async (name: string, payload: Record<string, unknown>, success?: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await command(name, payload); await load(); if (success) setNotice(success); }
    catch (value) { setError(commandError(value)); }
    finally { setBusy(false); }
  }, [command, load]);

  const login = async () => {
    if (!/^\d{4,8}$/.test(pin)) { setError('Введите PIN из 4–8 цифр'); return; }
    setLoginBusy(true); setError('');
    try {
      const result = await rest.post<ApiEnvelope>('/s/pos/command', { command: 'authenticatePosStaff', payload: { pin, terminalId: 'touch-pos' } });
      if (!result.sessionToken || !result.staff?.id) throw new Error(result.message || result.code || 'Вход отклонён');
      setSession({ sessionToken: result.sessionToken, staff: { id: result.staff.id, displayName: result.staff.displayName, role: result.staff.role } });
      setPin(''); setNotice('Сессия POS открыта');
    } catch (value) { setError(commandError(value)); }
    finally { setLoginBusy(false); }
  };

  const logout = async () => { if (session) { try { await command('logoutPosStaff', {}); } catch { /* local session is still cleared */ } } setSession(null); setRows({}); setOrderId(null); setTableId(null); };
  const zones = (rows.posZones ?? []).filter((row) => row.isActive !== false);
  const tables = (rows.posTables ?? []).filter((row) => row.isActive !== false && (!zoneId || row.zoneId === zoneId));
  const orders = rows.posOrders ?? [];
  const selectedOrder = orders.find((row) => row.id === orderId);
  const selectedTable = (rows.posTables ?? []).find((row) => row.id === tableId);
  const guests = (rows.posOrderGuests ?? []).filter((row) => row.orderId === orderId).sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
  const lines = (rows.posOrderLines ?? []).filter((row) => row.orderId === orderId);
  const activeLines = lines.filter((line) => line.status === 'ACTIVE');
  const menu = (rows.posMenuItems ?? []).filter((row) => row.isActive !== false);
  const stopList = new Set((rows.posStopListEntries ?? []).filter((row) => row.isActive !== false).map((row) => row.menuItemId));
  const categories = ['Все', ...Array.from(new Set(menu.map((item) => item.category).filter(Boolean)))];
  const filteredMenu = menu.filter((item) => (category === 'Все' || item.category === category) && String(item.name ?? '').toLowerCase().includes(search.toLowerCase()));
  const reservations = (rows.posReservations ?? []).filter((row) => row.status === 'ACTIVE');
  const methods = (rows.posPaymentMethods ?? []).filter((row) => row.isActive !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const activeShift = (rows.posShifts ?? []).find((row) => row.staffId === session?.staff.id && row.isOpen === true);
  const orderPrecheck = (rows.posPrechecks ?? []).find((row) => row.orderId === orderId && row.status === 'ACTIVE');
  const payments = (rows.posPayments ?? []).filter((row) => row.orderId === orderId && row.status === 'SUCCESS');
  const prepaidMicros = (rows.posPrepayments ?? []).filter((row) => row.orderId === orderId && row.status === 'APPLIED').reduce((sum, row) => sum + micros(row.amount), 0);
  const paidMicros = payments.reduce((sum, row) => sum + micros(row.amount), 0);
  const totalMicros = micros(selectedOrder?.total);
  const remainingMicros = Math.max(0, totalMicros - prepaidMicros - paidMicros);
  const selectedGuest = guests.find((row) => row.id === (guestId ?? guests[0]?.id));

  useEffect(() => { if (!zoneId && zones[0]) setZoneId(zones[0].id); }, [zoneId, zones]);
  useEffect(() => { if (!guestId && guests[0]) setGuestId(guests[0].id); if (guestId && !guests.some((guest) => guest.id === guestId)) setGuestId(guests[0]?.id ?? null); }, [guestId, guests]);
  useEffect(() => { if (!paymentMethodId && methods[0]) setPaymentMethodId(methods[0].id); }, [methods, paymentMethodId]);

  const selectTable = async (table: AnyRow) => {
    setTableId(table.id); setError('');
    const existing = orders.find((row) => row.tableId === table.id && activeOrder(row));
    if (existing) { setOrderId(existing.id); return; }
    if (!activeShift) { setError('Сначала откройте смену'); return; }
    setBusy(true);
    try { const result = await command('openOrder', { tableId: table.id, idempotencyKey: uuid() }); if (result.orderId) setOrderId(result.orderId); await load(); setNotice(`Стол ${table.number} открыт`); }
    catch (value) { setError(commandError(value)); }
    finally { setBusy(false); }
  };
  const addGuest = () => { if (orderId) void run('addGuest', { orderId, idempotencyKey: uuid(), name: `Гость ${guests.length + 1}` }, 'Гость добавлен'); };
  const addLine = (item: AnyRow) => { if (orderId && selectedGuest && !stopList.has(item.id) && !orderPrecheck) void run('addLine', { orderId, guestId: selectedGuest.id, menuItemId: item.id, quantity: 1, idempotencyKey: uuid() }, `${item.name} добавлен`); };
  const changeQuantity = (line: AnyRow, quantity: number) => { if (!orderPrecheck && quantity > 0) void run('changeLineQuantity', { lineId: line.id, quantity }, 'Количество обновлено'); };
  const print = () => { if (orderId) void run('printKitchenTicket', { orderId, idempotencyKey: uuid() }, 'Новые блюда отправлены на кухню'); };
  const precheck = () => { if (orderId) void run('createPrecheck', { orderId, idempotencyKey: uuid() }, 'Пречек создан: заказ заблокирован'); };
  const cancelPrecheck = () => { if (orderId) void run('cancelPrecheck', { orderId, idempotencyKey: uuid() }, 'Пречек отменён'); };
  const pay = () => { const amount = Math.round(Number(paymentAmount.replace(',', '.')) * 1_000_000); if (orderId && paymentMethodId && Number.isSafeInteger(amount) && amount > 0) { void run('recordPayment', { orderId, paymentMethodId, amountMicros: amount, idempotencyKey: uuid() }, 'Оплата записана'); setPaymentAmount(''); } else setError('Введите корректную сумму оплаты'); };
  const closeOrder = () => { if (orderId) void run('closeOrder', { orderId, idempotencyKey: uuid() }, 'Заказ закрыт, стол свободен'); };
  const toggleStopList = (item: AnyRow) => { void run(stopList.has(item.id) ? 'clearStopListEntry' : 'addStopListEntry', { menuItemId: item.id, idempotencyKey: uuid() }, stopList.has(item.id) ? 'Позиция снята со стоп-листа' : 'Позиция добавлена в стоп-лист'); };
  const createReservation = () => { if (tableId) void run('createReservation', { tableId, ...(reservationAt ? { scheduledAt: new Date(reservationAt).toISOString() } : {}), ...(reservationName ? { guestName: reservationName } : {}), ...(reservationPhone ? { phone: reservationPhone } : {}), idempotencyKey: uuid() }, 'Бронирование создано'); };
  const voidLine = (line: AnyRow) => { if (session?.staff.role === 'ADMIN') void run('voidOrderLines', { lineIds: [line.id], preparedState: Number(line.kitchenSentQuantity ?? 0) > 0 ? 'PREPARED' : 'NOT_PREPARED', reason: 'Отмена в POS', idempotencyKey: uuid() }, 'Позиция отменена'); };
  const transferTable = (targetTableId: string) => { if (orderId && targetTableId) void run('transferOrderToTable', { orderId, targetTableId, idempotencyKey: uuid() }, 'Заказ перенесён'); };
  const transferWaiter = (targetStaffId: string) => { if (orderId && targetStaffId) void run('transferOrderToWaiter', { orderId, targetStaffId, idempotencyKey: uuid() }, 'Заказ передан официанту'); };

  if (!session) return <div className="mah-pos"><style>{css}</style><div className="mah-pos-login"><div className="mah-pos-login-card"><div className="mah-pos-mark">M</div><h1 className="mah-pos-title">Mahabbat POS</h1><p className="mah-pos-sub">Операционная касса ресторана</p><input className="mah-pos-input" aria-label="PIN" inputMode="numeric" type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))} onKeyDown={(event) => { if (event.key === 'Enter') void login(); }} placeholder="PIN сотрудника" autoFocus /><div className="mah-pos-pin">{['1','2','3','4','5','6','7','8','9'].map((digit) => <button type="button" key={digit} onClick={() => setPin((value) => `${value}${digit}`.slice(0, 8))}>{digit}</button>)}<button type="button" className="mah-pos-pin-clear" onClick={() => setPin('')}>Очистить</button><button type="button" onClick={() => setPin((value) => value.slice(0, -1))}>⌫</button></div><button type="button" className="mah-pos-btn primary" style={{ width: '100%', marginTop: 15 }} disabled={loginBusy} onClick={() => void login()}>{loginBusy ? 'Входим…' : 'Войти'}</button>{error && <div className="mah-pos-error">{error}</div>}</div></div></div>;

  return <div className="mah-pos"><style>{css}</style><header className="mah-pos-top"><div className="mah-pos-brand"><b>M</b><div>Mahabbat<small>операционная касса</small></div></div><div className="mah-pos-status"><i className="mah-pos-dot" />{activeShift ? 'Смена открыта' : 'Смена закрыта'}</div><div className="mah-pos-top-actions"><span className="mah-pos-muted">{session.staff.displayName} · {session.staff.role === 'ADMIN' ? 'Администратор' : 'Официант'}</span><button type="button" className="mah-pos-btn" onClick={() => void load()}>Обновить</button><button type="button" className="mah-pos-btn" onClick={() => void logout()}>Выйти</button></div></header><div className="mah-pos-shell"><aside className="mah-pos-sidebar"><div className="mah-pos-section-label">Зоны</div>{zones.map((zone) => <button type="button" className={`mah-pos-zone ${zone.id === zoneId ? 'active' : ''}`} key={zone.id} onClick={() => setZoneId(zone.id)}>{zone.name}</button>)}<div className="mah-pos-mini"><strong>{activeShift ? 'Текущая смена' : 'Смена не открыта'}</strong>{activeShift ? `Открыта ${dateTime(activeShift.openedAt)}` : 'Откройте смену для начала работы'}{!activeShift ? <button type="button" className="mah-pos-btn primary" style={{ width: '100%', marginTop: 9 }} disabled={busy} onClick={() => void run('openShift', { idempotencyKey: uuid() }, 'Смена открыта')}>Открыть смену</button> : <button type="button" className="mah-pos-btn" style={{ width: '100%', marginTop: 9 }} disabled={busy} onClick={() => void run('closeShift', { shiftId: activeShift.id }, 'Смена закрыта')}>Закрыть смену</button>}</div><div className="mah-pos-mini"><strong>Брони</strong>{reservations.length} активных{reservations.some(isOverdue) && <div className="mah-pos-overdue">Есть просроченные</div>}</div></aside><main className="mah-pos-main"><div className="mah-pos-toolbar"><h2>{zones.find((zone) => zone.id === zoneId)?.name ?? 'Зал'}</h2><span>Выберите свободный стол или продолжите заказ</span><span className="mah-pos-spacer" /><span>{tables.length} столов</span></div><div className="mah-pos-table-grid">{tables.map((table) => { const order = orders.find((row) => row.tableId === table.id && activeOrder(row)); const reservation = reservations.find((row) => row.tableId === table.id); return <button type="button" className={`mah-pos-table ${order ? 'occupied' : ''} ${reservation ? 'reserved' : ''}`} key={table.id} onClick={() => void selectTable(table)}><strong>Стол {table.number}</strong><small>{order ? `Заказ · ${order.ownerStaffId === session.staff.id ? 'мой' : 'занят'}` : reservation ? (isOverdue(reservation) ? 'Бронь просрочена' : 'Забронирован') : 'Свободен'}</small>{order && <div className="mah-pos-table-total">{money(order.total)}</div>}</button>; })}</div><div className="mah-pos-menu"><div className="mah-pos-menu-head"><h3>Меню</h3><span>{selectedGuest ? `для ${selectedGuest.displayNumber ?? 'гостя'}` : 'сначала выберите заказ'}</span><input className="mah-pos-input mah-pos-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск блюда" /></div><div>{categories.map((item) => <button type="button" key={item} className={`mah-pos-category ${item === category ? 'active' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="mah-pos-menu-grid">{filteredMenu.map((item) => { const stopped = stopList.has(item.id); return <button type="button" className={`mah-pos-dish ${stopped || !selectedOrder || Boolean(orderPrecheck) ? 'disabled' : ''}`} key={item.id} disabled={stopped || !selectedOrder || Boolean(orderPrecheck) || busy} onClick={() => addLine(item)}><b>{item.name}</b><small>{stopped ? 'Стоп-лист' : item.category ?? 'Меню'}</small><strong>{money(item.price)}</strong>{session.staff.role === 'ADMIN' && <span className="mah-pos-muted">{stopped ? 'Снять стоп-лист' : 'В стоп-лист'}: <span onClick={(event) => { event.stopPropagation(); toggleStopList(item); }}>×</span></span>}</button>; })}</div><div className="mah-pos-divider" /><div className="mah-pos-reservation"><h3 style={{ marginTop: 0 }}>Бронирование выбранного стола</h3><div className="mah-pos-form"><input className="mah-pos-input" value={reservationName} onChange={(event) => setReservationName(event.target.value)} placeholder="Имя гостя (необязательно)" /><input className="mah-pos-input" value={reservationPhone} onChange={(event) => setReservationPhone(event.target.value)} placeholder="Телефон (необязательно)" /><input className="mah-pos-input" type="datetime-local" value={reservationAt} onChange={(event) => setReservationAt(event.target.value)} /><button type="button" className="mah-pos-btn" disabled={!tableId || busy} onClick={createReservation}>Забронировать стол</button></div></div></div></main><aside className="mah-pos-panel">{selectedOrder ? <><div className="mah-pos-toolbar"><h2>Заказ · Стол {selectedTable?.number ?? '—'}</h2><span className="mah-pos-spacer" /><span className={`mah-pos-chip ${orderPrecheck ? 'unsent' : ''}`}>{orderPrecheck ? 'Заблокирован' : selectedOrder.status === 'CLOSED' ? 'Закрыт' : 'В работе'}</span></div><div className="mah-pos-guest-list">{guests.map((guest) => <button type="button" key={guest.id} className={`mah-pos-guest ${guest.id === selectedGuest?.id ? 'active' : ''}`} onClick={() => setGuestId(guest.id)}>{guest.displayNumber ?? `Гость ${guest.ordinal}`}<small>{money(guest.subtotal)}</small></button>)}<button type="button" className="mah-pos-guest" onClick={addGuest} disabled={busy || Boolean(orderPrecheck)}>+ Гость</button></div><div className="mah-pos-lines">{lines.length ? lines.map((line) => <div className="mah-pos-line" key={line.id}><div><b>{line.itemNameSnapshot ?? 'Позиция'}</b><small>{money(line.unitPrice)} · {line.status === 'VOIDED' ? <span className="mah-pos-chip voided">Отменена</span> : <span className={`mah-pos-chip ${Number(line.kitchenSentQuantity ?? 0) > 0 ? 'sent' : 'unsent'}`}>{Number(line.kitchenSentQuantity ?? 0) > 0 ? 'На кухне' : 'Не отправлена'}</span>}</small></div><div className="mah-pos-line-actions"><button type="button" disabled={Boolean(orderPrecheck) || line.status !== 'ACTIVE'} onClick={() => changeQuantity(line, Math.max(1, Number(line.quantity ?? 1) - 1))}>−</button><span>{line.quantity}</span><button type="button" disabled={Boolean(orderPrecheck) || line.status !== 'ACTIVE'} onClick={() => changeQuantity(line, Number(line.quantity ?? 1) + 1)}>+</button>{session.staff.role === 'ADMIN' && line.status === 'ACTIVE' && <button type="button" className="mah-pos-btn danger" style={{ minHeight: 32, padding: '0 6px' }} onClick={() => voidLine(line)}>×</button>}</div></div>) : <div className="mah-pos-muted">Добавьте блюда из меню</div>}</div><div className="mah-pos-totals"><div className="mah-pos-total-row"><span>Подытог</span><strong>{money(selectedOrder.subtotal)}</strong></div>{prepaidMicros > 0 && <div className="mah-pos-total-row"><span>Предоплата</span><strong>− {money(prepaidMicros)}</strong></div>}{paidMicros > 0 && <div className="mah-pos-total-row"><span>Оплачено</span><strong>− {money(paidMicros)}</strong></div>}<div className="mah-pos-total-row total"><span>К оплате</span><strong>{money(remainingMicros)}</strong></div></div><div className="mah-pos-actions"><button type="button" className="mah-pos-btn primary" disabled={busy || Boolean(orderPrecheck) || !activeLines.length} onClick={print}>Печать на кухню</button><button type="button" className="mah-pos-btn primary" disabled={busy || Boolean(orderPrecheck) || !activeLines.length} onClick={precheck}>Создать пречек</button>{orderPrecheck && session.staff.role === 'ADMIN' && <button type="button" className="mah-pos-btn danger" disabled={busy} onClick={cancelPrecheck}>Отменить пречек</button>}</div>{orderPrecheck && <div className="mah-pos-notice">Заказ заблокирован до отмены пречека администратором.</div>}<h3>Оплата</h3><div className="mah-pos-pay"><label>Метод<select className="mah-pos-select" value={paymentMethodId ?? ''} onChange={(event) => setPaymentMethodId(event.target.value)}>{methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label><label>Сумма, ₸<input className="mah-pos-input" inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="0" /></label></div><div className="mah-pos-actions"><button type="button" className="mah-pos-btn" disabled={busy || !orderPrecheck || remainingMicros <= 0} onClick={pay}>Принять оплату</button><button type="button" className="mah-pos-btn primary" disabled={busy || !orderPrecheck || remainingMicros !== 0} onClick={closeOrder}>Закрыть заказ</button></div>{session.staff.role === 'ADMIN' && <><h3>Администратор</h3><div className="mah-pos-form"><select className="mah-pos-select" defaultValue="" onChange={(event) => { if (event.target.value) transferTable(event.target.value); }}><option value="">Перенести на стол…</option>{(rows.posTables ?? []).filter((table) => table.id !== selectedOrder.tableId && table.isActive !== false).map((table) => <option key={table.id} value={table.id}>{table.number}</option>)}</select><select className="mah-pos-select" defaultValue="" onChange={(event) => { if (event.target.value) transferWaiter(event.target.value); }}><option value="">Передать официанту…</option>{(rows.posStaff ?? []).filter((staff) => staff.isActive !== false && staff.id !== selectedOrder.ownerStaffId).map((staff) => <option key={staff.id} value={staff.id}>{staff.displayName}</option>)}</select></div></>}</> : <div className="mah-pos-muted">Выберите стол, чтобы открыть заказ или продолжить работу.</div>}{notice && <div className="mah-pos-notice">{notice}</div>}{error && <div className="mah-pos-error">{error}</div>}</aside></div></div>;
};

export default defineFrontComponent({
  universalIdentifier: MAHABBAT_POS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'mahabbat-pos',
  description: 'Touch-oriented operational POS for Mahabbat restaurant workflows',
  component: PosFrontComponent,
});
