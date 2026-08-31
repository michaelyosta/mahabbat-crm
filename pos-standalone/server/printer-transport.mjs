import net from 'node:net';

import { classifyTransportError } from './escpos.mjs';

const transportError = (phase, error, bytesSent = 0) => {
  const classified = classifyTransportError({ phase, bytesSent });
  const result = new Error(String(error?.message ?? error ?? classified.code));
  result.phase = phase;
  result.bytesSent = bytesSent;
  result.outcome = classified.outcome;
  result.code = classified.code;
  result.retryable = classified.retryable;
  return result;
};

export class RawTcpPrinterTransport {
  constructor({ connectTimeoutMs = 5000 } = {}) {
    this.connectTimeoutMs = connectTimeoutMs;
  }

  send(bytes, device) {
    return new Promise((resolve, reject) => {
      const host = String(device?.host ?? '').trim();
      const port = Number(device?.port ?? 9100);
      if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
        reject(transportError('connect', new Error('printer host/port is invalid'), 0));
        return;
      }
      const socket = net.createConnection({ host, port });
      let settled = false;
      let writeStarted = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (error) reject(error);
        else resolve({ outcome: 'SENT', bytesSent: bytes.length });
      };
      const fail = (phase, error) => {
        const bytesSent = Number(socket.bytesWritten ?? 0);
        finish(transportError(phase, error, bytesSent));
      };
      socket.setTimeout(this.connectTimeoutMs, () => fail(writeStarted ? 'write' : 'connect', new Error('printer connection timed out')));
      socket.once('connect', () => {
        writeStarted = true;
        try {
          socket.write(bytes, (error) => {
            if (error) fail('write', error);
            else finish(null);
          });
        } catch (error) {
          fail('before-write', error);
        }
      });
      socket.once('error', (error) => fail(writeStarted ? 'write' : 'connect', error));
      socket.once('close', () => {
        if (!settled) fail(writeStarted ? 'write' : 'connect', new Error('printer connection closed'));
      });
    });
  }
}

export const _internal = { transportError };
