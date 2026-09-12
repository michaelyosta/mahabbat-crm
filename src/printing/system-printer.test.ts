import { describe, expect, it } from 'vitest';

import {
  findBoundSystemPrinter,
  normalizeSystemPrinter,
  systemPrinterStatusLabel,
} from 'src/printing/system-printer';

describe('Windows system printer binding model', () => {
  it('normalizes a connected discovery result with a stable queue binding', () => {
    const printer = normalizeSystemPrinter({
      id: 'windows:Kitchen',
      name: 'Kitchen',
      systemQueueName: 'Kitchen',
      driverName: 'Generic',
      portName: 'PORTPROMPT:',
      isDefault: true,
      status: 'CONNECTED',
      isAvailable: true,
    }, '2026-09-13T00:00:00.000Z');

    expect(printer).toMatchObject({ id: 'windows:Kitchen', systemQueueName: 'Kitchen', status: 'CONNECTED', isAvailable: true, capabilityStatus: 'UNKNOWN' });
    expect(systemPrinterStatusLabel(printer)).toBe('Подключён');
  });

  it('does not silently bind an unavailable or renamed queue', () => {
    const discovered = normalizeSystemPrinter({ name: 'New queue', isAvailable: false, status: 'UNAVAILABLE' });
    expect(findBoundSystemPrinter(discovered ? [discovered] : [], 'Old queue')).toBeNull();
    expect(systemPrinterStatusLabel(null)).toBe('Не найден');
  });

  it('keeps one discovered device usable as a binding for multiple stations', () => {
    const printer = normalizeSystemPrinter({ name: 'Shared queue', isAvailable: true, status: 'CONNECTED' });
    const printers = printer ? [printer] : [];
    expect(findBoundSystemPrinter(printers, 'Shared queue')?.systemQueueName).toBe('Shared queue');
    expect(findBoundSystemPrinter(printers, 'Shared queue')?.systemQueueName).toBe('Shared queue');
  });
});
