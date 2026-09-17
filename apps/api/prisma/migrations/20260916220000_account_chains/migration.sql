-- AlterTable
ALTER TABLE "companies" ADD COLUMN "selected_chain" TEXT NOT NULL DEFAULT 'stellar';
ALTER TABLE "companies" ADD COLUMN "unlocked_chains" TEXT[] NOT NULL DEFAULT ARRAY['stellar']::TEXT[];

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN "solana_address" TEXT;
