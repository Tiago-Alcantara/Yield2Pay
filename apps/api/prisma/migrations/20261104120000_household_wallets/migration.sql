-- Fica antes do BEGIN pelo mesmo motivo de 20261101120000_household_multi_group.
SET lock_timeout = '4s';

BEGIN;

CREATE TABLE "household_wallets" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "added_by_company_id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "muxed_id" TEXT,
    "label" TEXT NOT NULL,
    "cursor" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "sync_status" TEXT NOT NULL DEFAULT 'pending',
    "sync_not_before" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_wallets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "household_wallets_network_check" CHECK ("network" IN ('testnet', 'public')),
    CONSTRAINT "household_wallets_sync_status_check" CHECK ("sync_status" IN ('pending', 'ok', 'updating'))
);

CREATE TABLE "wallet_movements" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "op_id" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "occurred_on" DATE NOT NULL,
    "op_type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "asset" TEXT,
    "quantity" DECIMAL(20,7),
    "fee_stroops" BIGINT,
    "class" TEXT NOT NULL,
    "value_cents" INTEGER,
    "expense_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "wallet_movements_direction_check" CHECK ("direction" IN ('in', 'out', 'none')),
    CONSTRAINT "wallet_movements_class_check" CHECK ("class" IN ('expense', 'income', 'conversion', 'info'))
);

CREATE TABLE "asset_price_daily" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price_cents_per_unit" DECIMAL(20,7) NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_price_daily_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "household_wallets_added_by_company_id_idx" ON "household_wallets"("added_by_company_id");

CREATE UNIQUE INDEX "household_wallets_household_id_network_account_id_muxed_id_key" ON "household_wallets"("household_id", "network", "account_id", "muxed_id");

-- Coluna nula não repete no unique acima: sem este índice, a mesma conta G
-- entraria duas vezes no grupo. O Prisma não expressa índice parcial.
CREATE UNIQUE INDEX "household_wallets_no_muxed_key" ON "household_wallets"("household_id", "network", "account_id") WHERE "muxed_id" IS NULL;

CREATE UNIQUE INDEX "wallet_movements_expense_id_key" ON "wallet_movements"("expense_id");

CREATE INDEX "wallet_movements_wallet_id_occurred_on_idx" ON "wallet_movements"("wallet_id", "occurred_on");

CREATE UNIQUE INDEX "wallet_movements_wallet_id_op_id_key" ON "wallet_movements"("wallet_id", "op_id");

CREATE UNIQUE INDEX "asset_price_daily_asset_date_key" ON "asset_price_daily"("asset", "date");

ALTER TABLE "household_wallets" ADD CONSTRAINT "household_wallets_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "household_wallets" ADD CONSTRAINT "household_wallets_added_by_company_id_fkey" FOREIGN KEY ("added_by_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wallet_movements" ADD CONSTRAINT "wallet_movements_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "household_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wallet_movements" ADD CONSTRAINT "wallet_movements_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
