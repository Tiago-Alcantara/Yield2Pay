-- AlterTable
ALTER TABLE "statements" ADD COLUMN "content_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "statements_household_id_content_hash_key" ON "statements"("household_id", "content_hash");
