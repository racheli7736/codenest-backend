import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL, TEST_JWT_SECRET } from './tests/testEnv';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/globalSetup.ts'],
    // All test files share one database, so run them one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: TEST_JWT_SECRET,
      JWT_EXPIRES_IN: '1h',
      CORS_ORIGIN: '*',
      BCRYPT_ROUNDS: '4',
      // Tests never touch the real Cloudflare R2 — files are kept in memory (see MemoryStorage).
      STORAGE_DRIVER: 'memory',
    },
  },
});
