import { useCallback, useEffect, useMemo, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';

import { MAHABBAT_PRINTING_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const rest = new RestApiClient();

type Row = Record<string, unknown> & { id: string };
type Printer = Row & { label?: string; host?: string; port?: number; isActive?: boolean; isPrecheckPrinter?: boolean; paperWidth?: string; encodingProfile?: string; status?: string };
type Station = Row & { label?: string; printerDeviceId?: string | null; isActive?: boolean };
type Job = Row & { label?: string; status?: string; documentType?: string; sourceId?: string; lastErrorCode?: string; lastErrorMessage?: string; createdAt?: string };

const UUID = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const unwrapRows = (value: unknown, root: string): Row[] => {
  if (Array.isArray(value)) return value.filter((row): row is Row => Boolean(row && typeof row === 'object' && 'id' in row));
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const direct = record.data;
  if (Array.isArray(direct)) return direct.filter((row): row is Row => Boolean(row && typeof row === 'object' && 'id' in row));
  const node = record[root];
  if (node && typeof node === 'object') {
    const edges = (node as { edges?: Array<{ node?: Row | null } | null> }).edges;
    if (Array.isArray(edges)) return edges.map((edge) => edge?.node).filter((row): row is Row => Boolean(row?.id));
  }
  return [];
};

const PrintingAdmin = () => {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [menuItems, setMenuItems] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pin, setPin] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [role, setRole] = useState('');
  const [printerForm, setPrinterForm] = useState({ label: '', host: '', port: '9100', isPrecheckPrinter: false });
  const [stationForm, setStationForm] = useState({ label: '', printerDeviceId: '' });
  const [routeDraft, setRouteDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [printerData, stationData, menuData, jobData] = await Promise.all([
        rest.get('/rest/posPrinterDevices', { query: { limit: 200 } }),
        rest.get('/rest/posProductionStations', { query: { limit: 200 } }),
        rest.get('/rest/posMenuItems', { query: { limit: 200 } }),
        rest.get('/rest/posPrintJobs', { query: { limit: 200 } }),
      ]);
      setPrinters(unwrapRows(printerData, 'posPrinterDevices') as Printer[]);
      setStations(unwrapRows(stationData, 'posProductionStations') as Station[]);
      setMenuItems(unwrapRows(menuData, 'posMenuItems'));
      setJobs(unwrapRows(jobData, 'posPrintJobs') as Job[]);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const command = useCallback(async (name: string, payload: Record<string, unknown>) => {
    if (!sessionToken) throw new Error('Сначала войдите PIN администратора.');
    const result = await rest.post<Record<string, unknown>>('/s/pos/command', { command: name, sessionToken, payload });
    if (result.code || (typeof result.status === 'number' && result.status >= 400)) throw new Error(String(result.message ?? result.code ?? 'Команда отклонена'));
    return result;
  }, [sessionToken]);

  const login = async () => {
    setError('');
    try {
      const result = await rest.post<Record<string, unknown>>('/s/pos/command', { command: 'authenticatePosStaff', payload: { pin, terminalId: 'printing-admin' } });
      if (!result.sessionToken || !result.staff || typeof result.staff !== 'object') throw new Error(String(result.message ?? result.code ?? 'Вход отклонён'));
      const staff = result.staff as Record<string, unknown>;
      setSessionToken(String(result.sessionToken));
      setRole(String(staff.role ?? ''));
      setPin('');
      setNotice('Административная сессия открыта');
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  };

  const savePrinter = async () => {
    try {
      await command('upsertPrinterDevice', { label: printerForm.label, host: printerForm.host, port: Number(printerForm.port), isActive: true, isPrecheckPrinter: printerForm.isPrecheckPrinter, paperWidth: '80', encodingProfile: 'CP866', escPosCodePage: 17, cutSupport: true });
      setPrinterForm({ label: '', host: '', port: '9100', isPrecheckPrinter: false });
      setNotice('Принтер сохранён');
      await load();
    } catch (value) { setError(value instanceof Error ? value.message : String(value)); }
  };

  const saveStation = async () => {
    try {
      await command('upsertProductionStation', { label: stationForm.label, printerDeviceId: stationForm.printerDeviceId || null, isActive: true });
      setStationForm({ label: '', printerDeviceId: '' });
      setNotice('Станция сохранена');
      await load();
    } catch (value) { setError(value instanceof Error ? value.message : String(value)); }
  };

  const setRoute = async (menuItemId: string) => {
    try {
      await command('setMenuItemProductionStation', { menuItemId, productionStationId: routeDraft[menuItemId] || null, idempotencyKey: UUID() });
      setNotice('Маршрут блюда сохранён');
      await load();
    } catch (value) { setError(value instanceof Error ? value.message : String(value)); }
  };

  const retry = async (job: Job) => {
    const warning = job.status === 'OUTCOME_UNKNOWN' ? 'Принтер мог уже напечатать этот документ. Повторить осознанно?' : 'Создать отдельное задание повторной печати?';
    if (!globalThis.confirm?.(warning)) return;
    try {
      await command('retryPrintJob', { printJobId: job.id, idempotencyKey: UUID() });
      setNotice('Повторное задание поставлено в очередь');
      await load();
    } catch (value) { setError(value instanceof Error ? value.message : String(value)); }
  };

  const printerById = useMemo(() => new Map(printers.map((printer) => [printer.id, printer])), [printers]);

  return <div style={{ padding: 20, fontFamily: 'Inter, system-ui, sans-serif', color: '#111827', maxWidth: 1180 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div><h1 style={{ margin: 0, fontSize: 24 }}>Физическая печать</h1><p style={{ color: '#6b7280', margin: '5px 0 0' }}>Маршруты, локальный gateway и durable print outbox</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} style={{ marginLeft: 'auto', padding: '8px 12px' }}>{loading ? 'Обновляем…' : 'Обновить'}</button>
    </div>
    {error && <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8 }}>{error}</div>}
    {notice && <div style={{ marginTop: 12, padding: 10, background: '#ecfdf5', color: '#065f46', borderRadius: 8 }}>{notice}</div>}
    {!sessionToken ? <section style={{ marginTop: 18, padding: 16, border: '1px solid #e5e7eb', borderRadius: 10 }}>
      <h2 style={{ fontSize: 17, marginTop: 0 }}>Вход администратора</h2><p style={{ color: '#6b7280' }}>PIN нужен только для команд изменения конфигурации и повторной печати.</p>
      <div style={{ display: 'flex', gap: 8 }}><input aria-label="PIN администратора" type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN" /><button type="button" onClick={() => void login()}>Войти</button></div>
    </section> : <div style={{ marginTop: 14, color: '#065f46' }}>Сессия: {role || 'POS'} · прямого подключения браузера к принтеру нет.</div>}
    {sessionToken && role === 'ADMIN' && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12, marginTop: 18 }}>
        <section style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 10 }}><h2 style={{ fontSize: 17, marginTop: 0 }}>Ethernet-принтер</h2><div style={{ display: 'grid', gap: 8 }}>
          <input placeholder="Название" value={printerForm.label} onChange={(event) => setPrinterForm({ ...printerForm, label: event.target.value })} /><input placeholder="IP или hostname" value={printerForm.host} onChange={(event) => setPrinterForm({ ...printerForm, host: event.target.value })} /><input type="number" min="1" max="65535" placeholder="9100" value={printerForm.port} onChange={(event) => setPrinterForm({ ...printerForm, port: event.target.value })} /><label><input type="checkbox" checked={printerForm.isPrecheckPrinter} onChange={(event) => setPrinterForm({ ...printerForm, isPrecheckPrinter: event.target.checked })} /> Принтер пречеков</label><button type="button" onClick={() => void savePrinter()}>Сохранить принтер</button>
        </div></section>
        <section style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 10 }}><h2 style={{ fontSize: 17, marginTop: 0 }}>Производственная станция</h2><div style={{ display: 'grid', gap: 8 }}><input placeholder="Название станции" value={stationForm.label} onChange={(event) => setStationForm({ ...stationForm, label: event.target.value })} /><select value={stationForm.printerDeviceId} onChange={(event) => setStationForm({ ...stationForm, printerDeviceId: event.target.value })}><option value="">Без принтера</option>{printers.map((printer) => <option key={printer.id} value={printer.id}>{printer.label ?? printer.id}</option>)}</select><button type="button" onClick={() => void saveStation()}>Сохранить станцию</button></div></section>
      </div>
      <section style={{ marginTop: 18, padding: 16, border: '1px solid #e5e7eb', borderRadius: 10 }}><h2 style={{ fontSize: 17, marginTop: 0 }}>Маршрут меню</h2><p style={{ color: '#6b7280', marginTop: 0 }}>Станция фиксируется в kitchen ticket snapshot при отправке.</p><div style={{ display: 'grid', gap: 7 }}>{menuItems.map((item) => <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(180px,280px) auto', gap: 8, alignItems: 'center' }}><span>{String(item.name ?? item.id)}</span><select value={routeDraft[item.id] ?? String(item.productionStationId ?? '')} onChange={(event) => setRouteDraft({ ...routeDraft, [item.id]: event.target.value })}><option value="">Без станции</option>{stations.map((station) => <option key={station.id} value={station.id}>{station.label ?? station.id}</option>)}</select><button type="button" onClick={() => void setRoute(item.id)}>Сохранить</button></div>)}</div></section>
      <section style={{ marginTop: 18, padding: 16, border: '1px solid #e5e7eb', borderRadius: 10 }}><h2 style={{ fontSize: 17, marginTop: 0 }}>Принтеры и задания</h2><div style={{ display: 'grid', gap: 6 }}>{printers.map((printer) => <div key={printer.id} style={{ padding: 9, background: '#f9fafb', borderRadius: 7 }}><strong>{printer.label ?? printer.id}</strong> · {printer.host}:{printer.port} · {printer.status ?? 'UNKNOWN'}{printer.isPrecheckPrinter ? ' · пречек' : ''}</div>)}{stations.map((station) => <div key={station.id} style={{ padding: 9, background: '#f9fafb', borderRadius: 7 }}>Станция <strong>{station.label ?? station.id}</strong> → {station.printerDeviceId ? (printerById.get(station.printerDeviceId)?.label ?? station.printerDeviceId) : 'без принтера'}</div>)}</div><h3 style={{ marginBottom: 6 }}>Последние задания</h3><div style={{ display: 'grid', gap: 6 }}>{jobs.slice(0, 30).map((job) => <div key={job.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 8, alignItems: 'center', padding: 8, borderTop: '1px solid #f3f4f6' }}><span><strong>{job.label ?? job.documentType ?? 'Печать'}</strong><small style={{ display: 'block', color: '#6b7280' }}>{job.status} · {job.lastErrorCode ?? 'без ошибки'}{job.lastErrorMessage ? ` · ${job.lastErrorMessage}` : ''}</small></span><span>{job.createdAt ? new Date(job.createdAt).toLocaleString('ru-RU') : ''}</span>{(job.status === 'FAILED' || job.status === 'OUTCOME_UNKNOWN') && <button type="button" onClick={() => void retry(job)}>Повторить</button>}</div>)}</div></section>
    </>}
    {sessionToken && role !== 'ADMIN' && <div style={{ marginTop: 18, padding: 12, background: '#fffbeb', color: '#92400e', borderRadius: 8 }}>Вошёл сотрудник без роли ADMIN. Конфигурация и повторы скрыты.</div>}
  </div>;
};

export default defineFrontComponent({
  universalIdentifier: MAHABBAT_PRINTING_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'mahabbat-printing-admin',
  description: 'Bounded administrative UI for physical POS printing routes and durable print jobs',
  component: PrintingAdmin,
});
