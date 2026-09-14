import { useCallback, useEffect, useMemo, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';

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
  const nestedData = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : null;
  if (Array.isArray(record.data)) return record.data.filter((row): row is Row => Boolean(row && typeof row === 'object' && 'id' in row));
  const node = record[root] ?? nestedData?.[root];
  if (Array.isArray(node)) return node.filter((row): row is Row => Boolean(row && typeof row === 'object' && 'id' in row));
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
  if (/\b401\b|unauthorized/i.test(message) && !/[А-Яа-яЁё]/.test(message)) return 'Административная сессия истекла. Войдите снова.';
  if (/request to .*status \d{3}|bad request|internal server error/i.test(message) && !/[А-Яа-яЁё]/.test(message)) return 'Операция не выполнена. Проверьте данные и повторите.';
  if (/printer|spooler|gateway|queue|route|signature|systemqueue|windows|econnrefused|econnreset|timed? ?out|powershell|win32|raw/i.test(message) && !/[А-Яа-яЁё]/.test(message)) return 'Печатное устройство сейчас недоступно.';
  return message || 'Операция не выполнена.';
};

const isTechnicalFixture = (value: unknown): boolean => /(^|\b)(INV[-_]|acceptance|fixture|missing recipe|uuid[-_]?like|virtual review|local simulator|test printer|тестов(ый|ая)|симулятор)(\b|$)/i.test(String(value ?? ''));
const humanMenuItems = (items: Row[]): Row[] => items.filter((item) => !isTechnicalFixture(item.name));
const humanJobLabel = (value: unknown): string => isTechnicalFixture(value) ? 'Сохранённое задание' : String(value ?? 'Печать');
const humanPrinterLabel = (printer: Printer): string => isTechnicalFixture(`${printer.label ?? ''} ${printer.systemQueueName ?? ''}`) ? 'Текущее устройство' : String(printer.label ?? 'Принтер');

const pageStyle = { boxSizing: 'border-box', width: '100%', maxWidth: 1180, padding: '24px 20px 48px', fontFamily: 'Inter, system-ui, sans-serif', color: '#eee8dc' } as const;
const cardStyle = { marginTop: 16, padding: 18, border: '1px solid #34343a', borderRadius: 12, background: '#111113', minWidth: 0 };
const mutedStyle = { color: '#aaa69e' };
const primaryButtonStyle = { padding: '9px 14px', border: '1px solid #e7d7ba', borderRadius: 7, background: '#f4efe5', color: '#171719', fontWeight: 700, cursor: 'pointer' };
const secondaryButtonStyle = { padding: '9px 14px', border: '1px solid #58585f', borderRadius: 7, background: '#202023', color: '#f4efe5', fontWeight: 600, cursor: 'pointer' };
const disabledButtonStyle = { opacity: 0.55, cursor: 'not-allowed' };
const inputStyle = { display: 'block', width: '100%', boxSizing: 'border-box' as const, marginTop: 6, minHeight: 38, padding: '8px 10px', border: '1px solid #58585f', borderRadius: 7, background: '#1b1b1e', color: '#f4efe5' };
const selectStyle = { ...inputStyle, appearance: 'auto' as const };

const statusTone = (status: string): { background: string; color: string; border: string } => status === 'Подключён' || status === 'Доступен'
  ? { background: '#123b2b', color: '#9fdbb4', border: '#236244' }
  : status === 'Недоступен' || status === 'Не найден'
    ? { background: '#3d2023', color: '#f0a6aa', border: '#71343a' }
    : { background: '#332d1d', color: '#edcf95', border: '#62512c' };

export const PrintingAdmin = () => {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinter[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [menuItems, setMenuItems] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
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
    const result = await rest.post<Record<string, unknown>>('/s/pos/command', { command: name, payload });
    if (result.code || (typeof result.status === 'number' && result.status >= 400)) throw new Error(String(result.message ?? 'Команда отклонена.'));
    return result;
  }, []);

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
      globalThis.setTimeout(() => { void load(); }, 1200);
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
  const visibleMenuItems = useMemo(() => humanMenuItems(menuItems), [menuItems]);
  const humanPrinters = useMemo(() => printers.filter((printer) => !isTechnicalFixture(`${printer.label ?? ''} ${printer.systemQueueName ?? ''}`)), [printers]);
  const humanJobs = useMemo(() => jobs.filter((job) => !isTechnicalFixture(job.label)), [jobs]);
  const hiddenPrinterCount = printers.length - humanPrinters.length;
  const brokenBindingCount = humanPrinters.filter((printer) => printer.connectionType === 'WINDOWS_SPOOLER' && printer.systemQueueName && !systemByQueue.has(printer.systemQueueName)).length;
  const routeOptions = (station: Station): Printer[] => {
    const options = [...humanPrinters];
    if (station.printerDeviceId && !options.some((printer) => printer.id === station.printerDeviceId)) {
      const current = printers.find((printer) => printer.id === station.printerDeviceId);
      if (current) options.push(current);
    }
    return options;
  };

  return <div style={pageStyle}>
    <header style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: '1 1 420px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 9px', borderRadius: 999, background: '#2a241b', color: '#edcf95', fontSize: 12, fontWeight: 700 }}>НАСТРОЙКА ПЕЧАТИ</div>
        <h1 style={{ margin: '10px 0 4px', fontSize: 28, color: '#f4efe5', letterSpacing: '-0.02em' }}>Печать</h1>
        <p style={{ ...mutedStyle, margin: 0, fontSize: 15 }}>Подключите принтер один раз — дальше Mahabbat сам отправит документы на нужное место.</p>
      </div>
      <button type="button" onClick={() => { void load(); void discover(); }} disabled={loading || discoveryLoading} style={{ ...secondaryButtonStyle, marginLeft: 'auto', ...(loading || discoveryLoading ? disabledButtonStyle : {}) }}>{loading || discoveryLoading ? 'Обновляем список…' : '↻ Обновить список'}</button>
    </header>
    {error && <div role="alert" style={{ marginTop: 14, padding: 12, background: '#3d2023', color: '#f0a6aa', border: '1px solid #71343a', borderRadius: 9 }}>{error}</div>}
    {discoveryError && <div role="status" style={{ marginTop: 14, padding: 12, background: '#332d1d', color: '#edcf95', border: '1px solid #62512c', borderRadius: 9 }}>{discoveryError}</div>}
    {notice && <div role="status" style={{ marginTop: 14, padding: 12, background: '#123b2b', color: '#9fdbb4', border: '1px solid #236244', borderRadius: 9 }}>{notice}</div>}

    <section style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 1fr)', gap: 20, background: 'linear-gradient(135deg, #292219 0%, #171719 68%)', borderColor: '#5a4930' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: '#edcf95', fontSize: 13, fontWeight: 700 }}>ПОДКЛЮЧЕНИЕ ЗА 3 ШАГА</div>
        <h2 style={{ margin: '8px 0 8px', fontSize: 21, color: '#f4efe5' }}>Как начать печатать</h2>
        <p style={{ ...mutedStyle, margin: 0, lineHeight: 1.55 }}>Установите принтер в Windows, обновите список ниже и выберите его. IP-адрес, порт и драйвер вручную вводить не нужно.</p>
      </div>
      <ol style={{ display: 'grid', gap: 9, margin: 0, padding: 0, listStyle: 'none' }}>
        {['Установите принтер в Windows', 'Нажмите «Обновить список»', 'Выберите устройство и назначьте место печати'].map((step, index) => <li key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#eee8dc', fontSize: 13 }}><span style={{ display: 'grid', placeItems: 'center', flex: '0 0 25px', width: 25, height: 25, borderRadius: '50%', background: '#d0a95b', color: '#171719', fontWeight: 800 }}>{index + 1}</span><span>{step}</span></li>)}
      </ol>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 14 }}>
      {[['В Windows', String(systemPrinters.length), 'обнаружено устройств'], ['В Mahabbat', String(humanPrinters.length), 'настроено устройств'], ['Места печати', String(stations.length), 'станций настроено'], ['Требуют внимания', String(brokenBindingCount), brokenBindingCount ? 'устройств не найдено' : 'всё выглядит хорошо']].map(([label, value, note]) => <div key={label} style={{ padding: '13px 15px', border: '1px solid #34343a', borderRadius: 10, background: '#171719', minWidth: 0 }}><div style={{ ...mutedStyle, fontSize: 12 }}>{label}</div><strong style={{ display: 'block', marginTop: 4, fontSize: 22, color: label === 'Требуют внимания' && brokenBindingCount ? '#f0a6aa' : '#f4efe5' }}>{value}</strong><div style={{ ...mutedStyle, marginTop: 2, fontSize: 12 }}>{note}</div></div>)}
    </section>

    <section style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div><div style={{ color: '#edcf95', fontSize: 12, fontWeight: 700 }}>ШАГ 1</div><h2 style={{ margin: '5px 0 4px', fontSize: 20, color: '#f4efe5' }}>Выберите принтер</h2><p style={{ ...mutedStyle, margin: 0 }}>Здесь показаны устройства, которые сейчас видит Windows.</p></div>
        <span style={{ ...mutedStyle, fontSize: 12 }}>Обновлено вместе со списком выше</span>
      </div>
      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        {systemPrinters.map((system) => {
          const configured = printers.find((printer) => printer.connectionType === 'WINDOWS_SPOOLER' && printer.systemQueueName === system.systemQueueName);
          const availability = system.status === 'CONNECTED' ? 'Доступен' : system.status === 'UNAVAILABLE' ? 'Недоступен' : 'Состояние неизвестно';
          const tone = statusTone(availability);
          return <div key={system.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 14, alignItems: 'center', padding: 14, background: '#171719', border: '1px solid #29292d', borderRadius: 10, minWidth: 0 }}>
            <div style={{ minWidth: 0 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><strong style={{ color: '#f4efe5', fontSize: 15 }}>{system.name}</strong>{system.isDefault && <span style={{ ...mutedStyle, fontSize: 12 }}>по умолчанию</span>}</div><div style={{ display: 'inline-flex', marginTop: 6, padding: '3px 8px', borderRadius: 999, border: `1px solid ${tone.border}`, background: tone.background, color: tone.color, fontSize: 12 }}>{availability}</div><span style={{ ...mutedStyle, marginLeft: 8, fontSize: 12 }}>{capabilityLabel(system.capabilityStatus)}</span>{configured && <div style={{ ...mutedStyle, marginTop: 8, fontSize: 12 }}>Уже настроен в Mahabbat как «{humanPrinterLabel(configured)}»</div>}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}><button type="button" onClick={() => useSystemPrinter(system)} style={primaryButtonStyle}>{configured ? 'Изменить настройку' : 'Выбрать'}</button>{configured && <button type="button" onClick={() => void testPrint(configured)} disabled={!system.isAvailable} style={{ ...secondaryButtonStyle, ...(!system.isAvailable ? disabledButtonStyle : {}) }}>Тестовая печать</button>}</div>
            <details style={{ gridColumn: '1 / -1' }}><summary style={{ ...mutedStyle, cursor: 'pointer', fontSize: 12 }}>Технические сведения</summary><div style={{ ...mutedStyle, marginTop: 8, fontSize: 12, lineHeight: 1.5 }}>Имя устройства: {system.systemQueueName} · Драйвер: {system.driverName ?? 'не указан'} · Порт: {system.portName ?? 'не указан'}</div></details>
          </div>;
        })}
        {!systemPrinters.length && !discoveryError && <div style={{ padding: 14, border: '1px dashed #58585f', borderRadius: 9, ...mutedStyle }}>Windows пока не сообщила об установленных принтерах. Установите принтер и нажмите «Обновить список».</div>}
      </div>
    </section>

    <section style={cardStyle}>
      <div style={{ color: '#edcf95', fontSize: 12, fontWeight: 700 }}>ШАГ 2</div>
      <h2 style={{ margin: '5px 0 4px', fontSize: 20, color: '#f4efe5' }}>{printerForm.printerDeviceId ? 'Измените настройку устройства' : 'Сохраните устройство в Mahabbat'}</h2>
      <p style={{ ...mutedStyle, margin: 0 }}>Название увидят сотрудники. Остальные параметры нужны только для корректного формата печати.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, marginTop: 16, alignItems: 'end' }}>
        <label style={{ minWidth: 0 }}>Название в Mahabbat<input style={inputStyle} value={printerForm.label} onChange={(event) => setPrinterForm({ ...printerForm, label: event.target.value })} placeholder="Например, Принтер кухни" /></label>
        <label style={{ minWidth: 0 }}>Устройство Windows<select style={selectStyle} value={printerForm.systemQueueName} onChange={(event) => { const system = systemPrinters.find((item) => item.systemQueueName === event.target.value); setPrinterForm({ ...printerForm, systemQueueName: event.target.value, label: printerForm.label || (system ? `Принтер · ${system.name}` : '') }); }}><option value="">Сначала выберите устройство</option>{systemPrinters.map((system) => <option key={system.id} value={system.systemQueueName}>{system.name}</option>)}</select></label>
        <label style={{ minWidth: 0 }}>Профиль печати<select style={selectStyle} value={printerForm.encodingProfile} onChange={(event) => setPrinterForm({ ...printerForm, encodingProfile: event.target.value })}><option value="CP866">ESC/POS · CP866</option><option value="WINDOWS1251">ESC/POS · Windows-1251</option><option value="UTF8">ESC/POS · UTF-8</option></select></label>
        <label style={{ minWidth: 0 }}>Ширина бумаги<select style={selectStyle} value={printerForm.paperWidth} onChange={(event) => setPrinterForm({ ...printerForm, paperWidth: event.target.value })}><option value="80">80 мм</option><option value="58">58 мм</option></select></label>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}><label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={printerForm.isPrecheckPrinter} onChange={(event) => setPrinterForm({ ...printerForm, isPrecheckPrinter: event.target.checked })} /> Использовать для пречеков</label><label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={printerForm.isActive} onChange={(event) => setPrinterForm({ ...printerForm, isActive: event.target.checked })} /> Устройство активно</label><div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}><button type="button" onClick={() => void savePrinter()} disabled={!printerForm.systemQueueName} style={{ ...primaryButtonStyle, ...(!printerForm.systemQueueName ? disabledButtonStyle : {}) }}>{printerForm.printerDeviceId ? 'Сохранить изменения' : 'Сохранить устройство'}</button><button type="button" onClick={() => setPrinterForm({ printerDeviceId: '', label: '', systemQueueName: '', isActive: true, isPrecheckPrinter: false, paperWidth: '80', encodingProfile: 'CP866' })} style={secondaryButtonStyle}>Очистить</button></div></div>
      {!printerForm.systemQueueName && <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: '#202023', color: '#aaa69e', fontSize: 13 }}>Сначала нажмите «Выбрать» у нужного устройства выше.</div>}
    </section>

    <section style={cardStyle}>
      <div style={{ color: '#edcf95', fontSize: 12, fontWeight: 700 }}>ШАГ 3</div>
      <h2 style={{ margin: '5px 0 4px', fontSize: 20, color: '#f4efe5' }}>Укажите, куда печатать</h2>
      <p style={{ ...mutedStyle, margin: 0, lineHeight: 1.5 }}>Выберите принтер для каждой станции. Один принтер можно использовать сразу для нескольких мест.</p>
      <div style={{ display: 'grid', gap: 9, marginTop: 16 }}>
        {stations.map((station) => {
          const value = routeDraft[station.id] ?? station.printerDeviceId ?? '';
          const selected = printers.find((printer) => printer.id === value);
          const options = routeOptions(station).filter((printer) => printer.isActive !== false);
          return <div key={station.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 0.65fr) minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '10px 12px', background: '#171719', borderRadius: 9, minWidth: 0 }}><div style={{ minWidth: 0 }}><strong>{station.label ?? 'Место печати'}</strong><div style={{ ...mutedStyle, marginTop: 3, fontSize: 12 }}>{selected ? 'Принтер выбран' : 'Маршрут ещё не настроен'}</div></div><select aria-label={`Принтер для ${station.label ?? 'станции'}`} style={{ ...selectStyle, marginTop: 0, minWidth: 0 }} value={value} onChange={(event) => setRouteDraft({ ...routeDraft, [station.id]: event.target.value })}><option value="">Не печатать здесь</option>{options.map((printer) => <option key={printer.id} value={printer.id}>{humanPrinterLabel(printer)}{isTechnicalFixture(`${printer.label ?? ''} ${printer.systemQueueName ?? ''}`) ? ' · нужно заменить' : ''}</option>)}</select><button type="button" onClick={() => void saveStation({ ...station, printerDeviceId: value || null })} style={secondaryButtonStyle}>Сохранить</button></div>;
        })}
        {!stations.length && <div style={{ padding: 14, border: '1px dashed #58585f', borderRadius: 9, ...mutedStyle }}>Станции появятся здесь после настройки рабочего пространства.</div>}
      </div>
      <details style={{ marginTop: 16, paddingTop: 13, borderTop: '1px solid #34343a' }}><summary style={{ cursor: 'pointer', color: '#f4efe5', fontWeight: 700 }}>Добавить новое место печати</summary><div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 1fr) auto', gap: 10, marginTop: 12, alignItems: 'end' }}><label>Название места<input aria-label="Название места печати" style={inputStyle} placeholder="Кухня, Бар или Мангал" value={stationForm.label} onChange={(event) => setStationForm({ ...stationForm, label: event.target.value })} /></label><label>Принтер<select aria-label="Принтер нового места печати" style={selectStyle} value={stationForm.printerDeviceId} onChange={(event) => setStationForm({ ...stationForm, printerDeviceId: event.target.value })}><option value="">Без принтера</option>{humanPrinters.map((printer) => <option key={printer.id} value={printer.id}>{humanPrinterLabel(printer)}</option>)}</select></label><button type="button" onClick={() => void saveStation()} style={primaryButtonStyle}>Добавить место</button></div></details>
    </section>

    <details style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}><summary style={{ padding: 18, cursor: 'pointer', color: '#f4efe5', fontSize: 17, fontWeight: 700, listStylePosition: 'inside' }}>Дополнительные маршруты блюд <span style={{ ...mutedStyle, fontSize: 12, fontWeight: 400 }}>— для особых случаев</span></summary><div style={{ padding: '0 18px 18px' }}><p style={{ ...mutedStyle, marginTop: 0 }}>Обычно достаточно маршрута станции. Здесь можно отдельно указать станцию для конкретного блюда.</p><div style={{ display: 'grid', gap: 7, overflowX: 'auto' }}>{visibleMenuItems.map((item) => <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) minmax(180px,280px) auto', gap: 8, alignItems: 'center', minWidth: 0 }}><span>{String(item.name ?? 'Блюдо')}</span><select style={selectStyle} value={routeDraft[item.id] ?? String(item.productionStationId ?? '')} onChange={(event) => setRouteDraft({ ...routeDraft, [item.id]: event.target.value })}><option value="">По маршруту станции</option>{stations.map((station) => <option key={station.id} value={station.id}>{station.label ?? 'Станция'}</option>)}</select><button type="button" onClick={() => void setRoute(item.id)} style={secondaryButtonStyle}>Сохранить</button></div>)}</div></div></details>

    <details style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}><summary style={{ padding: 18, cursor: 'pointer', color: '#f4efe5', fontSize: 17, fontWeight: 700, listStylePosition: 'inside' }}>Диагностика и история печати <span style={{ ...mutedStyle, fontSize: 12, fontWeight: 400 }}>— открывать при необходимости</span></summary><div style={{ padding: '0 18px 18px' }}><p style={{ ...mutedStyle, marginTop: 0 }}>Здесь находятся подробности для проверки работы шлюза и повторной отправки неудачных заданий.</p><div style={{ display: 'grid', gap: 8 }}>{humanPrinters.map((printer) => { const system = printer.systemQueueName ? systemByQueue.get(printer.systemQueueName) ?? null : null; const state = statusLabel(printer, system); const tone = statusTone(state); return <div key={printer.id} style={{ padding: 12, background: '#171719', borderRadius: 9, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><div style={{ flex: '1 1 260px', minWidth: 0 }}><strong>{humanPrinterLabel(printer)}</strong><div style={{ display: 'inline-flex', marginTop: 5, padding: '3px 8px', borderRadius: 999, border: `1px solid ${tone.border}`, background: tone.background, color: tone.color, fontSize: 12 }}>{state}{printer.isPrecheckPrinter ? ' · пречек' : ''}</div></div>{printer.connectionType === 'WINDOWS_SPOOLER' && !system && <span style={{ color: '#f0a6aa', fontSize: 13 }}>⚠ Устройство не найдено в Windows</span>}<button type="button" onClick={() => void testPrint(printer)} disabled={printer.isActive === false || (printer.connectionType === 'WINDOWS_SPOOLER' && !system)} style={{ ...secondaryButtonStyle, ...(printer.isActive === false || (printer.connectionType === 'WINDOWS_SPOOLER' && !system) ? disabledButtonStyle : {}) }}>Тестовая печать</button><details style={{ width: '100%' }}><summary style={{ ...mutedStyle, cursor: 'pointer', fontSize: 12 }}>Технические сведения</summary><div style={{ ...mutedStyle, fontSize: 12, marginTop: 5 }}>Профиль: {printer.paperWidth ?? '80'} мм · {printer.encodingProfile ?? 'CP866'}{printer.systemQueueName ? ` · имя устройства: ${printer.systemQueueName}` : ''}</div></details></div>; })}</div>{!humanPrinters.length && <div style={{ padding: 12, ...mutedStyle }}>Настроенных пользовательских принтеров пока нет.</div>}<h3 style={{ margin: '18px 0 7px', color: '#f4efe5', fontSize: 15 }}>Последние задания</h3><div style={{ display: 'grid', gap: 6 }}>{humanJobs.slice(0, 30).map((job) => <div key={job.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 8, alignItems: 'center', padding: 9, borderTop: '1px solid #34343a', minWidth: 0 }}><span style={{ minWidth: 0 }}><strong>{humanJobLabel(job.label)}</strong><small style={{ display: 'block', color: job.status === 'FAILED' ? '#f0a6aa' : '#aaa69e' }}>{jobStatusLabel(job.status)}{job.lastErrorMessage ? ` · ${safeMessage(job.lastErrorMessage)}` : ''}</small></span><span style={{ ...mutedStyle, fontSize: 12 }}>{job.createdAt ? new Date(job.createdAt).toLocaleString('ru-RU') : ''}</span>{(job.status === 'FAILED' || job.status === 'OUTCOME_UNKNOWN') && <button type="button" onClick={() => void retry(job)} style={secondaryButtonStyle}>Повторить</button>}</div>)}</div>{hiddenPrinterCount > 0 && <p style={{ ...mutedStyle, marginBottom: 0, fontSize: 12 }}>Скрыто технических тестовых устройств: {hiddenPrinterCount}. Они не участвуют в обычной настройке ресторана.</p>}</div></details>
  </div>;
};
