export type SystemPrinterCapability = 'SUPPORTED' | 'UNKNOWN' | 'UNSUPPORTED';

export type DiscoveredSystemPrinter = {
  id: string;
  name: string;
  systemQueueName: string;
  driverName: string | null;
  portName: string | null;
  isDefault: boolean;
  status: 'CONNECTED' | 'UNAVAILABLE' | 'UNKNOWN';
  isAvailable: boolean;
  capabilityStatus: SystemPrinterCapability;
  lastSeen: string;
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const normalizeSystemPrinter = (
  value: Record<string, unknown>,
  lastSeen = new Date().toISOString(),
): DiscoveredSystemPrinter | null => {
  const name = text(value.systemQueueName ?? value.name);
  if (!name) return null;
  const isAvailable = value.isAvailable === true;
  const status = value.status === 'CONNECTED'
    ? 'CONNECTED'
    : value.status === 'UNAVAILABLE'
      ? 'UNAVAILABLE'
      : 'UNKNOWN';
  return {
    id: text(value.id) || `windows:${name}`,
    name: text(value.name) || name,
    systemQueueName: name,
    driverName: text(value.driverName) || null,
    portName: text(value.portName) || null,
    isDefault: value.isDefault === true,
    status,
    isAvailable,
    capabilityStatus: value.capabilityStatus === 'SUPPORTED' || value.capabilityStatus === 'UNSUPPORTED' ? value.capabilityStatus : 'UNKNOWN',
    lastSeen: text(value.lastSeen) || lastSeen,
  };
};

export const findBoundSystemPrinter = (
  printers: readonly DiscoveredSystemPrinter[],
  systemQueueName: string | null | undefined,
): DiscoveredSystemPrinter | null => {
  const queue = text(systemQueueName);
  if (!queue) return null;
  return printers.find((printer) => printer.systemQueueName === queue) ?? null;
};

export const systemPrinterStatusLabel = (printer: DiscoveredSystemPrinter | null): string => {
  if (!printer) return 'Не найден';
  if (printer.status === 'CONNECTED') return 'Подключён';
  if (printer.status === 'UNAVAILABLE') return 'Недоступен';
  return 'Состояние неизвестно';
};
