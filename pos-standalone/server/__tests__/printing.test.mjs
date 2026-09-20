import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';

import { classifyTransportError, encodeCyrillic, renderKitchen, renderPrecheck, renderTestPrint } from '../escpos.mjs';
import { createPrinterSimulator } from '../printer-simulator.mjs';
import { RawTcpPrinterTransport } from '../printer-transport.mjs';
import { parseSystemPrinterRows } from '../windows-printer-provider.mjs';

const sendTo = async (address, bytes, timeoutMs = 500) => new Promise((resolve, reject) => {
  const socket = net.createConnection(address);
  const chunks = [];
  let settled = false;
  const finish = (error) => {
    if (settled) return;
    settled = true;
    socket.destroy();
    if (error) reject(error); else resolve(Buffer.concat(chunks));
  };
  socket.setTimeout(timeoutMs, () => finish(new Error('timeout')));
  socket.once('connect', () => socket.write(bytes));
  socket.on('data', (chunk) => chunks.push(chunk));
  socket.once('error', (error) => finish(error));
  socket.once('close', () => { if (!settled) finish(null); });
});

test('ESC/POS renderer keeps Cyrillic readable and marks a cancellation', () => {
  const bytes = renderKitchen({
    ticketType: 'CANCELLATION',
    documentType: 'KITCHEN_CANCEL',
    tableNumber: '12',
    waiterName: 'Айдана',
    orderId: 'order-12',
    stationSections: [{ stationName: 'Горячий цех', lines: [{ quantity: 1, itemNameSnapshot: 'Борщ', action: 'CANCEL' }] }],
  }, { paperWidth: '80', encodingProfile: 'CP866', cutSupport: false });
  assert.ok(bytes.includes(0x1b));
  assert.ok(bytes.includes(0x1d) === false, 'cut command is disabled in the test profile');
  assert.notEqual(bytes.indexOf(Buffer.from('?')), 0, 'output should not be a blank replacement document');
  const decoded = encodeCyrillic('НЕ ГОТОВИТЬ ОТМЕНА ₸', 'CP866');
  assert.ok(decoded.length > 10);
});

test('ESC/POS renderer strips injected control bytes from stored text', () => {
  const bytes = encodeCyrillic('Борщ\u001dVA\u0000\u001b p\u0007', 'CP866');
  assert.ok(!bytes.includes(0x1b), 'ESC must not be emitted from text');
  assert.ok(!bytes.includes(0x1d), 'GS must not be emitted from text');
  assert.ok(!bytes.includes(0x00), 'NUL must not be emitted from text');
  assert.ok(!bytes.includes(0x07), 'BEL must not be emitted from text');
});

test('ESC/POS renderer creates a non-fiscal Windows test document', () => {
  const bytes = renderTestPrint({ printerLabel: 'Принтер кухни', createdAt: '2026-09-13T00:00:00.000Z' }, { paperWidth: '80', encodingProfile: 'CP866', cutSupport: false });
  const decoded = bytes.toString('latin1');
  assert.match(decoded, /1234567890/);
  assert.ok(bytes.length > 20);
});

test('Windows discovery parser keeps queue identity and reports unknown compatibility', () => {
  const rows = parseSystemPrinterRows(JSON.stringify({ Name: 'Microsoft Print to PDF', DriverName: 'Microsoft Print To PDF', PortName: 'PORTPROMPT:', PrinterStatus: 'Normal', Default: false }), '2026-09-13T00:00:00.000Z');
  assert.deepEqual(rows[0], {
    id: 'windows:Microsoft Print to PDF',
    name: 'Microsoft Print to PDF',
    systemQueueName: 'Microsoft Print to PDF',
    driverName: 'Microsoft Print To PDF',
    portName: 'PORTPROMPT:',
    isDefault: false,
    status: 'CONNECTED',
    isAvailable: true,
    capabilityStatus: 'UNKNOWN',
    lastSeen: '2026-09-13T00:00:00.000Z',
  });
});

test('Windows discovery parser does not overclaim an unknown spooler status', () => {
  const rows = parseSystemPrinterRows(JSON.stringify({ Name: 'Uncertain queue', PrinterStatus: 'Other', WorkOffline: false }), '2026-09-13T00:00:00.000Z');
  assert.equal(rows[0].status, 'UNKNOWN');
  assert.equal(rows[0].isAvailable, false);
});

test('precheck renderer is explicitly non-fiscal and contains guest totals', () => {
  const bytes = renderPrecheck({
    tableNumber: '4', waiterName: 'Айдана', orderId: 'order-4', totalMicros: 125000000,
    guests: [{ displayNumber: 'Гость 1', lines: [{ itemNameSnapshot: 'Чай', quantity: 1, lineTotalMicros: 125000000 }] }],
  }, { encodingProfile: 'UTF8', cutSupport: false });
  const text = bytes.toString('utf8');
  assert.match(text, /НЕ ЯВЛЯЕТСЯ ФИСКАЛЬНЫМ ЧЕКОМ/);
  assert.match(text, /125/);
});

test('transport classification is fail-closed around partial writes', () => {
  assert.deepEqual(classifyTransportError({ phase: 'connect', bytesSent: 0 }), { outcome: 'FAILED', code: 'CONNECTION_FAILED_BEFORE_SEND', retryable: true });
  assert.deepEqual(classifyTransportError({ phase: 'write', bytesSent: 0 }), { outcome: 'FAILED', code: 'CONNECTION_FAILED_BEFORE_SEND', retryable: true });
  assert.deepEqual(classifyTransportError({ phase: 'write', bytesSent: 4 }), { outcome: 'OUTCOME_UNKNOWN', code: 'CONNECTION_DROPPED_AFTER_WRITE', retryable: false });
});

test('raw TCP transport completes a simulator write as SENT', async () => {
  const simulator = createPrinterSimulator({ mode: 'success' });
  const address = await simulator.start();
  try {
    const result = await new RawTcpPrinterTransport({ connectTimeoutMs: 200 }).send(Buffer.from('ticket'), { host: address.address, port: address.port });
    assert.deepEqual(result, { outcome: 'SENT', bytesSent: 6 });
  } finally {
    await simulator.stop();
  }
});

for (const mode of ['success', 'refuse', 'disconnect-before', 'disconnect-after']) {
  test(`printer simulator captures ${mode} behavior`, async () => {
    const simulator = createPrinterSimulator({ mode });
    const address = await simulator.start();
    try {
      await sendTo(address, Buffer.from('ESC/POS test payload')).catch(() => undefined);
      if (mode === 'success') assert.equal(simulator.captured.toString(), 'ESC/POS test payload');
      if (mode === 'refuse' || mode === 'disconnect-before') assert.equal(simulator.captured.length, 0);
      if (mode === 'disconnect-after') assert.ok(simulator.captured.length > 0 && simulator.captured.length < 20);
    } finally {
      await simulator.stop();
    }
  });
}

test('printer simulator leaves a timeout connection open until the client decides', async () => {
  const simulator = createPrinterSimulator({ mode: 'timeout' });
  const address = await simulator.start();
  try {
    await assert.rejects(sendTo(address, Buffer.from('timeout'), 50), /timeout/);
  } finally {
    await simulator.stop();
  }
});
