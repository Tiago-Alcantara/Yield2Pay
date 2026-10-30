-- CREATE INDEX CONCURRENTLY não pode rodar dentro da transação do Prisma.
-- O COMMIT fecha essa transação; o BEGIN devolve o controle para o migrate.
COMMIT;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "expenses_household_id_shared_merchant_key_idx"
  ON "expenses"("household_id", "shared_merchant_key");

BEGIN;
