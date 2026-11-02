-- Fica antes do BEGIN para valer também no DO abaixo. Com o SET só dentro do BEGIN,
-- o DO esperaria sem limite por um lock preso em household_members.
SET lock_timeout = '4s';

-- Aborta antes de qualquer DDL, com a mensagem certa no erro do deploy. Fica fora
-- do BEGIN: um erro dentro dele chega ao deploy só como "current transaction is
-- aborted", porque o Prisma tenta gravar o log da falha na mesma conexão.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "household_members" WHERE "role" NOT IN ('owner', 'member')
  ) THEN
    RAISE EXCEPTION 'household_multi_group: há role fora de (owner, member) em household_members; corrija o dado antes do deploy';
  END IF;
END $$;

-- Redundante neste arquivo: por ter $$, ele chega ao Postgres numa consulta só, e o
-- Postgres já desfaz a mensagem inteira se algo falhar. O BEGIN é defensivo, porque
-- essa forma de envio não é documentada. O custo: uma falha aqui dentro pode
-- esconder o erro original atrás de "current transaction is aborted". Olhe o
-- PRIMEIRO erro no log do Postgres. Ver docs/DEPLOY.md, seção 5.
BEGIN;

-- Grupo individual: cada pessoa tem exatamente um.
ALTER TABLE "households" ADD COLUMN "personal" BOOLEAN NOT NULL DEFAULT false;

-- Até aqui cada pessoa era dona de no máximo um grupo, o que ela criou. Todos
-- os grupos que já existem passam a ser o grupo individual do dono, inclusive
-- os que têm membros: o individual pode ter membros.
UPDATE "households" SET "personal" = true;

-- Uma pessoa pode ser dona de vários grupos, mas de um só grupo individual.
-- O Prisma não expressa índice parcial: este índice existe só aqui no SQL.
DROP INDEX "households_owner_company_id_key";
CREATE UNIQUE INDEX "households_owner_company_id_personal_key" ON "households"("owner_company_id") WHERE "personal";

-- A pessoa pode estar em vários grupos. O par (household_id, company_id)
-- continua único pelo índice criado em 20261014210000.
DROP INDEX "household_members_company_id_key";
CREATE INDEX "household_members_company_id_idx" ON "household_members"("company_id");

-- Desempata o grupo padrão de quem está em mais de um grupo não individual.
-- As linhas antigas recebem a mesma data: cada pessoa só tinha um grupo.
ALTER TABLE "household_members" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "household_members" ADD CONSTRAINT "household_members_role_check" CHECK ("role" IN ('owner', 'member')) NOT VALID;
ALTER TABLE "household_members" VALIDATE CONSTRAINT "household_members_role_check";

-- Quantos grupos alheios a pessoa pode ter. Nulo vale o padrão (1).
ALTER TABLE "companies" ADD COLUMN "guest_group_limit" INTEGER;

COMMIT;
