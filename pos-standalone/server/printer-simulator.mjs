#!/usr/bin/env node
import net from 'node:net';

const MODES = new Set(['success', 'refuse', 'timeout', 'disconnect-before', 'disconnect-after']);

export const createPrinterSimulator = ({ host = '127.0.0.1', port = 0, mode = 'success' } = {}) => {
  if (!MODES.has(mode)) throw new Error(`Unsupported simulator mode: ${mode}`);
  let captured = Buffer.alloc(0);
  let connections = 0;
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    connections += 1;
    if (mode === 'timeout') return;
    if (mode === 'refuse' || mode === 'disconnect-before') {
      socket.destroy();
      return;
    }
    if (mode === 'disconnect-after') {
      socket.once('data', (chunk) => {
        captured = Buffer.concat([captured, chunk.subarray(0, Math.max(1, Math.floor(chunk.length / 2)))]);
        socket.destroy();
      });
      return;
    }
    socket.on('data', (chunk) => { captured = Buffer.concat([captured, chunk]); socket.end(); });
  });
  return {
    server,
    async start() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, resolve);
      });
      return server.address();
    },
    async stop() {
      if (!server.listening) return;
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
    get captured() { return captured; },
    get connections() { return connections; },
  };
};

if (process.argv[1] && process.argv[1].endsWith('printer-simulator.mjs')) {
  const mode = process.env.PRINTER_SIMULATOR_MODE ?? 'success';
  const host = process.env.PRINTER_SIMULATOR_HOST ?? '127.0.0.1';
  const port = Number(process.env.PRINTER_SIMULATOR_PORT ?? 9100);
  const simulator = createPrinterSimulator({ host, port, mode });
  const address = await simulator.start();
  console.log(JSON.stringify({ service: 'printer-simulator', mode, address }));
  const stop = () => simulator.stop().then(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
