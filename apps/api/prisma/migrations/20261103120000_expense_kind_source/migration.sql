-- Fica antes do BEGIN pelo mesmo motivo de 20261101120000_household_multi_group.
SET lock_timeout = '4s';

BEGIN;

-- Tudo o que já existe é gasto: o default cobre as linhas antigas e quem ainda
-- grava sem informar o tipo.
ALTER TABLE "expenses" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'expense';

-- De onde a linha veio. 'wallet' é reservado para a carteira e nada grava esse
-- valor por enquanto.
ALTER TABLE "expenses" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
UPDATE "expenses" SET "source" = 'statement' WHERE "statement_id" IS NOT NULL;

-- A linha continua na lista, mas fica fora de todos os totais.
ALTER TABLE "expenses" ADD COLUMN "excluded_from_totals" BOOLEAN NOT NULL DEFAULT false;

-- A entrada não tem categoria.
ALTER TABLE "expenses" ALTER COLUMN "category" DROP NOT NULL;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_kind_check" CHECK ("kind" IN ('expense', 'income')) NOT VALID;
ALTER TABLE "expenses" VALIDATE CONSTRAINT "expenses_kind_check";

-- Gasto tem categoria; entrada não tem.
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_kind_category_check" CHECK (("kind" = 'expense') = ("category" IS NOT NULL)) NOT VALID;
ALTER TABLE "expenses" VALIDATE CONSTRAINT "expenses_kind_category_check";

COMMIT;
