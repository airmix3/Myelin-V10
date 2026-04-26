import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, './src/') + '/',
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10000,
  },
};
