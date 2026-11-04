-- Volta ao modelo em que toda linha é gasto. Aborta se já existir entrada: uma
-- entrada não tem categoria e, sem a coluna kind, viraria gasto ao voltar.
-- Depois de rodar, apague a linha desta migration em _prisma_migrations.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "expenses" WHERE "kind" = 'income') THEN
    RAISE EXCEPTION 'expense_kind_source down: há entradas em expenses; apague ou reclassifique antes de voltar';
  END IF;
END $$;

ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_kind_category_check";
ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_kind_check";

ALTER TABLE "expenses" ALTER COLUMN "category" SET NOT NULL;

ALTER TABLE "expenses" DROP COLUMN IF EXISTS "excluded_from_totals";
ALTER TABLE "expenses" DROP COLUMN IF EXISTS "source";
ALTER TABLE "expenses" DROP COLUMN IF EXISTS "kind";

COMMIT;
