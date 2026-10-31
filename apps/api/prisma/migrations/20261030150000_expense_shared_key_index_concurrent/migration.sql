-- O índice já nasce em 20261030120000, dentro da transação do migrate.
-- CREATE INDEX normal (não CONCURRENTLY): COMMIT/BEGIN manuais deixavam
-- finished_at nulo e o próximo migrate deploy caía em P3009.
CREATE INDEX IF NOT EXISTS "expenses_household_id_shared_merchant_key_idx"
  ON "expenses"("household_id", "shared_merchant_key");
