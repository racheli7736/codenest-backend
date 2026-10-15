import { runPrisma } from './prismaCli';
import { TEST_DATABASE_URL } from './testEnv';

/** Runs once before all tests: applies the real migrations to the test database. */
export default function setup() {
  const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
  if (!dbName.includes('test')) {
    throw new Error(`Refusing to run tests on database "${dbName}" — its name must contain "test".`);
  }

  const result = runPrisma(['migrate', 'deploy']);
  if (result.status !== 0) {
    throw new Error(
      `Could not prepare the test database. Is PostgreSQL running (npm run db:up)?\n${result.output}`,
    );
  }
}
