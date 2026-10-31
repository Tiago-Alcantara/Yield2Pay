DROP INDEX IF EXISTS "expenses_household_id_shared_merchant_key_idx";
ALTER TABLE "expenses" DROP COLUMN IF EXISTS "shared_merchant_key";
ALTER TABLE "expenses" DROP COLUMN IF EXISTS "merchant_key";
