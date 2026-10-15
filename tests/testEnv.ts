/**
 * Tests run against a SEPARATE real PostgreSQL database (never your dev or production data).
 * With `docker compose up -d` the database "codenest_test" is created automatically.
 * Override with the TEST_DATABASE_URL environment variable if needed.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://codenest:codenest@localhost:5432/codenest_test?schema=public';

export const TEST_JWT_SECRET = 'test-only-secret-that-is-at-least-32-characters-long';
