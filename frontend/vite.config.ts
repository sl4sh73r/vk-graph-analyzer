import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // Разрешаем внешние подключения
    allowedHosts: [
      'localhost',
      '.ngrok.io',
      '.ngrok-free.app',
      'fa6c46cefca5.ngrok-free.app',
    ],
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
