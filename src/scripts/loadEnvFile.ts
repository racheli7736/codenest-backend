/**
 * Loads `--env-file=<file>` BEFORE the app modules are imported, because they read
 * the settings (DATABASE_URL, R2_*) as soon as they load. Import this module first.
 */
import { config as loadDotenv } from 'dotenv';

const envFile = process.argv.find((arg) => arg.startsWith('--env-file='))?.split('=').slice(1).join('=');
if (envFile) loadDotenv({ path: envFile, override: true, quiet: true });
