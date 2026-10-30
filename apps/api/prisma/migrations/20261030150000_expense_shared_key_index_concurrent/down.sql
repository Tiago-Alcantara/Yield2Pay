-- Rode fora de uma transação: DROP INDEX CONCURRENTLY não aceita bloco transacional.
DROP INDEX CONCURRENTLY IF EXISTS "expenses_household_id_shared_merchant_key_idx";
