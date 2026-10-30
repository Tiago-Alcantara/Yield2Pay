SET LOCAL lock_timeout = '4s';

ALTER TABLE "expenses" ADD COLUMN "fixed_manual" BOOLEAN NOT NULL DEFAULT false;

-- O fixo que já estava gravado continua fixo: a marca manual vale nos dois sentidos.
UPDATE "expenses" SET "fixed_manual" = true WHERE "fixed" = true;
