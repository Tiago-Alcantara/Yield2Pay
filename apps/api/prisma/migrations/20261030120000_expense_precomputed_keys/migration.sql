ALTER TABLE "expenses" ADD COLUMN "merchant_key" TEXT NOT NULL DEFAULT '';
ALTER TABLE "expenses" ADD COLUMN "shared_merchant_key" TEXT NOT NULL DEFAULT '';

CREATE INDEX "expenses_household_id_shared_merchant_key_idx" ON "expenses"("household_id", "shared_merchant_key");
