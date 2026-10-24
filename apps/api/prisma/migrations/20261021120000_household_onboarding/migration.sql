-- AlterTable
ALTER TABLE "households" ADD COLUMN "goals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "households" ADD COLUMN "import_mode" TEXT;
ALTER TABLE "households" ADD COLUMN "crypto_familiarity" TEXT;
ALTER TABLE "households" ADD COLUMN "crypto_actions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "households" ADD COLUMN "show_freedom" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "households" ADD COLUMN "show_family" BOOLEAN NOT NULL DEFAULT true;
