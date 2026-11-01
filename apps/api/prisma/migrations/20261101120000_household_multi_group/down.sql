-- Volta ao modelo de um grupo por pessoa. Só roda se ninguém estiver em dois
-- ou mais grupos. Depois que um membro antigo acessa e ganha o grupo
-- individual, este down aborta: ver docs/DEPLOY.md.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "household_members" GROUP BY "company_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'household_multi_group down: há pessoa em dois ou mais grupos; o unique de company_id não pode voltar';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "households" GROUP BY "owner_company_id" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'household_multi_group down: há pessoa dona de dois ou mais grupos; o unique de owner_company_id não pode voltar';
  END IF;
END $$;

ALTER TABLE "companies" DROP COLUMN IF EXISTS "guest_group_limit";

ALTER TABLE "household_members" DROP CONSTRAINT IF EXISTS "household_members_role_check";

ALTER TABLE "household_members" DROP COLUMN IF EXISTS "created_at";

DROP INDEX IF EXISTS "household_members_company_id_idx";
CREATE UNIQUE INDEX "household_members_company_id_key" ON "household_members"("company_id");

DROP INDEX IF EXISTS "households_owner_company_id_personal_key";
CREATE UNIQUE INDEX "households_owner_company_id_key" ON "households"("owner_company_id");

ALTER TABLE "households" DROP COLUMN IF EXISTS "personal";

COMMIT;
