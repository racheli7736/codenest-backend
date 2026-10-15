import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { TEST_DATABASE_URL } from './testEnv';

const projectRoot = path.resolve(__dirname, '..');
const prismaCli = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');
export const schemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');

/** Runs the Prisma CLI against the TEST database and returns its exit code and output. */
export function runPrisma(args: string[], options: { withSchemaFlag?: boolean } = {}) {
  const schemaArgs = options.withSchemaFlag === false ? [] : ['--schema', schemaPath];
  const result = spawnSync(process.execPath, [prismaCli, ...args, ...schemaArgs], {
    // Run from the temp folder so Prisma does not pick up the project's .env file.
    cwd: os.tmpdir(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    encoding: 'utf8',
  });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}
