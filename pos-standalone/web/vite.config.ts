import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import path from 'node:path';

const dirname = import.meta.dirname;
const localNodeModules = path.resolve(dirname, 'node_modules');
const appNodeModules = path.resolve(dirname, '../../node_modules');
const dependencyRoot = existsSync(path.join(localNodeModules, 'react'))
  ? localNodeModules
  : appNodeModules;

export default defineConfig({
  plugins: [react()],
  root: path.resolve(dirname),
  resolve: {
    alias: {
      'src': path.resolve(dirname, '../../src'),
      react: path.resolve(dependencyRoot, 'react'),
      'react-dom': path.resolve(dependencyRoot, 'react-dom'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.POS_GATEWAY_PORT ?? 3100}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist-web',
    emptyOutDir: true,
  },
});
