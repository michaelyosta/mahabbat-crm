import type { CoreApiClientLike } from 'src/logic-functions/apply-loyalty-adjustment-request.logic-function';

type ExistingRecord = { id: string };
type NodeSelection = Record<string, boolean | Record<string, boolean>>;
type Connection<T> = {
  edges?: Array<{ node?: T | null } | null>;
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } | null;
};

export type PrinterDeviceRecord = ExistingRecord & {
  label?: string | null;
  connectionType?: string | null;
  host?: string | null;
  port?: number | null;
  systemQueueName?: string | null;
  systemPrinterName?: string | null;
  systemDriverName?: string | null;
  systemPortName?: string | null;
  capabilityStatus?: string | null;
  isActive?: boolean | null;
  isPrecheckPrinter?: boolean | null;
  paperWidth?: string | null;
  encodingProfile?: string | null;
  escPosCodePage?: number | null;
  cutSupport?: boolean | null;
  status?: string | null;
  lastSeenAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
};

export type ProductionStationRecord = ExistingRecord & {
  label?: string | null;
  isActive?: boolean | null;
  printerDeviceId?: string | null;
};

export type PrintJobRecord = ExistingRecord & {
  label?: string | null;
  sourceType?: string | null;
  printerDeviceId?: string | null;
  productionStationId?: string | null;
  sourceId?: string | null;
  documentType?: string | null;
  status?: string | null;
  payloadSnapshot?: string | null;
  idempotencyKey?: string | null;
  attemptCount?: number | null;
  lastAttemptAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  createdAt?: string | null;
  sentAt?: string | null;
  confirmedAt?: string | null;
  claimToken?: string | null;
  claimedAt?: string | null;
  gatewayId?: string | null;
  reprintOfJobId?: string | null;
  requestedBy?: string | null;
  requestedAt?: string | null;
};

export type KitchenQueueLine = {
  orderLineId: string;
  guestId?: string | null;
  guestDisplayNumber?: string | null;
  itemNameSnapshot: string;
  quantity: number;
  action: 'ADD' | 'CANCEL';
  productionStationId?: string | null;
  stationNameSnapshot?: string | null;
};

type KitchenContext = {
  orderId: string;
  tableNumber: string;
  waiterName: string;
  createdAt: string;
};

type KitchenGroup = {
  key: string;
  printer: PrinterDeviceRecord | null;
  station: ProductionStationRecord | null;
  stationName: string;
  lines: KitchenQueueLine[];
  stationSections: Array<{
    stationId: string | null;
    stationName: string;
    lines: KitchenQueueLine[];
  }>;
  routeErrorCode?: string;
  routeErrorMessage?: string;
};

const PRINTER_FIELDS: NodeSelection = {
  id: true,
  label: true,
  connectionType: true,
  host: true,
  port: true,
  systemQueueName: true,
  systemPrinterName: true,
  systemDriverName: true,
  systemPortName: true,
  capabilityStatus: true,
  isActive: true,
  isPrecheckPrinter: true,
  paperWidth: true,
  encodingProfile: true,
  escPosCodePage: true,
  cutSupport: true,
  status: true,
  lastSeenAt: true,
  lastErrorCode: true,
  lastErrorMessage: true,
};

const STATION_FIELDS: NodeSelection = {
  id: true,
  label: true,
  isActive: true,
  printerDeviceId: true,
};

export const PRINT_JOB_FIELDS: NodeSelection = {
  id: true,
  label: true,
  sourceType: true,
  printerDeviceId: true,
  productionStationId: true,
  sourceId: true,
  documentType: true,
  status: true,
  payloadSnapshot: true,
  idempotencyKey: true,
  attemptCount: true,
  lastAttemptAt: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  createdAt: true,
  sentAt: true,
  confirmedAt: true,
  claimToken: true,
  claimedAt: true,
  gatewayId: true,
  reprintOfJobId: true,
  requestedBy: true,
  requestedAt: true,
};

const ORDER_FIELDS: NodeSelection = { id: true, tableId: true, ownerStaffId: true };
const TABLE_FIELDS: NodeSelection = { id: true, number: true };
const STAFF_FIELDS: NodeSelection = { id: true, displayName: true };

const queryConnection = async <T extends ExistingRecord>(
  client: CoreApiClientLike,
  root: string,
  filter: Record<string, unknown>,
  fields: NodeSelection,
  first = 100,
): Promise<T[]> => {
  const result = (await client.query({
    [root]: {
      __args: { filter, first },
      edges: { node: fields },
      pageInfo: { hasNextPage: true, endCursor: true },
    },
  })) as Record<string, Connection<T> | undefined>;

  return (result[root]?.edges ?? [])
    .map((edge) => edge?.node)
    .filter((node): node is T => Boolean(node));
};

export const findPrinter = async (
  client: CoreApiClientLike,
  id: string,
): Promise<PrinterDeviceRecord | null> =>
  (await queryConnection<PrinterDeviceRecord>(client, 'posPrinterDevices', { id: { eq: id } }, PRINTER_FIELDS, 1))[0] ?? null;

export const findStation = async (
  client: CoreApiClientLike,
  id: string,
): Promise<ProductionStationRecord | null> =>
  (await queryConnection<ProductionStationRecord>(client, 'posProductionStations', { id: { eq: id } }, STATION_FIELDS, 1))[0] ?? null;

export const findPrintJobByKey = async (
  client: CoreApiClientLike,
  idempotencyKey: string,
): Promise<PrintJobRecord | null> =>
  (await queryConnection<PrintJobRecord>(client, 'posPrintJobs', { idempotencyKey: { eq: idempotencyKey } }, PRINT_JOB_FIELDS, 1))[0] ?? null;

export const findPrintJob = async (
  client: CoreApiClientLike,
  id: string,
): Promise<PrintJobRecord | null> =>
  (await queryConnection<PrintJobRecord>(client, 'posPrintJobs', { id: { eq: id } }, PRINT_JOB_FIELDS, 1))[0] ?? null;

const findKitchenContext = async (
  client: CoreApiClientLike,
  orderId: string,
  createdAt: string,
): Promise<KitchenContext> => {
  const order = (await queryConnection<{ id: string; tableId?: string | null; ownerStaffId?: string | null }>(client, 'posOrders', { id: { eq: orderId } }, ORDER_FIELDS, 1))[0];
  const table = order?.tableId
    ? (await queryConnection<{ id: string; number?: string | null }>(client, 'posTables', { id: { eq: order.tableId } }, TABLE_FIELDS, 1))[0]
    : null;
  const staff = order?.ownerStaffId
    ? (await queryConnection<{ id: string; displayName?: string | null }>(client, 'posStaffs', { id: { eq: order.ownerStaffId } }, STAFF_FIELDS, 1))[0]
    : null;

  return {
    orderId,
    tableNumber: table?.number ?? '—',
    waiterName: staff?.displayName ?? 'Сотрудник',
    createdAt,
  };
};

const updateSourcePrintStatus = async (
  client: CoreApiClientLike,
  sourceType: 'KITCHEN_TICKET' | 'PRECHECK',
  sourceId: string,
  status: string,
): Promise<void> => {
  if (sourceType === 'KITCHEN_TICKET') {
    await client.mutation({
      updatePosKitchenTicket: { __args: { id: sourceId, data: { printStatus: status } }, id: true },
    });
  } else {
    await client.mutation({
      updatePosPrecheck: { __args: { id: sourceId, data: { printStatus: status } }, id: true },
    });
  }
};

export const aggregatePrintStatus = (jobs: PrintJobRecord[]): string | null => {
  if (jobs.length === 0) return null;
  const statuses = new Set(jobs.map((job) => job.status));
  if (statuses.has('OUTCOME_UNKNOWN')) return 'OUTCOME_UNKNOWN';
  if (statuses.has('FAILED')) return 'FAILED';
  if (statuses.has('DISPATCHING')) return 'DISPATCHING';
  if (statuses.has('QUEUED')) return 'QUEUED';
  if ([...statuses].every((status) => status === 'CONFIRMED')) return 'CONFIRMED';
  return 'SENT';
};

export const refreshSourcePrintStatus = async (
  client: CoreApiClientLike,
  sourceType: 'KITCHEN_TICKET' | 'PRECHECK',
  sourceId: string,
): Promise<string | null> => {
  const jobs = await queryConnection<PrintJobRecord>(
    client,
    'posPrintJobs',
    { sourceType: { eq: sourceType }, sourceId: { eq: sourceId } },
    PRINT_JOB_FIELDS,
  );
  const status = aggregatePrintStatus(jobs);
  if (status) await updateSourcePrintStatus(client, sourceType, sourceId, status);
  return status;
};

const serializeSnapshot = (value: unknown): string => JSON.stringify(value);

export const printerDestinationSnapshot = (printer: PrinterDeviceRecord | null | undefined) =>
  printer
    ? {
        id: printer.id,
        label: printer.label ?? null,
        connectionType: printer.connectionType ?? null,
        host: printer.host ?? null,
        port: printer.port ?? null,
        systemQueueName: printer.systemQueueName ?? null,
        systemPrinterName: printer.systemPrinterName ?? null,
        systemDriverName: printer.systemDriverName ?? null,
        systemPortName: printer.systemPortName ?? null,
        capabilityStatus: printer.capabilityStatus ?? 'UNKNOWN',
        paperWidth: printer.paperWidth ?? '80',
        encodingProfile: printer.encodingProfile ?? 'CP866',
        escPosCodePage: printer.escPosCodePage ?? null,
        cutSupport: printer.cutSupport !== false,
      }
    : null;

const createOrGetPrintJob = async (
  client: CoreApiClientLike,
  data: Record<string, unknown>,
  idempotencyKey: string,
): Promise<PrintJobRecord | null> => {
  const existing = await findPrintJobByKey(client, idempotencyKey);
  if (existing) return existing;

  try {
    const result = (await client.mutation({
      createPosPrintJob: {
        __args: { data: { ...data, idempotencyKey } },
        ...PRINT_JOB_FIELDS,
      },
    })) as { createPosPrintJob?: PrintJobRecord };
    return result.createPosPrintJob ?? null;
  } catch {
    return findPrintJobByKey(client, idempotencyKey);
  }
};

const routeKitchenLines = async (
  client: CoreApiClientLike,
  lines: KitchenQueueLine[],
): Promise<KitchenGroup[]> => {
  const stations = new Map<string, ProductionStationRecord | null>();
  const printers = new Map<string, PrinterDeviceRecord | null>();
  const groups = new Map<string, KitchenGroup>();

  for (const line of lines) {
    const stationId = line.productionStationId ?? null;
    const station = stationId
      ? (stations.has(stationId) ? (stations.get(stationId) ?? null) : await findStation(client, stationId))
      : null;
    if (stationId && !stations.has(stationId)) stations.set(stationId, station ?? null);

    const printerId = station?.printerDeviceId ?? null;
    const printer = printerId
      ? (printers.has(printerId) ? (printers.get(printerId) ?? null) : await findPrinter(client, printerId))
      : null;
    if (printerId && !printers.has(printerId)) printers.set(printerId, printer ?? null);

    const stationName = line.stationNameSnapshot ?? station?.label ?? 'Без маршрута';
    let routeErrorCode: string | undefined;
    let routeErrorMessage: string | undefined;
    if (!stationId || !station) {
      routeErrorCode = 'ROUTE_MISSING_STATION';
      routeErrorMessage = `Для позиции «${line.itemNameSnapshot}» не настроена производственная станция.`;
    } else if (station.isActive === false) {
      routeErrorCode = 'ROUTE_STATION_INACTIVE';
      routeErrorMessage = `Станция «${station.label ?? stationId}» отключена.`;
    } else if (!printerId || !printer) {
      routeErrorCode = 'ROUTE_MISSING_PRINTER';
      routeErrorMessage = `Для станции «${station.label ?? stationId}» не выбран принтер.`;
    } else if (printer.isActive === false) {
      routeErrorCode = 'PRINTER_INACTIVE';
      routeErrorMessage = `Принтер «${printer.label ?? printer.id}» отключён.`;
    }

    const routable = !routeErrorCode && Boolean(printer?.id);
    const key = routable
      ? `printer:${printer?.id}`
      : `unrouted:${stationId ?? line.orderLineId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.lines.push(line);
      const section = existing.stationSections.find(
        (candidate) => candidate.stationId === (station?.id ?? null),
      );
      if (section) section.lines.push(line);
      else existing.stationSections.push({ stationId: station?.id ?? null, stationName, lines: [line] });
      continue;
    }

    groups.set(key, {
      key,
      printer: routable ? printer : null,
      station,
      stationName,
      lines: [line],
      stationSections: [{ stationId: station?.id ?? null, stationName, lines: [line] }],
      routeErrorCode,
      routeErrorMessage,
    });
  }

  return [...groups.values()];
};

export const enqueueKitchenPrintJobs = async (
  client: CoreApiClientLike,
  input: {
    ticketId: string;
    orderId: string;
    ticketType: 'NEW_ITEMS' | 'CANCELLATION';
    lines: KitchenQueueLine[];
    isAdditional?: boolean;
    reprint?: {
      idempotencyKeyPrefix: string;
      reprintOfJobId: string;
      requestedBy: string;
      requestedAt: string;
    };
    snapshot?: Pick<KitchenContext, 'tableNumber' | 'waiterName' | 'createdAt'>;
  },
): Promise<PrintJobRecord[]> => {
  const createdAt = input.snapshot?.createdAt ?? new Date().toISOString();
  const context = input.snapshot
    ? { orderId: input.orderId, ...input.snapshot }
    : await findKitchenContext(client, input.orderId, createdAt);
  const groups = await routeKitchenLines(client, input.lines);
  const documentType = input.ticketType === 'CANCELLATION' ? 'KITCHEN_CANCEL' : 'KITCHEN_NEW';
  const jobs: PrintJobRecord[] = [];

  for (const group of groups) {
    const printerPart = group.printer?.id ?? `UNROUTED:${group.key}`;
    const key = input.reprint
      ? `${input.reprint.idempotencyKeyPrefix}:${printerPart}`
      : `KITCHEN_${input.ticketType === 'CANCELLATION' ? 'CANCEL' : 'NEW'}:${input.ticketId}:${printerPart}`;
    const payload = {
      version: 1,
      sourceType: 'KITCHEN_TICKET',
      sourceId: input.ticketId,
      documentType,
      ticketType: input.ticketType,
      isAdditional: input.isAdditional === true,
      isReprint: Boolean(input.reprint),
      tableNumber: context.tableNumber,
      waiterName: context.waiterName,
      orderId: context.orderId,
      createdAt,
      stationSections: group.stationSections.map((section) => ({
        stationId: section.stationId,
        stationName: section.stationName,
        lines: section.lines.map((line) => ({
          orderLineId: line.orderLineId,
          guestDisplayNumber: line.guestDisplayNumber ?? null,
          itemNameSnapshot: line.itemNameSnapshot,
          quantity: line.quantity,
          action: line.action,
        })),
      })),
      printerSnapshot: printerDestinationSnapshot(group.printer),
    };
    const job = await createOrGetPrintJob(client, {
      label: `${input.ticketType === 'CANCELLATION' ? 'Отмена' : 'Кухня'} · ${group.stationName} · Стол ${context.tableNumber}`,
      sourceType: 'KITCHEN_TICKET',
      sourceId: input.ticketId,
      printerDeviceId: group.printer?.id ?? null,
      productionStationId: group.station?.id ?? null,
      documentType,
      status: group.routeErrorCode ? 'FAILED' : 'QUEUED',
      payloadSnapshot: serializeSnapshot({ ...payload, routeErrorCode: group.routeErrorCode ?? null, routeErrorMessage: group.routeErrorMessage ?? null }),
      attemptCount: 0,
      lastErrorCode: group.routeErrorCode ?? null,
      lastErrorMessage: group.routeErrorMessage ?? null,
      createdAt,
      ...(input.reprint ? {
        reprintOfJobId: input.reprint.reprintOfJobId,
        requestedBy: input.reprint.requestedBy,
        requestedAt: input.reprint.requestedAt,
      } : {}),
    }, key);
    if (job) jobs.push(job);
  }

  await refreshSourcePrintStatus(client, 'KITCHEN_TICKET', input.ticketId);
  return jobs;
};

export type PrecheckQueueSnapshot = {
  precheckId: string;
  orderId: string;
  tableNumber: string;
  waiterName: string;
  createdAt: string;
  guests: Array<{
    displayNumber: string;
    lines: Array<{ itemNameSnapshot: string; quantity: number; unitPriceMicros: number; lineTotalMicros: number }>;
  }>;
  subtotalMicros: number;
  totalMicros: number;
};

export const enqueuePrecheckPrintJob = async (
  client: CoreApiClientLike,
  snapshot: PrecheckQueueSnapshot,
  options?: {
    idempotencyKey?: string;
    reprintOfJobId?: string;
    requestedBy?: string;
    requestedAt?: string;
  },
): Promise<PrintJobRecord | null> => {
  const printers = await queryConnection<PrinterDeviceRecord>(
    client,
    'posPrinterDevices',
    { isActive: { eq: true }, isPrecheckPrinter: { eq: true } },
    PRINTER_FIELDS,
  );
  const printer = [...printers].sort((a, b) => String(a.label ?? a.id).localeCompare(String(b.label ?? b.id), 'ru'))[0] ?? null;
  const missing = !printer;
  const key = options?.idempotencyKey ?? `PRECHECK:${snapshot.precheckId}:${printer?.id ?? 'UNROUTED'}`;
  const job = await createOrGetPrintJob(client, {
    label: `Пречек · Стол ${snapshot.tableNumber}`,
    sourceType: 'PRECHECK',
    sourceId: snapshot.precheckId,
    printerDeviceId: printer?.id ?? null,
    productionStationId: null,
    documentType: 'PRECHECK',
    status: missing ? 'FAILED' : 'QUEUED',
    payloadSnapshot: serializeSnapshot({ version: 1, ...snapshot, documentType: 'PRECHECK', isReprint: Boolean(options?.reprintOfJobId), printerSnapshot: printerDestinationSnapshot(printer), routeErrorCode: missing ? 'PRECHECK_PRINTER_NOT_CONFIGURED' : null, routeErrorMessage: missing ? 'Не выбран принтер пречеков.' : null }),
    attemptCount: 0,
    lastErrorCode: missing ? 'PRECHECK_PRINTER_NOT_CONFIGURED' : null,
    lastErrorMessage: missing ? 'Не выбран принтер пречеков.' : null,
    createdAt: snapshot.createdAt,
    ...(options?.reprintOfJobId ? {
      reprintOfJobId: options.reprintOfJobId,
      requestedBy: options.requestedBy,
      requestedAt: options.requestedAt,
    } : {}),
  }, key);
  await refreshSourcePrintStatus(client, 'PRECHECK', snapshot.precheckId);
  return job;
};

export const enqueueTestPrintJob = async (
  client: CoreApiClientLike,
  printerDeviceId: string,
  idempotencyKey: string,
): Promise<{ status: number; body: unknown }> => {
  const printer = await findPrinter(client, printerDeviceId);
  if (!printer) return { status: 404, body: { code: 'PRINTER_NOT_FOUND', message: 'Принтер не найден.' } };
  if (printer.isActive === false) return { status: 409, body: { code: 'PRINTER_INACTIVE', message: 'Принтер отключён.' } };
  if (printer.connectionType === 'WINDOWS_SPOOLER' && !printer.systemQueueName) {
    return { status: 409, body: { code: 'SYSTEM_PRINTER_NOT_BOUND', message: 'Системный принтер не выбран.' } };
  }
  const createdAt = new Date().toISOString();
  const key = `TEST_PRINT:${printer.id}:${idempotencyKey}`;
  const job = await createOrGetPrintJob(client, {
    label: `Тестовая печать · ${printer.label ?? 'Принтер'}`,
    sourceType: 'TEST_PRINT',
    sourceId: printer.id,
    printerDeviceId: printer.id,
    productionStationId: null,
    documentType: 'TEST_PRINT',
    status: 'QUEUED',
    payloadSnapshot: serializeSnapshot({
      version: 1,
      sourceType: 'TEST_PRINT',
      sourceId: printer.id,
      documentType: 'TEST_PRINT',
      printerSnapshot: printerDestinationSnapshot(printer),
      printerLabel: printer.label ?? 'Принтер',
      createdAt,
    }),
    attemptCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt,
  }, key);
  if (!job) return { status: 409, body: { code: 'CONFLICT', message: 'Тестовое задание не создано.' } };
  return { status: 201, body: { printJobId: job.id, status: job.status, documentType: 'TEST_PRINT' } };
};

export const executeRetryPrintJob = async (
  client: CoreApiClientLike,
  payload: { printJobId: string; idempotencyKey: string },
  actorStaffId: string,
): Promise<{ status: number; body: unknown }> => {
  const source = await findPrintJob(client, payload.printJobId);
  if (!source) return { status: 400, body: { code: 'PRINT_JOB_NOT_FOUND', message: 'Задание печати не найдено.' } };
  const newKey = `REPRINT:${source.id}:${payload.idempotencyKey}`;
  const existing = await findPrintJobByKey(client, newKey);
  if (existing) return { status: 200, body: { printJobId: existing.id, status: existing.status, reprint: true, replay: true } };

  let snapshot: Record<string, unknown>;
  try { snapshot = JSON.parse(source.payloadSnapshot ?? '{}') as Record<string, unknown>; } catch {
    return { status: 400, body: { code: 'PRINT_PAYLOAD_INVALID', message: 'Snapshot задания повреждён.' } };
  }
  const requestedAt = new Date().toISOString();

  if (source.sourceType === 'KITCHEN_TICKET' && Array.isArray(snapshot.stationSections)) {
    const lines: KitchenQueueLine[] = snapshot.stationSections.flatMap((sectionValue) => {
      if (!sectionValue || typeof sectionValue !== 'object') return [];
      const section = sectionValue as Record<string, unknown>;
      const stationId = typeof section.stationId === 'string' ? section.stationId : null;
      const stationNameSnapshot = typeof section.stationName === 'string' ? section.stationName : null;
      if (!Array.isArray(section.lines)) return [];
      return section.lines.flatMap((lineValue) => {
        if (!lineValue || typeof lineValue !== 'object') return [];
        const line = lineValue as Record<string, unknown>;
        if (typeof line.orderLineId !== 'string') return [];
        return [{
          orderLineId: line.orderLineId,
          guestDisplayNumber: typeof line.guestDisplayNumber === 'string' ? line.guestDisplayNumber : null,
          itemNameSnapshot: String(line.itemNameSnapshot ?? ''),
          quantity: Math.max(0, Number(line.quantity ?? 0)),
          action: line.action === 'CANCEL' ? 'CANCEL' : 'ADD',
          productionStationId: stationId,
          stationNameSnapshot,
        }];
      });
    });
    const jobs = await enqueueKitchenPrintJobs(client, {
      ticketId: source.sourceId ?? '',
      orderId: String(snapshot.orderId ?? ''),
      ticketType: snapshot.ticketType === 'CANCELLATION' ? 'CANCELLATION' : 'NEW_ITEMS',
      lines,
      isAdditional: snapshot.isAdditional === true,
      snapshot: {
        tableNumber: String(snapshot.tableNumber ?? '—'),
        waiterName: String(snapshot.waiterName ?? 'Сотрудник'),
        createdAt: String(snapshot.createdAt ?? requestedAt),
      },
      reprint: { idempotencyKeyPrefix: newKey, reprintOfJobId: source.id, requestedBy: actorStaffId, requestedAt },
    });
    return { status: jobs.length ? 201 : 409, body: { printJobId: jobs[0]?.id ?? null, printJobIds: jobs.map((job) => job.id), status: jobs[0]?.status ?? 'FAILED', reprint: true, reprintOfJobId: source.id } };
  }

  if (source.sourceType === 'PRECHECK' && Array.isArray(snapshot.guests)) {
    const created = await enqueuePrecheckPrintJob(client, snapshot as unknown as PrecheckQueueSnapshot, {
      idempotencyKey: newKey,
      reprintOfJobId: source.id,
      requestedBy: actorStaffId,
      requestedAt,
    });
    if (!created) return { status: 409, body: { code: 'CONFLICT', message: 'Повторное задание не создано.' } };
    return { status: 201, body: { printJobId: created.id, status: created.status, reprint: true, reprintOfJobId: source.id } };
  }

  return { status: 400, body: { code: 'PRINT_PAYLOAD_INVALID', message: 'Тип snapshot задания не поддерживает повтор.' } };
};

export const findPrintJobsForGateway = async (
  client: CoreApiClientLike,
  status: string,
): Promise<PrintJobRecord[]> =>
  queryConnection<PrintJobRecord>(client, 'posPrintJobs', { status: { eq: status } }, PRINT_JOB_FIELDS);

export const updatePrintJob = async (
  client: CoreApiClientLike,
  id: string,
  data: Record<string, unknown>,
): Promise<PrintJobRecord | null> => {
  const result = (await client.mutation({
    updatePosPrintJob: { __args: { id, data }, ...PRINT_JOB_FIELDS },
  })) as { updatePosPrintJob?: PrintJobRecord | null };
  return result.updatePosPrintJob ?? null;
};

export const updatePrinterDevice = async (
  client: CoreApiClientLike,
  id: string,
  data: Record<string, unknown>,
): Promise<PrinterDeviceRecord | null> => {
  const result = (await client.mutation({
    updatePosPrinterDevice: { __args: { id, data }, ...PRINTER_FIELDS },
  })) as { updatePosPrinterDevice?: PrinterDeviceRecord | null };
  return result.updatePosPrinterDevice ?? null;
};

export const staleDispatchingJobs = async (
  client: CoreApiClientLike,
  leaseMs: number,
  now = Date.now(),
): Promise<PrintJobRecord[]> => {
  const jobs = await findPrintJobsForGateway(client, 'DISPATCHING');
  return jobs.filter((job) => {
    const claimed = job.claimedAt ? Date.parse(job.claimedAt) : Number.NaN;
    return !Number.isFinite(claimed) || now - claimed >= leaseMs;
  });
};

export const markGatewayRestartUnknown = async (
  client: CoreApiClientLike,
  leaseMs: number,
): Promise<PrintJobRecord[]> => {
  const stale = await staleDispatchingJobs(client, leaseMs);
  const updated: PrintJobRecord[] = [];
  for (const job of stale) {
    const next = await updatePrintJob(client, job.id, {
      status: 'OUTCOME_UNKNOWN',
      lastErrorCode: 'GATEWAY_RESTART_DURING_DISPATCH',
      lastErrorMessage: 'Gateway был перезапущен во время отправки; бумага могла выйти.',
    });
    if (next) {
      updated.push(next);
      if ((next.sourceType === 'KITCHEN_TICKET' || next.sourceType === 'PRECHECK') && next.sourceId) {
        await refreshSourcePrintStatus(client, next.sourceType, next.sourceId);
      }
    }
  }
  return updated;
};

export const _internal = { findPrinter, findStation, findPrintJob, findPrintJobByKey, queryConnection };
