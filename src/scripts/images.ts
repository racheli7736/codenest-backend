/**
 * Image storage maintenance (Cloudflare R2).
 *
 *   npm run images:backup          -- [--out=./image-backup]   copy legacy DB images to a local folder
 *   npm run images:migrate-to-r2   -- [--dry-run]              upload legacy images to R2 + verify (keeps DB bytes)
 *   npm run images:verify                                      re-check every R2 object referenced by the DB
 *   npm run images:purge-db-data   -- [--confirm]              clear DB bytes of VERIFIED images only
 *   npm run images:cleanup-orphans -- [--confirm]              delete R2 files no row points to
 *
 * Add --env-file=<file> to load settings (DATABASE_URL, R2_*) from a file, e.g. a private
 * ".env.production.local" that is never committed. Without --confirm, destructive commands only report.
 */
import './loadEnvFile'; // must stay the first import
import { prisma } from '../lib/prisma';
import { getStorage } from '../lib/storage';
import * as migration from '../modules/images/imageMigration';

const args = process.argv.slice(2);
const command = args[0];
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

async function main() {
  const log = (message: string) => console.log(message);

  try {
    const storage = getStorage();
    console.log(`Storage driver: ${storage.driver}`);
    if (command !== 'backup' && storage.driver !== 'r2') {
      throw new Error('Cloudflare R2 is not configured (set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).');
    }

    switch (command) {
      case 'backup': {
        const out = option('out') ?? `./image-backup-${new Date().toISOString().slice(0, 10)}`;
        const result = await migration.backupLegacyImages(out, { log });
        console.log(`\n${result.count} image(s) backed up to ${result.outDir} (see manifest.json)`);
        break;
      }
      case 'migrate': {
        const result = await migration.migrateLegacyImages({ log, dryRun: flag('dry-run') });
        console.log(`\nScanned ${result.scanned}, migrated ${result.migrated}, failed ${result.failed.length}${result.dryRun ? ' (dry run)' : ''}`);
        if (result.failed.length) process.exitCode = 1;
        break;
      }
      case 'verify': {
        const result = await migration.verifyStoredImages({ log });
        console.log(`\nChecked ${result.checked}, OK ${result.ok}, problems ${result.problems.length}`);
        if (result.problems.length) process.exitCode = 1;
        break;
      }
      case 'purge': {
        const result = await migration.purgeLegacyImageData({ log, confirm: flag('confirm') });
        console.log(
          `\nVerified candidates ${result.candidates}, cleared ${result.purged}, skipped ${result.skipped.length}, ` +
            `not migrated yet ${result.notMigrated}${result.confirm ? '' : ' (dry run — add --confirm)'}`,
        );
        break;
      }
      case 'orphans': {
        const result = await migration.deleteOrphanedObjects({ log, confirm: flag('confirm') });
        console.log(`\nOrphaned files ${result.orphans.length}, deleted ${result.deleted}${result.confirm ? '' : ' (dry run — add --confirm)'}`);
        break;
      }
      default:
        console.log('Usage: images <backup|migrate|verify|purge|orphans> [--dry-run] [--confirm] [--env-file=FILE] [--out=DIR]');
        process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
