-- Move image files to Cloudflare R2 (step 1 of 2: additive and safe).
--
-- * New columns hold the R2 object key and when the object was last verified.
-- * "data" becomes optional: new uploads no longer store bytes in PostgreSQL.
-- * Existing image bytes are NOT touched here. They are copied to R2 by
--   `npm run images:migrate-to-r2`, and only cleared later by
--   `npm run images:purge-db-data --confirm` after verification + backup.
-- * Dropping the "data" column completely is a separate, later migration.

-- AlterTable
ALTER TABLE "images" ADD COLUMN     "storage_key" VARCHAR(512),
ADD COLUMN     "storage_verified_at" TIMESTAMP(3),
ALTER COLUMN "data" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "images_storage_key_key" ON "images"("storage_key");

-- Every image must still have its content somewhere: in R2 (key) or, for legacy rows, in the database.
ALTER TABLE "images" ADD CONSTRAINT "images_has_content" CHECK ("data" IS NOT NULL OR "storage_key" IS NOT NULL);

-- Object keys are always under the images/ prefix.
ALTER TABLE "images" ADD CONSTRAINT "images_storage_key_format" CHECK ("storage_key" IS NULL OR "storage_key" LIKE 'images/%');
