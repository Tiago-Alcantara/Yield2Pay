SET lock_timeout = '4s';

-- Grupo individual: cada pessoa tem exatamente um, criado por ela.
ALTER TABLE "households" ADD COLUMN "personal" BOOLEAN NOT NULL DEFAULT false;

-- Até aqui cada pessoa era dona de no máximo um grupo, o que ela criou.
-- Todos os grupos que já existem passam a ser o grupo individual do dono.
UPDATE "households" SET "personal" = true;

-- Uma pessoa pode ser dona de vários grupos, mas de um só grupo individual.
-- O Prisma não expressa índice parcial: este índice existe só aqui no SQL.
DROP INDEX "households_owner_company_id_key";
CREATE UNIQUE INDEX "households_owner_company_id_personal_key" ON "households"("owner_company_id") WHERE "personal";

-- A pessoa pode estar em vários grupos. O par (household_id, company_id)
-- continua único pelo índice criado em 20261014210000.
DROP INDEX "household_members_company_id_key";
CREATE INDEX "household_members_company_id_idx" ON "household_members"("company_id");

ALTER TABLE "household_members" ADD CONSTRAINT "household_members_role_check" CHECK ("role" IN ('owner', 'member'));

-- Quantos grupos alheios a pessoa pode ter. Nulo vale o padrão (1).
ALTER TABLE "companies" ADD COLUMN "guest_group_limit" INTEGER;
