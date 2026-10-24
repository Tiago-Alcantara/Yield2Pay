ALTER TABLE "expenses" ADD COLUMN "fit_id" TEXT;

CREATE UNIQUE INDEX "expenses_household_id_fit_id_key" ON "expenses"("household_id", "fit_id");
