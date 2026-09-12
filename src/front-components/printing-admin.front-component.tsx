import { useCallback, useEffect, useMemo, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';

import { MAHABBAT_PRINTING_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const rest = new RestApiClient();

type Row = Record<string, unknown> & { id: string };
type Printer = Row & {
  label?: string;
  connectionType?: string;
  systemQueueName?: string | null;
  systemPrinterName?: string | null;
  systemDriverName?: string | null;
  systemPortName?: string | null;
  capabilityStatus?: string;
  isActive?: boolean;
  isPrecheckPrinter?: boolean;
  paperWidth?: string;
  encodingProfile?: string;
  status?: string;
};
type Station = Row & { label?: string; printerDeviceId?: string | null; isActive?: boolean };
type Job = Row & { label?: string; status?: string; documentType?: string; lastErrorMessage?: string; createdAt?: string };
type SystemPrinter = {
  id: string;
  name: string;
  systemQueueName: string;
  driverName?: string | null;
  portName?: string | null;
  isDefault?: boolean;
  status?: 'CONNECTED' | 'UNAVAILABLE' | 'UNKNOWN';
  isAvailable?: boolean;
  capabilityStatus?: 'SUPPORTED' | 'UNKNOWN' | 'UNSUPPORTED';
  lastSeen?: string;
};

const UUID = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes].map((byte, index) => `${byte.toString(16).padStart(2, '0')}${[3, 5, 7, 9].includes(index) ? '-' : ''}`).join('');
};

const unwrapRows = (value: unknown, root: string): Row[] => {
  if (Array.isArray(value)) return value.filter((row): row is Row => Boolean(row && typeof row === 'object' && 'id' in row));
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data.filter((row): row is Row => Boolean(row && typeof row === 'object' && 'id' in row));
  const node = record[root];
  if (node && typeof node === 'object') {
    const edges = (node as { edges?: Array<{ node?: Row | null } | null> }).edges;
    if (Array.isArray(edges)) return edges.map((edge) => edge?.node).filter((row): row is Row => Boolean(row?.id));
  }
  return [];
};

const unwrapSystemPrinters = (value: unknown): SystemPrinter[] => {
  if (!value || typeof value !== 'object') return [];
  const printers = (value as { printers?: unknown }).printers;
  return Array.isArray(printers) ? printers.filter((printer): printer is SystemPrinter => Boolean(printer && typeof printer === 'object' && typeof (printer as SystemPrinter).systemQueueName === 'string')) : [];
};

const statusLabel = (printer: Printer, system: SystemPrinter | null): string => {
  if (printer.connectionType !== 'WINDOWS_SPOOLER') return printer.status === 'REACHABLE' ? 'Подключён' : 'Состояние неизвестно';
  if (!printer.systemQueueName) return 'Не настроен';
  if (!system) return 'Не найден';
  if (system.status === 'CONNECTED') return 'Подключён';
  if (system.status === 'UNAVAILABLE') return 'Недоступен';
  return 'Состояние неизвестно';
};

const capabilityLabel = (value: string | undefined): string => value === 'SUPPORTED' ? 'Поддерживается' : value === 'UNSUPPORTED' ? 'Не поддерживается' : 'Совместимость не проверена';
const jobStatusLabel = (value: string | undefined): string => ({ QUEUED: 'В очереди', DISPATCHING: 'Отправляется', SENT: 'Отправлено на принтер', CONFIRMED: 'Подтверждено', FAILED: 'Ошибка печати', OUTCOME_UNKNOWN: 'Результат неизвестен' }[value ?? ''] ?? 'Состояние неизвестно');

const safeMessage = (value: unknown): string => {
  const message = value instanceof Error ? value.message : String(value);
  if (/[\u0000-\u001f]/.test(message)) return 'Операция не выполнена.';
  if (/printer|spooler|gateway|queue|route|signature|systemqueue|windows/i.test(message) && !/[А-Яа-яЁё]/.test(message)) return 'Печатное устройство сейчас недоступно.';
  return message || 'Операция не выполнена.';
};

const PrintingAdmin = () => {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinter[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [menuItems, setMenuItems] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pin, setPin] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [role, setRole] = useState('');
  const [printerForm, setPrinterForm] = useState({ printerDeviceId: '', label: '', systemQueueName: '', isActive: true, isPrecheckPrinter: false, paperWidth: '80', encodingProfile: 'CP866' });
  const [stationForm, setStationForm] = useState({ label: '', printerDeviceId: '' });
  const [routeDraft, setRouteDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [error, setError] = useState('');
  const [discoveryError, setDiscoveryError] = useState('');
  const [notice, setNotice] = useState('');

  const discover = useCallback(async () => {
    setDiscoveryLoading(true);
    setDiscoveryError('');
    try {
      const result = await rest.get<Record<string, unknown>>('/s/printing/system-printers');
      setSystemPrinters(unwrapSystemPrinters(result));
    } catch {
      setDiscoveryError('Список системных принтеров недоступен. Проверьте локальный печатный шлюз.');
    } finally {
      setDiscoveryLoading(false);
    }
  }, []);

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
      setError(safeMessage(value));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); void discover(); }, [load, discover]);

  const command = useCallback(async (name: string, payload: Record<string, unknown>) => {
    if (!sessionToken) throw new Error('Сначала войдите PIN администратора.');
    const result = await rest.post<Record<string, unknown>>('/s/pos/command', { command: name, sessionToken, payload });
    if (result.code || (typeof result.status === 'number' && result.status >= 400)) throw new Error(String(result.message ?? 'Команда отклонена.'));
    return result;
  }, [sessionToken]);

  const login = async () => {
    setError('');
    try {
      const result = await rest.post<Record<string, unknown>>('/s/pos/command', { command: 'authenticatePosStaff', payload: { pin, terminalId: 'printing-admin' } });
      if (!result.sessionToken || !result.staff || typeof result.staff !== 'object') throw new Error('Вход отклонён.');
      const staff = result.staff as Record<string, unknown>;
      setSessionToken(String(result.sessionToken));
      setRole(String(staff.role ?? ''));
      setPin('');
      setNotice('Административная сессия открыта');
    } catch (value) { setError(safeMessage(value)); }
  };

  const useSystemPrinter = (system: SystemPrinter) => {
    const existing = printers.find((printer) => printer.connectionType === 'WINDOWS_SPOOLER' && printer.systemQueueName === system.systemQueueName);
    setPrinterForm({
      printerDeviceId: existing?.id ?? '',
      label: existing?.label ?? `Принтер · ${system.name}`,
      systemQueueName: system.systemQueueName,
      isActive: existing?.isActive !== false,
      isPrecheckPrinter: existing?.isPrecheckPrinter === true,
      paperWidth: existing?.paperWidth === '58' ? '58' : '80',
      encodingProfile: existing?.encodingProfile === 'WINDOWS1251' ? 'WINDOWS1251' : existing?.encodingProfile === 'UTF8' ? 'UTF8' : 'CP866',
    });
    setNotice(`Выбрано устройство «${system.name}»`);
  };

  const savePrinter = async () => {
    try {
      if (!printerForm.systemQueueName) throw new Error('Выберите системный принтер.');
      await command('upsertPrinterDevice', {
        ...(printerForm.printerDeviceId ? { printerDeviceId: printerForm.printerDeviceId } : {}),
        label: printerForm.label,
        connectionType: 'WINDOWS_SPOOLER',
        systemQueueName: printerForm.systemQueueName,
        host: 'windows-spooler',
        port: 9100,
        isActive: printerForm.isActive,
        isPrecheckPrinter: printerForm.isPrecheckPrinter,
        paperWidth: printerForm.paperWidth,
        encodingProfile: printerForm.encodingProfile,
        escPosCodePage: printerForm.encodingProfile === 'CP866' ? 17 : null,
        cutSupport: true,
      });
      setNotice('Принтер сохранён');
      setPrinterForm({ printerDeviceId: '', label: '', systemQueueName: '', isActive: true, isPrecheckPrinter: false, paperWidth: '80', encodingProfile: 'CP866' });
      await load();
    } catch (value) { setError(safeMessage(value)); }
  };

  const testPrint = async (printer: Printer) => {
    try {
      await command('testPrinterDevice', { printerDeviceId: printer.id, idempotencyKey: UUID() });
      setNotice('Тестовая печать отправлена на принтер');
      window.setTimeout(() => { void load(); }, 1200);
    } catch (value) { setError(safeMessage(value)); }
  };

  const saveStation = async (station?: Station) => {
    try {
      const form = station ?? { label: stationForm.label, printerDeviceId: stationForm.printerDeviceId, isActive: true } as Station;
      await command('upsertProductionStation', { ...(station?.id ? { productionStationId: station.id } : {}), label: String(form.label ?? ''), printerDeviceId: form.printerDeviceId || null, isActive: form.isActive !== false });
      setStationForm({ label: '', printerDeviceId: '' });
      setNotice('Маршрутизация сохранена');
      await load();
    } catch (value) { setError(safeMessage(value)); }
  };

  const setRoute = async (menuItemId: string) => {
    try {
      await command('setMenuItemProductionStation', { menuItemId, productionStationId: routeDraft[menuItemId] || null, idempotencyKey: UUID() });
      setNotice('Маршрут блюда сохранён');
      await load();
    } catch (value) { setError(safeMessage(value)); }
  };

  const retry = async (job: Job) => {
    if (!globalThis.confirm?.('Создать отдельное задание повторной печати?')) return;
    try {
      await command('retryPrintJob', { printJobId: job.id, idempotencyKey: UUID() });
      setNotice('Повторное задание поставлено в очередь');
      await load();
    } catch (value) { setError(safeMessage(value)); }
  };

  const systemByQueue = useMemo(() => new Map(systemPrinters.map((printer) => [printer.systemQueueName, printer])), [systemPrinters]);

  return <div style={{ boxSizing: 'border-box', width: '100%', maxWidth: 1180, padding: 20, fontFamily: 'Inter, system-ui, sans-serif', color: '#eee8dc' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div><h1 style={{ margin: 0, fontSize: 24, color: '#f4efe5' }}>Печать</h1><p style={{ color: '#aaa69e', margin: '5px 0 0' }}>Подключённые устройства и маршрутизация печати</p></div>
      <button type="button" onClick={() => { void load(); void discover(); }} disabled={loading || discoveryLoading} style={{ marginLeft: 'auto', padding: '8px 12px' }}>{loading || discoveryLoading ? 'Обновляем…' : 'Обновить список'}</button>
    </div>
    {error && <div role="alert" style={{ marginTop: 12, padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8 }}>{error}</div>}
    {discoveryError && <div role="status" style={{ marginTop: 12, padding: 10, background: '#fffbeb', color: '#92400e', borderRadius: 8 }}>{discoveryError}</div>}
    {notice && <div role="status" style={{ marginTop: 12, padding: 10, background: '#ecfdf5', color: '#065f46', borderRadius: 8 }}>{notice}</div>}
    {!sessionToken ? <section style={{ marginTop: 18, padding: 16, border: '1px solid #34343a', borderRadius: 10 }}>
      <h2 style={{ fontSize: 17, marginTop: 0, color: '#f4efe5' }}>Вход администратора</h2><p style={{ color: '#aaa69e' }}>PIN нужен только для изменения настроек печати и тестовой печати.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input aria-label="PIN администратора" type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="PIN" /><button type="button" onClick={() => void login()}>Войти</button></div>
    </section> : <div style={{ marginTop: 14, color: '#065f46' }}>Сессия: {role || 'POS'} · браузер не подключается к принтеру напрямую.</div>}
    {sessionToken && role === 'ADMIN' && <>
      <section style={{ marginTop: 18, padding: 16, border: '1px solid #34343a', borderRadius: 10, background: '#111113' }}>
        <h2 style={{ fontSize: 17, marginTop: 0, color: '#f4efe5' }}>Устройства</h2>
        <p style={{ color: '#aaa69e', marginTop: 0 }}>Список предоставлен локальным печатным шлюзом Windows. Состояние «Подключён» означает доступность очереди, а не подтверждение бумаги.</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {systemPrinters.map((system) => {
            const configured = printers.find((printer) => printer.connectionType === 'WINDOWS_SPOOLER' && printer.systemQueueName === system.systemQueueName);
            return <div key={system.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: 11, background: '#171719', borderRadius: 8 }}>
              <div style={{ minWidth: 230, flex: '1 1 280px' }}><strong>{system.name}</strong><div style={{ color: system.isAvailable ? '#047857' : '#b91c1c', marginTop: 3 }}>{system.isAvailable ? '● Доступен' : '○ Недоступен'} · {capabilityLabel(system.capabilityStatus)}</div></div>
              <div style={{ color: '#aaa69e', fontSize: 13 }}>{system.isDefault ? 'Принтер по умолчанию' : ''}</div>
              <button type="button" onClick={() => useSystemPrinter(system)}>{configured ? 'Настроить' : 'Использовать'}</button>
              {configured && <button type="button" onClick={() => void testPrint(configured)}>Тестовая печать</button>}
              <details style={{ width: '100%' }}><summary style={{ cursor: 'pointer', color: '#aaa69e' }}>Подробнее</summary><div style={{ color: '#aaa69e', fontSize: 12, marginTop: 5 }}>Системное имя: {system.systemQueueName} · Драйвер: {system.driverName ?? '—'} · Порт: {system.portName ?? '—'}</div></details>
            </div>;
          })}
          {!systemPrinters.length && !discoveryError && <div style={{ color: '#aaa69e' }}>Системные принтеры не обнаружены.</div>}
        </div>
      </section>

      <section style={{ marginTop: 18, padding: 16, border: '1px solid #34343a', borderRadius: 10, background: '#111113' }}>
        <h2 style={{ fontSize: 17, marginTop: 0, color: '#f4efe5' }}>{printerForm.printerDeviceId ? 'Изменить принтер' : 'Добавить принтер'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, alignItems: 'end' }}>
          <label>Название<input style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4 }} value={printerForm.label} onChange={(event) => setPrinterForm({ ...printerForm, label: event.target.value })} placeholder="Например, Принтер кухни" /></label>
          <label>Системный принтер<select style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4 }} value={printerForm.systemQueueName} onChange={(event) => { const system = systemPrinters.find((item) => item.systemQueueName === event.target.value); setPrinterForm({ ...printerForm, systemQueueName: event.target.value, label: printerForm.label || (system ? `Принтер · ${system.name}` : '') }); }}><option value="">Выберите устройство</option>{systemPrinters.map((system) => <option key={system.id} value={system.systemQueueName}>{system.name}</option>)}</select></label>
          <label>Профиль<select style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4 }} value={printerForm.encodingProfile} onChange={(event) => setPrinterForm({ ...printerForm, encodingProfile: event.target.value })}><option value="CP866">ESC/POS · CP866</option><option value="WINDOWS1251">ESC/POS · Windows-1251</option><option value="UTF8">ESC/POS · UTF-8</option></select></label>
          <label>Ширина бумаги<select style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4 }} value={printerForm.paperWidth} onChange={(event) => setPrinterForm({ ...printerForm, paperWidth: event.target.value })}><option value="80">80 мм</option><option value="58">58 мм</option></select></label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={printerForm.isPrecheckPrinter} onChange={(event) => setPrinterForm({ ...printerForm, isPrecheckPrinter: event.target.checked })} /> Использовать для пречеков</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={printerForm.isActive} onChange={(event) => setPrinterForm({ ...printerForm, isActive: event.target.checked })} /> Активен</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" onClick={() => void savePrinter()} disabled={!printerForm.systemQueueName}>Сохранить</button><button type="button" onClick={() => setPrinterForm({ printerDeviceId: '', label: '', systemQueueName: '', isActive: true, isPrecheckPrinter: false, paperWidth: '80', encodingProfile: 'CP866' })}>Очистить</button></div>
        </div>
      </section>

      <section style={{ marginTop: 18, padding: 16, border: '1px solid #34343a', borderRadius: 10, background: '#111113' }}>
        <h2 style={{ fontSize: 17, marginTop: 0, color: '#f4efe5' }}>Маршрутизация</h2>
        <p style={{ color: '#aaa69e', marginTop: 0 }}>Один принтер можно назначить нескольким станциям. Новые задания используют сохранённый маршрут; исторические задания не меняются.</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {stations.map((station) => <div key={station.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) minmax(220px,360px) auto', gap: 8, alignItems: 'center' }}><strong>{station.label ?? 'Станция'}</strong><select aria-label={`Принтер станции ${station.label ?? ''}`} value={routeDraft[station.id] ?? station.printerDeviceId ?? ''} onChange={(event) => setRouteDraft({ ...routeDraft, [station.id]: event.target.value })}><option value="">Без принтера</option>{printers.filter((printer) => printer.isActive !== false).map((printer) => <option key={printer.id} value={printer.id}>{printer.label ?? 'Принтер'} · {statusLabel(printer, printer.systemQueueName ? systemByQueue.get(printer.systemQueueName) ?? null : null)}</option>)}</select><button type="button" onClick={() => void saveStation({ ...station, printerDeviceId: routeDraft[station.id] ?? station.printerDeviceId ?? null })}>Сохранить</button></div>)}
          {!stations.length && <div style={{ color: '#aaa69e' }}>Станции ещё не настроены.</div>}
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #34343a' }}><strong>Добавить станцию</strong><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 7 }}><input aria-label="Название станции" placeholder="Кухня, Бар или Мангал" value={stationForm.label} onChange={(event) => setStationForm({ ...stationForm, label: event.target.value })} /><select aria-label="Принтер новой станции" value={stationForm.printerDeviceId} onChange={(event) => setStationForm({ ...stationForm, printerDeviceId: event.target.value })}><option value="">Без принтера</option>{printers.map((printer) => <option key={printer.id} value={printer.id}>{printer.label ?? 'Принтер'}</option>)}</select><button type="button" onClick={() => void saveStation()}>Добавить станцию</button></div></div>
      </section>

      <section style={{ marginTop: 18, padding: 16, border: '1px solid #34343a', borderRadius: 10, background: '#111113' }}><h2 style={{ fontSize: 17, marginTop: 0, color: '#f4efe5' }}>Маршрут блюд</h2><p style={{ color: '#aaa69e', marginTop: 0 }}>Станция фиксируется в задании печати при отправке.</p><div style={{ display: 'grid', gap: 7, overflowX: 'auto' }}>{menuItems.map((item) => <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) minmax(180px,280px) auto', gap: 8, alignItems: 'center' }}><span>{String(item.name ?? 'Блюдо')}</span><select value={routeDraft[item.id] ?? String(item.productionStationId ?? '')} onChange={(event) => setRouteDraft({ ...routeDraft, [item.id]: event.target.value })}><option value="">Без станции</option>{stations.map((station) => <option key={station.id} value={station.id}>{station.label ?? 'Станция'}</option>)}</select><button type="button" onClick={() => void setRoute(item.id)}>Сохранить</button></div>)}</div></section>

      <section style={{ marginTop: 18, padding: 16, border: '1px solid #34343a', borderRadius: 10, background: '#111113' }}><h2 style={{ fontSize: 17, marginTop: 0, color: '#f4efe5' }}>Настроенные принтеры и задания</h2><div style={{ display: 'grid', gap: 7 }}>{printers.map((printer) => { const system = printer.systemQueueName ? systemByQueue.get(printer.systemQueueName) ?? null : null; return <div key={printer.id} style={{ padding: 10, background: '#171719', borderRadius: 7, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><div style={{ flex: '1 1 260px' }}><strong>{printer.label ?? 'Принтер'}</strong><div style={{ color: statusLabel(printer, system) === 'Подключён' ? '#9fdbb4' : '#edcf95', marginTop: 3 }}>{statusLabel(printer, system)}{printer.isPrecheckPrinter ? ' · пречек' : ''}</div></div>{printer.connectionType === 'WINDOWS_SPOOLER' && !system && <span style={{ color: '#f0a6aa' }}>⚠ Не найден в Windows</span>}<button type="button" onClick={() => void testPrint(printer)} disabled={printer.isActive === false || (printer.connectionType === 'WINDOWS_SPOOLER' && !system)}>Тестовая печать</button><details style={{ width: '100%' }}><summary style={{ cursor: 'pointer', color: '#aaa69e' }}>Подробнее</summary><div style={{ color: '#aaa69e', fontSize: 12, marginTop: 5 }}>Профиль: {printer.paperWidth ?? '80'} мм · {printer.encodingProfile ?? 'CP866'}{printer.systemQueueName ? ` · системное имя: ${printer.systemQueueName}` : ''}</div></details></div>; })}</div><h3 style={{ marginBottom: 6, color: '#f4efe5' }}>Последние задания</h3><div style={{ display: 'grid', gap: 6 }}>{jobs.slice(0, 30).map((job) => <div key={job.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 8, alignItems: 'center', padding: 8, borderTop: '1px solid #34343a' }}><span><strong>{job.label ?? 'Печать'}</strong><small style={{ display: 'block', color: job.status === 'FAILED' ? '#f0a6aa' : '#aaa69e' }}>{jobStatusLabel(job.status)}{job.lastErrorMessage ? ` · ${job.lastErrorMessage}` : ''}</small></span><span>{job.createdAt ? new Date(job.createdAt).toLocaleString('ru-RU') : ''}</span>{(job.status === 'FAILED' || job.status === 'OUTCOME_UNKNOWN') && <button type="button" onClick={() => void retry(job)}>Повторить</button>}</div>)}</div></section>
    </>}
    {sessionToken && role !== 'ADMIN' && <div style={{ marginTop: 18, padding: 12, background: '#fffbeb', color: '#92400e', borderRadius: 8 }}>Вошёл сотрудник без роли ADMIN. Конфигурация печати скрыта.</div>}
  </div>;
};

export default defineFrontComponent({
  universalIdentifier: MAHABBAT_PRINTING_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'mahabbat-printing-admin',
  description: 'Administrative UI for Windows printer discovery and server-side print routing',
  component: PrintingAdmin,
});
