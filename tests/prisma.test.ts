import { describe, expect, it } from 'vitest';
import { prisma } from './helpers';
import { runPrisma, schemaPath } from './prismaCli';

describe('Prisma schema & migrations', () => {
  it('schema.prisma is valid', () => {
    const result = runPrisma(['validate']);
    expect(result.status, result.output).toBe(0);
  });

  it('migrations are fully applied and match schema.prisma (no drift)', () => {
    const status = runPrisma(['migrate', 'status']);
    expect(status.status, status.output).toBe(0);
    expect(status.output).toContain('Database schema is up to date');

    // exit code 0 = no differences between the real database and schema.prisma
    const diff = runPrisma(
      ['migrate', 'diff', '--from-schema-datasource', schemaPath, '--to-schema-datamodel', schemaPath, '--exit-code'],
      { withSchemaFlag: false },
    );
    expect(diff.status, diff.output).toBe(0);
  });

  it('extra CHECK constraints exist in the database', async () => {
    const rows = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname FROM pg_constraint WHERE contype = 'c' ORDER BY conname`;
    const names = rows.map((row) => row.conname);
    expect(names).toEqual(
      expect.arrayContaining(['follows_no_self_follow', 'images_size_limit', 'images_mime_type_allowed', 'posts_title_length']),
    );
  });
});
