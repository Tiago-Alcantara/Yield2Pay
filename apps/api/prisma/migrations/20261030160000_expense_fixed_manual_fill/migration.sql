-- Cobre o banco que já aplicou 20261030143000 antes do preenchimento.
-- Num banco novo o UPDATE não muda linha nenhuma: a migration anterior já marcou.
SET LOCAL lock_timeout = '4s';

UPDATE "expenses" SET "fixed_manual" = true WHERE "fixed" = true AND "fixed_manual" = false;
