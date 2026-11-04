-- Tira a carteira. Apaga as linhas de expenses que vieram dela: sem a carteira,
-- ninguém mais conseguiria removê-las nem desmarcar "transferência minha".
-- Depois de rodar, apague a linha desta migration em _prisma_migrations.
BEGIN;

DELETE FROM "expenses" WHERE "source" = 'wallet';

DROP TABLE IF EXISTS "wallet_movements";
DROP TABLE IF EXISTS "household_wallets";
DROP TABLE IF EXISTS "asset_price_daily";

COMMIT;
